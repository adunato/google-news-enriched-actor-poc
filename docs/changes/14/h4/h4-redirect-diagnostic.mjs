/* global AbortSignal:readonly, URL:readonly, console:readonly, fetch:readonly, process:readonly */
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDomain } from "tldts";
import {
  createStagingDirectory,
  cleanupStagingDirectory,
  publishStagingDirectory,
  writeStagedFile,
} from "./h4-storage.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(DIR, "../../../../");
const MANIFEST = resolve(ROOT, "docs/changes/18/input-manifest.json");
const HISTORICAL = resolve(ROOT, "docs/changes/18/hosted-results.json");
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const CONCURRENCY = 4;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const KNOWN_SAFE_REGISTRABLES = new Set(["google.com"]);
const KNOWN_SAFE_GOOGLE_HOSTS = new Set([
  "google.com",
  "news.google.com",
  "consent.google.com",
  "accounts.google.com",
  "www.google.com",
]);
const EXPECTED_MANIFEST_SHA256 = "d1ed2bea31efc54358ac24d991a9037ec0f0840ccd50547c01bd794c64389f3c";
const EXPECTED_LABELS_SHA256 = "00bce29a5d0582f0cb82f6d8e685d60075932b9e9659247233566c4fb88b4788";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function safeJson(text, name) {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

export function positiveControlIds(historical) {
  if (!Array.isArray(historical?.rows)) throw new Error("Historical labels are missing rows");
  const ids = historical.rows
    .filter((row) => row?.recordType === "row" && row.identityStatus === "confirmed_match")
    .map((row) => row.rowId);
  if (ids.length !== 79 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== 79) {
    throw new Error("Expected exactly 79 unique historical confirmed_match controls");
  }
  return new Set(ids);
}

export function selectPositiveControls(manifest, labels) {
  if (!Array.isArray(manifest?.rows)) throw new Error("Fixed manifest is missing rows");
  const ids = positiveControlIds(labels);
  const selected = [];
  const seen = new Set();
  for (const row of manifest.rows) {
    if (!ids.has(row?.rowId)) continue;
    if (seen.has(row.rowId))
      throw new Error("Positive control row ID is duplicated in the manifest");
    seen.add(row.rowId);
    selected.push({ rowId: row.rowId, googleNewsUrl: row.googleNewsUrl });
  }
  if (selected.length !== 79 || seen.size !== ids.size) {
    throw new Error("The fixed manifest does not contain all 79 historical positive controls");
  }
  return selected;
}

function allowedNewsUrl(value) {
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

function originShape(value) {
  try {
    const url = new URL(value);
    const domain = getDomain(url.hostname, { allowPrivateDomains: false });
    if (!domain) return "https://other-host";
    if (!KNOWN_SAFE_REGISTRABLES.has(domain)) return "https://other-registrable-domain";
    if (KNOWN_SAFE_GOOGLE_HOSTS.has(url.hostname)) return `https://${url.hostname}`;
    const prefix = url.hostname.slice(0, -domain.length).replace(/\.$/, "");
    const depth = prefix ? prefix.split(".").filter(Boolean).length : 0;
    return `https://${depth === 0 ? "" : `*${depth === 1 ? "" : `(${depth})`}.`}${domain}`;
  } catch {
    return "invalid-origin";
  }
}

function segmentKind(segment) {
  if (/^[\p{L}]+$/u.test(segment)) return "letters";
  if (/^\p{N}+$/u.test(segment)) return "digits";
  if (/^[\p{L}\p{N}]+$/u.test(segment)) return "letters-and-digits";
  return "mixed";
}

export function sanitizedUrlShape(value, base) {
  try {
    const url = new URL(value, base);
    const segments = url.pathname.split("/").filter(Boolean);
    const shape =
      segments.length > 8
        ? `${segments.slice(0, 8).map(segmentKind).join("/")}/many`
        : segments.map(segmentKind).join("/");
    return { origin: originShape(url.href), pathShape: shape ? `/${shape}` : "/" };
  } catch {
    return { origin: "invalid-origin", pathShape: "unparseable" };
  }
}

function observationKey(observation) {
  return JSON.stringify(observation);
}

function addObservation(aggregate, observation) {
  const key = observationKey(observation);
  const prior = aggregate.get(key);
  if (prior) prior.count += 1;
  else aggregate.set(key, { ...observation, count: 1 });
}

async function inspectControl(row, observations, fetchImpl) {
  if (!allowedNewsUrl(row.googleNewsUrl)) {
    addObservation(observations, {
      hop: 0,
      status: null,
      requestOrigin: "invalid-origin",
      requestPathShape: "unparseable",
      destinationOrigin: null,
      destinationPathShape: null,
      rejectionReason: "invalid_positive_input",
    });
    return { requests: 0, hadRedirect: false };
  }
  let current = row.googleNewsUrl;
  let requests = 0;
  let hadRedirect = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response;
    try {
      response = await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 issue-14-h4-redirect-diagnostic/1.0",
        },
      });
      requests += 1;
    } catch (error) {
      requests += 1;
      addObservation(observations, {
        hop,
        status: null,
        requestOrigin: sanitizedUrlShape(current).origin,
        requestPathShape: sanitizedUrlShape(current).pathShape,
        destinationOrigin: null,
        destinationPathShape: null,
        rejectionReason: error?.name === "TimeoutError" ? "timeout" : "network_error",
      });
      return { requests, hadRedirect };
    }
    const requestShape = sanitizedUrlShape(current);
    const location = response.headers.get("location");
    let target = null;
    let redirectFailure = null;
    if (REDIRECT_STATUSES.has(response.status)) {
      hadRedirect = true;
      if (location === null) {
        redirectFailure = "redirect_location_missing";
      } else if (typeof location !== "string" || location.trim() === "") {
        redirectFailure = "redirect_location_malformed";
      } else {
        try {
          target = new URL(location, current).href;
        } catch {
          redirectFailure = "redirect_location_malformed";
        }
      }
    }
    await response.body?.cancel().catch(() => {});
    if (redirectFailure) {
      addObservation(observations, {
        hop,
        status: response.status,
        requestOrigin: requestShape.origin,
        requestPathShape: requestShape.pathShape,
        destinationOrigin: null,
        destinationPathShape: null,
        rejectionReason: redirectFailure,
      });
      return { requests, hadRedirect };
    }
    if (target && !allowedNewsUrl(target)) {
      const destinationShape = sanitizedUrlShape(target);
      addObservation(observations, {
        hop,
        status: response.status,
        requestOrigin: requestShape.origin,
        requestPathShape: requestShape.pathShape,
        destinationOrigin: destinationShape.origin,
        destinationPathShape: destinationShape.pathShape,
        rejectionReason: "unexpected_redirect_destination",
      });
      return { requests, hadRedirect };
    }
    if (target && hop === MAX_REDIRECTS) {
      addObservation(observations, {
        hop,
        status: response.status,
        requestOrigin: requestShape.origin,
        requestPathShape: requestShape.pathShape,
        destinationOrigin: originShape(target),
        destinationPathShape: sanitizedUrlShape(target).pathShape,
        rejectionReason: "redirect_limit",
      });
      return { requests, hadRedirect };
    }
    addObservation(observations, {
      hop,
      status: response.status,
      requestOrigin: requestShape.origin,
      requestPathShape: requestShape.pathShape,
      destinationOrigin: target ? originShape(target) : null,
      destinationPathShape: target ? sanitizedUrlShape(target).pathShape : null,
      rejectionReason: target ? "allowed_google_redirect" : "terminal_response",
    });
    if (!target) return { requests, hadRedirect };
    current = target;
  }
  return { requests, hadRedirect };
}

