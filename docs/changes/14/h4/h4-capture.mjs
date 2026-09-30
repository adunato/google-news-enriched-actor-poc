/* global AbortSignal:readonly, Buffer:readonly, TextDecoder:readonly, URL:readonly, console:readonly, fetch:readonly, process:readonly */
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decideCalibration,
  googleNewsUrlHashMatches,
  sha256,
  summarizePositiveControlFailure,
} from "./h4-core.mjs";
import {
  acquireCaptureLock,
  cleanupStagingDirectory,
  createStagingDirectory,
  publishStagingDirectory,
  writeStagedFile,
} from "./h4-storage.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(DIR, "../../../../");
const MANIFEST = resolve(ROOT, "docs/changes/18/input-manifest.json");
const HISTORICAL = resolve(ROOT, "docs/changes/18/hosted-results.json");
const ALIASES = resolve(DIR, "aliases.json");
const EVIDENCE = resolve(DIR, "h4-evidence");
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const CONCURRENCY = 4;
const TIMEOUT_MS = 10_000;

function json(buffer, name) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${name} is not valid JSON: ${error.message}`);
  }
}

async function readJson(path) {
  const data = await readFile(path);
  return { value: json(data, path), sha256: sha256(data) };
}

function requiredSealKey() {
  const hex = process.env.H4_SEAL_KEY;
  if (!/^[a-f\d]{64}$/i.test(hex ?? "")) {
    throw new Error("Set H4_SEAL_KEY to a fresh 32-byte hex key; keep it outside the repository.");
  }
  return Buffer.from(hex, "hex");
}

function articleId(value) {
  try {
    const u = new URL(value);
    const path = u.pathname.split("/").filter(Boolean);
    const index = path.findIndex((part) => part === "articles" || part === "read");
    return u.hostname === "news.google.com" && index >= 0 ? path[index + 1] : null;
  } catch {
    return null;
  }
}

function marker(html) {
  const re = /<[^>]*\bdata-n-a-id\s*=\s*(["'])(.*?)\1[^>]*>/gis;
  for (const match of html.matchAll(re)) {
    const tag = match[0];
    const ts = tag.match(/\bdata-n-a-ts\s*=\s*(["'])(.*?)\1/i)?.[2];
    const sg = tag.match(/\bdata-n-a-sg\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (ts && sg) return { id: match[2], ts, sg };
  }
  return null;
}

function rpcBody(m) {
  const context = [
    ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
    "X",
    "X",
    1,
    [1, 1, 1],
    1,
    1,
    null,
    0,
    0,
    null,
    0,
  ];
  const request = ["garturlreq", context, m.id, /^\d+$/.test(m.ts) ? Number(m.ts) : m.ts, m.sg];
  return `f.req=${encodeURIComponent(JSON.stringify([[["Fbv4je", JSON.stringify(request), null, "0"]]]))}`;
}

function findResult(value) {
  if (typeof value === "string") {
    try {
      return findResult(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  if (value[0] === "garturlres" && typeof value[1] === "string") return value[1];
  for (const item of value) {
    const found = findResult(item);
    if (found) return found;
  }
  return null;
}

function parseRpc(body) {
  for (let line of body
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (/^\d+$/.test(line)) continue;
    if (line.startsWith(")]}'")) line = line.slice(4).trim();
    try {
      const result = findResult(JSON.parse(line));
      if (result) return result;
    } catch {
      /* Ignore non-JSON framing lines. */
    }
  }
  return null;
}

async function readBounded(response) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("body_limit");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("body_limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

function isNewsGoogleUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "news.google.com" &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

async function requestRow(row) {
  const expectedId = articleId(row.googleNewsUrl);
  if (
    !isNewsGoogleUrl(row.googleNewsUrl) ||
    !expectedId ||
    !googleNewsUrlHashMatches(row.googleNewsUrl, row.articleIdHash)
  ) {
    return {
      rowId: row.rowId,
      articleIdHash: row.articleIdHash,
      markerRpcBound: false,
      bindingStatus: "mismatched",
      failure: "input_article_id_hash_mismatch",
    };
  }
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    let response;
    let url = row.googleNewsUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 issue-14-h4-bounded/1.0",
        },
      });
      const location = response.headers.get("location");
      if (location && [301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (hop === MAX_REDIRECTS) throw new Error("redirect_limit");
        url = new URL(location, url).href;
        if (!isNewsGoogleUrl(url)) throw new Error("unexpected_redirect_destination");
        continue;
      }
      break;
    }
    const html = await readBounded(response);
    const markerData = marker(html);
    if (!markerData)
      return {
        rowId: row.rowId,
        articleIdHash: row.articleIdHash,
        markerRpcBound: false,
        bindingStatus: "missing",
        failure: "marker_missing",
      };
    if (markerData.id !== expectedId)
      return {
        rowId: row.rowId,
        articleIdHash: row.articleIdHash,
        markerArticleIdHash: sha256(markerData.id).slice(0, 16),
        markerRpcBound: false,
        bindingStatus: "mismatched",
        failure: "marker_article_id_mismatch",
      };
    const rpc = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      redirect: "manual",
      signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        accept: "*/*",
        "user-agent": "Mozilla/5.0 issue-14-h4-bounded/1.0",
      },
      body: rpcBody(markerData),
    });
    const rpcBodyText = await readBounded(rpc);
    const candidateUrl = parseRpc(rpcBodyText);
    let valid = false;
    try {
      const u = new URL(candidateUrl);
      const host = u.hostname.toLowerCase().replace(/\.$/, "");
      const isGoogleHost =
        host === "news.google.com" || /(^|\.)google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(host);
      valid =
        ["http:", "https:"].includes(u.protocol) && !u.username && !u.password && !isGoogleHost;
    } catch {
      /* invalid URL */
    }
    return {
      rowId: row.rowId,
      articleIdHash: row.articleIdHash,
      markerArticleIdHash: sha256(markerData.id).slice(0, 16),
      markerRpcBound: markerData.id === expectedId,
      bindingStatus: "matched",
      candidateUrl: valid ? candidateUrl : null,
      candidateUrlHash: valid ? sha256(candidateUrl) : null,
      failure: valid
        ? null
        : rpc.ok
          ? "rpc_destination_missing_or_invalid"
          : `rpc_http_${rpc.status}`,
    };
  } catch (error) {
    return {
      rowId: row.rowId,
      articleIdHash: row.articleIdHash,
      markerRpcBound: false,
      bindingStatus: "missing",
      failure:
        error.name === "TimeoutError"
          ? "timeout"
          : ["body_limit", "redirect_limit", "unexpected_redirect_destination"].includes(
                error.message,
              )
            ? error.message
            : "request_error",
    };
  }
}

async function mapBounded(rows) {
  const output = Array(rows.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const index = next++;
        if (index >= rows.length) return;
        output[index] = await requestRow(rows[index]);
      }
    }),
  );
  return output;
}

function seal(payload, key) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([Buffer.from("H4S1"), nonce, cipher.getAuthTag(), encrypted]);
}

async function main() {
  const lock = await acquireCaptureLock(DIR);
  let stage;
  try {
    const key = requiredSealKey();
    try {
      await access(EVIDENCE);
      throw new Error(
        "H4 evidence directory already exists; preserve the prior run and use a fresh evidence directory.",
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    stage = await createStagingDirectory(DIR);
    const [
      { value: manifest, sha256: manifestFileSha },
      { value: historical, sha256: historicalFileSha },
      { value: aliasesConfig, sha256: aliasFileSha },
    ] = await Promise.all([readJson(MANIFEST), readJson(HISTORICAL), readJson(ALIASES)]);
    if (manifest.rows?.length !== 100 || historical.rows?.length !== 100)
      throw new Error("Frozen H4 inputs must each contain exactly 100 rows.");
    if (
      historical.manifestSha256 !==
      "aaa88dc26c22f9ae31c559f5bd6deb0f2b74da1985444bdb456b49b43b04dc5c"
    )
      throw new Error("Historical #18 label artifact is not the approved hosted result set.");
    const labels = new Map(historical.rows.map((row) => [row.rowId, row]));
    const labelCounts = historical.rows.reduce(
      (counts, row) => (
        (counts[row.identityStatus] = (counts[row.identityStatus] ?? 0) + 1),
        counts
      ),
      {},
    );
    if (
      labelCounts.confirmed_match !== 79 ||
      labelCounts.unverifiable !== 21 ||
      Object.keys(labelCounts).length !== 2
    ) {
      throw new Error(
        "Historical #18 labels do not contain exactly 79 confirmed positives and 21 unresolved rows.",
      );
    }
    for (const row of manifest.rows) {
      const historicalRow = labels.get(row.rowId);
      if (
        !historicalRow ||
        historicalRow.articleIdHash !== row.articleIdHash ||
        historicalRow.identityStatus === undefined ||
        historicalRow.expectedTitle !== row.expectedTitle ||
        historicalRow.sourceHost !== row.sourceHost
      ) {
        throw new Error("Frozen manifest does not align with historical #18 labels.");
      }
      if (
        historicalRow.identityStatus === "confirmed_match" &&
        !/^[a-f\d]{64}$/i.test(historicalRow.candidateUrlHash ?? "")
      ) {
        throw new Error("Historical #18 positive control is missing its exact candidate URL hash.");
      }
    }
    const invalidGoogleNewsInputs = manifest.rows.filter(
      (row) =>
        !isNewsGoogleUrl(row.googleNewsUrl) ||
        !articleId(row.googleNewsUrl) ||
        !googleNewsUrlHashMatches(row.googleNewsUrl, row.articleIdHash),
    ).length;
    if (invalidGoogleNewsInputs > 0) {
      throw new Error(
        `Frozen #18 manifest preflight rejected ${invalidGoogleNewsInputs} Google News URL/hash rows; no network requests were made.`,
      );
    }
    const aliases = aliasesConfig.aliases ?? {};
    const scriptHashes = {};
    for (const file of [
      "h4-capture.mjs",
      "h4-core.mjs",
      "h4-core.check.mjs",
      "h4-storage.check.mjs",
      "h4-apply.mjs",
      "h4-storage.mjs",
      "aliases.json",
      "package.json",
      "package-lock.json",
    ]) {
      const data = await readFile(resolve(DIR, file));
      scriptHashes[file] = sha256(data);
    }
    const startedAtUtc = new Date().toISOString();
    const captured = await mapBounded(manifest.rows);
    const captureCompletedAtUtc = new Date().toISOString();
    const positiveRows = captured.flatMap((row, index) => {
      const input = manifest.rows[index];
      if (labels.get(input.rowId).identityStatus !== "confirmed_match") return [];
      return [
        {
          rowId: input.rowId,
          title: input.expectedTitle,
          sourceHost: input.sourceHost,
          candidateUrl: row.candidateUrl,
          binding: row.bindingStatus === "matched",
          hashStable:
            !!row.candidateUrlHash &&
            row.candidateUrlHash === labels.get(input.rowId).candidateUrlHash,
        },
      ];
    });
    if (positiveRows.length !== 79)
      throw new Error(
        `Expected 79 known positive controls; captured ${positiveRows.length}. No freeze was written.`,
      );
    const calibration = decideCalibration(positiveRows, aliases);
    if (!calibration.ok) {
      const controlDiagnostics = summarizePositiveControlFailure(
        captured.flatMap((row, index) => {
          const input = manifest.rows[index];
          if (labels.get(input.rowId).identityStatus !== "confirmed_match") return [];
          return [
            {
              ...row,
              title: input.expectedTitle,
              sourceHost: input.sourceHost,
              knownPositive: true,
              historicalCandidateHashStable:
                !!row.candidateUrlHash &&
                row.candidateUrlHash === labels.get(input.rowId).candidateUrlHash,
            },
          ];
        }),
        aliases,
      );
      const failureReport = {
        artifact: "issue14-h4-calibration-failure-v1",
        recordedAtUtc: new Date().toISOString(),
        gateReason: calibration.reason,
        inputHashes: {
          manifestFileSha,
          manifestRowsSha256: manifest.rowsSha256,
          historicalLabelsFileSha: historicalFileSha,
          historicalHostedManifestSha256: historical.manifestSha256,
          aliasConfigSha: aliasFileSha,
        },
        codeHashes: scriptHashes,
        operationalBounds: {
          timeoutMs: TIMEOUT_MS,
          maxRedirects: MAX_REDIRECTS,
          maxResponseBytes: MAX_BYTES,
          concurrency: CONCURRENCY,
          maxRequestsPerRow: 1,
        },
        positiveControlDiagnostics: controlDiagnostics,
      };
      const failureStage = await createStagingDirectory(DIR);
      const failureDirectory = resolve(
        DIR,
        `h4-failure-attempt-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
      );
      try {
        await writeStagedFile(
          failureStage,
          "h4-failure-report.json",
          Buffer.from(`${JSON.stringify(failureReport, null, 2)}\n`),
        );
        await publishStagingDirectory(failureStage, failureDirectory, ["h4-failure-report.json"]);
      } catch (error) {
        await cleanupStagingDirectory(failureStage);
        throw error;
      }
      throw new Error(
        `H4a calibration failed: ${calibration.reason}. A control-only failure report was written; no unresolved rows were classified and no freeze was written.`,
      );
    }
    const freeze = {
      artifact: "issue14-h4-rule-freeze-v1",
      frozenAtUtc: new Date().toISOString(),
      issue: 14,
      hypothesis: "H4a",
      iteration: 4,
      sample: {
        rows: manifest.rows.length,
        rowsSha256: manifest.rowsSha256,
        fileSha256: manifestFileSha,
      },
      historicalPositiveLabels: {
        fileSha256: historicalFileSha,
        hostedManifestSha256: historical.manifestSha256,
        confirmedMatches: 79,
      },
      scriptHashes,
      operationalBounds: {
        timeoutMs: TIMEOUT_MS,
        maxRedirects: MAX_REDIRECTS,
        maxResponseBytes: MAX_BYTES,
        concurrency: CONCURRENCY,
        maxRequestsPerRow: 1,
        repeatPerformed: false,
      },
      rule: calibration.rule,
      metrics: calibration.metrics,
      calibrationSha256: null,
      sealedCandidatesSha256: null,
      status: "frozen_before_unresolved_application",
    };
    const sealed = seal(
      {
        artifact: "issue14-h4-candidate-pack-v1",
        startedAtUtc,
        captureCompletedAtUtc,
        manifestFileSha,
        historicalFileSha,
        rows: captured.map((result, index) => ({
          ...result,
          title: manifest.rows[index].expectedTitle,
          sourceHost: manifest.rows[index].sourceHost,
        })),
      },
      key,
    );
    freeze.sealedCandidatesSha256 = sha256(sealed);
    const calibrationArtifact = {
      artifact: "issue14-h4-blind-calibration-v1",
      generatedAtUtc: freeze.frozenAtUtc,
      positiveControlIds: positiveRows.map((row) => row.rowId),
      negativeControlTypes: {
        samePublisherTitleSwap: calibration.metrics.samePublisherNegativeControls,
        knownPositiveCorpusTitleSwap: calibration.metrics.knownPositiveCorpusTitleSwaps,
      },
      rule: calibration.rule,
      metrics: calibration.metrics,
      inputHashes: { manifestFileSha, historicalFileSha, aliasFileSha },
      captureWindow: { startedAtUtc, completedAtUtc: captureCompletedAtUtc },
    };
    const calibrationBytes = Buffer.from(`${JSON.stringify(calibrationArtifact, null, 2)}\n`);
    freeze.calibrationSha256 = sha256(calibrationBytes);
    await writeStagedFile(stage, "h4-candidates.sealed", sealed);
    await writeStagedFile(stage, "h4-calibration.json", calibrationBytes);
    await writeStagedFile(
      stage,
      "h4-freeze.json",
      Buffer.from(`${JSON.stringify(freeze, null, 2)}\n`),
    );
    await publishStagingDirectory(stage, EVIDENCE, [
      "h4-candidates.sealed",
      "h4-calibration.json",
      "h4-freeze.json",
    ]);
    stage = undefined;
    console.log(
      "H4a capture complete. Full candidate payload is encrypted; calibration output contains only control IDs and aggregates.",
    );
  } finally {
    await cleanupStagingDirectory(stage);
    await lock.release();
  }
}

await main();