export async function runRedirectDiagnostic(rows, fetchImpl = fetch) {
  if (rows.length !== 79)
    throw new Error("Diagnostic accepts only the 79 historical positive controls");
  const observations = new Map();
  let cursor = 0;
  let requestCount = 0;
  let rowsWithRedirect = 0;
  let rowCount = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      const result = await inspectControl(row, observations, fetchImpl);
      rowCount += 1;
      requestCount += result.requests;
      if (result.hadRedirect) rowsWithRedirect += 1;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return {
    diagnostic: "issue14_control_only_redirect_v1",
    completedAtUtc: new Date().toISOString(),
    controlsSelected: rows.length,
    rowsCompleted: rowCount,
    rowsWithRedirect: rowsWithRedirect,
    requestsAttempted: requestCount,
    bounds: {
      timeoutMs: TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      maxResponseBytes: 0,
      concurrency: CONCURRENCY,
    },
    observations: [...observations.values()].sort((a, b) =>
      observationKey(a).localeCompare(observationKey(b)),
    ),
    dataRetained: {
      rowIdentifiers: false,
      titles: false,
      rawLocation: false,
      fullPaths: false,
      queries: false,
      bodies: false,
    },
  };
}

async function main() {
  const manifestBytes = await readFile(MANIFEST);
  const labelBytes = await readFile(HISTORICAL);
  const manifestSha256 = sha256(manifestBytes);
  const historicalLabelsSha256 = sha256(labelBytes);
  if (
    manifestSha256 !== EXPECTED_MANIFEST_SHA256 ||
    historicalLabelsSha256 !== EXPECTED_LABELS_SHA256
  ) {
    throw new Error(
      "The fixed #18 manifest or historical labels changed; refusing diagnostic requests",
    );
  }
  const rows = selectPositiveControls(
    safeJson(manifestBytes.toString("utf8"), "manifest"),
    safeJson(labelBytes.toString("utf8"), "historical labels"),
  );
  const result = await runRedirectDiagnostic(rows);
  const stage = await createStagingDirectory(DIR);
  try {
    const report = {
      ...result,
      inputHashes: { manifestSha256, historicalLabelsSha256 },
      codeSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    };
    await writeStagedFile(
      stage,
      "redirect-diagnostic.json",
      `${JSON.stringify(report, null, 2)}\n`,
    );
    const directory = join(
      DIR,
      `h4-redirect-diagnostic-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
    );
    await publishStagingDirectory(stage, directory, ["redirect-diagnostic.json"]);
    console.log(
      JSON.stringify({
        reportDirectory: directory.split(/[\\/]/).at(-1),
        controlsSelected: report.controlsSelected,
        rowsCompleted: report.rowsCompleted,
        requestsAttempted: report.requestsAttempted,
      }),
    );
  } catch (error) {
    await cleanupStagingDirectory(stage);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
