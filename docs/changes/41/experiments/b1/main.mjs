/* global AbortSignal:readonly, Buffer:readonly, URL:readonly, TextDecoder:readonly, console:readonly, fetch:readonly, process:readonly */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Actor } from "apify";

const EXPECTED_SAMPLE_SHA256 = "fefd157f4a6b7621bbe1978770d8b6409edc5fc2d02df668af2ad51f51e34bae";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10000;
const CONCURRENCY = 4;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function readBounded(response) {
  const declaredBytes = Number(response.headers.get("content-length") || 0);
  if (declaredBytes > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("body_limit");
  }
  if (!response.body) return Buffer.alloc(0);

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
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function checkPage(row) {
  const started = Date.now();
  const stages = [];
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = row.publisherUrl;
  let requestCount = 0;

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      requestCount += 1;
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 issue-41-b1-bounded-access/1.0",
        },
        redirect: "manual",
        signal,
      });
      const location = response.headers.get("location");
      stages.push({
        status: response.status,
        host: new URL(url).hostname.toLowerCase(),
        locationHost: location ? new URL(location, url).hostname.toLowerCase() : null,
      });

      if (location && [301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (redirectCount === MAX_REDIRECTS) {
          return {
            ...row,
            accessClass: "redirect_limit",
            usableHtml: false,
            stages,
            requestCount,
            elapsedMs: Date.now() - started,
          };
        }
        const next = new URL(location, url);
        if (!["http:", "https:"].includes(next.protocol)) {
          return {
            ...row,
            accessClass: "unsupported_redirect_scheme",
            usableHtml: false,
            stages,
            requestCount,
            elapsedMs: Date.now() - started,
          };
        }
        url = next.href;
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const isHtml = /\btext\/html\b|\bapplication\/xhtml\+xml\b/i.test(contentType);
      const finalHost = new URL(url).hostname.toLowerCase();
      const finalPath = new URL(url).pathname;
      if (response.status === 401 || response.status === 403 || response.status === 429) {
        await response.body?.cancel();
        return {
          ...row,
          accessClass: "http_denied",
          status: response.status,
          contentType,
          finalHost,
          finalPath,
          usableHtml: false,
          stages,
          requestCount,
          elapsedMs: Date.now() - started,
        };
      }
      if (!response.ok) {
        await response.body?.cancel();
        return {
          ...row,
          accessClass: "http_error",
          status: response.status,
          contentType,
          finalHost,
          finalPath,
          usableHtml: false,
          stages,
          requestCount,
          elapsedMs: Date.now() - started,
        };
      }
      if (!isHtml) {
        await response.body?.cancel();
        return {
          ...row,
          accessClass: "non_html",
          status: response.status,
          contentType,
          finalHost,
          finalPath,
          usableHtml: false,
          stages,
          requestCount,
          elapsedMs: Date.now() - started,
        };
      }

      const body = await readBounded(response);
      if (body.length === 0) {
        return {
          ...row,
          accessClass: "empty_html",
          status: response.status,
          contentType,
          finalHost,
          finalPath,
          bodyBytes: 0,
          usableHtml: false,
          stages,
          requestCount,
          elapsedMs: Date.now() - started,
        };
      }
      const bodyText = new TextDecoder().decode(body);
      const challenge =
        /captcha|verify (?:that )?you are human|are you a robot|access denied|request blocked|temporarily blocked|robot check/i.test(
          bodyText,
        );
      if (challenge) {
        return {
          ...row,
          accessClass: "challenge_html",
          status: response.status,
          contentType,
          finalHost,
          finalPath,
          bodyBytes: body.length,
          bodySha256: sha256(body),
          usableHtml: false,
          stages,
          requestCount,
          elapsedMs: Date.now() - started,
        };
      }

      const htmlKey = `B1_HTML_${row.rowId}`;
      await Actor.setValue(htmlKey, body, { contentType });
      return {
        ...row,
        accessClass: "usable_html",
        status: response.status,
        contentType,
        finalHost,
        finalPath,
        bodyBytes: body.length,
        bodySha256: sha256(body),
        htmlKey,
        usableHtml: true,
        stages,
        requestCount,
        elapsedMs: Date.now() - started,
      };
    }
    throw new Error("response_missing");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...row,
      accessClass:
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : message === "body_limit"
            ? "body_limit"
            : message,
      usableHtml: false,
      stages,
      requestCount,
      elapsedMs: Date.now() - started,
    };
  }
}

await Actor.init();
try {
  const sampleText = await readFile(new URL("./input-sample.json", import.meta.url), "utf8");
  if (sha256(sampleText) !== EXPECTED_SAMPLE_SHA256) {
    throw new Error("Frozen B1 sample hash mismatch");
  }
  const sample = JSON.parse(sampleText);
  if (sample.rows.length !== 100 || new Set(sample.rows.map((row) => row.rowId)).size !== 100) {
    throw new Error("B1 sample must contain 100 unique source rows");
  }
  if (sample.rows.some((row) => !row.publisherUrl || !row.googleNewsUrl || !row.publisherUrlHash)) {
    throw new Error("B1 sample is missing a resolved publisher URL or provenance mapping");
  }

  const startedAtUtc = new Date().toISOString();
  const rows = Array(sample.rows.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const index = next++;
        if (index >= sample.rows.length) return;
        rows[index] = await checkPage(sample.rows[index]);
      }
    }),
  );

  const accessClassCounts = {};
  for (const row of rows) {
    accessClassCounts[row.accessClass] = (accessClassCounts[row.accessClass] || 0) + 1;
  }
  const completedAtUtc = new Date().toISOString();
  const evidence = {
    evidenceType: "issue41_b1_publisher_page_access",
    startedAtUtc,
    completedAtUtc,
    environment: {
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      actorId: process.env.APIFY_ACTOR_ID || null,
      buildId: process.env.APIFY_ACTOR_BUILD_ID || null,
      buildNumber: process.env.APIFY_ACTOR_BUILD_NUMBER || null,
    },
    sample: {
      source: "Issue 41 A4 retained output from Issue 18's frozen manifest",
      manifestSha256: sample.manifestSha256,
      rowArraySha256: sample.rowArraySha256,
      b1SampleSha256: EXPECTED_SAMPLE_SHA256,
      rowCount: rows.length,
      uniqueRowIds: new Set(rows.map((row) => row.rowId)).size,
      deduplication: "Disabled; all 100 original row occurrences are measured.",
    },
    configuration: {
      timeoutMsPerRow: TIMEOUT_MS,
      responseLimitBytes: MAX_BYTES,
      maxRedirects: MAX_REDIRECTS,
      concurrency: CONCURRENCY,
      extraction: "Not run; B1 measures page access only.",
      htmlRetention:
        "Exact bounded response bytes for eligible HTML are retained in the run key-value store for conditional B2 use.",
      usableHtmlRule:
        "Final response is 2xx text/html or application/xhtml+xml, non-empty, within 2 MiB, and contains no explicit captcha/access-denial/interstitial marker. This is access eligibility only, not proof of readable article text.",
    },
    totalRows: rows.length,
    usableHtmlCount: rows.filter((row) => row.usableHtml).length,
    totalHttpRequests: rows.reduce((sum, row) => sum + row.requestCount, 0),
    accessClassCounts,
    rows,
  };
  await Actor.pushData([
    {
      evidenceType: evidence.evidenceType,
      startedAtUtc,
      completedAtUtc,
      environment: evidence.environment,
      sample: evidence.sample,
      configuration: evidence.configuration,
      totalRows: evidence.totalRows,
      usableHtmlCount: evidence.usableHtmlCount,
      totalHttpRequests: evidence.totalHttpRequests,
      accessClassCounts,
    },
    ...rows.map((row) => ({ evidenceType: "issue41_b1_row", ...row })),
  ]);
  await Actor.setValue("B1_SUMMARY", evidence, { contentType: "application/json; charset=utf-8" });
  console.log(
    `ISSUE41_B1 ${JSON.stringify({
      totalRows: evidence.totalRows,
      usableHtmlCount: evidence.usableHtmlCount,
      totalHttpRequests: evidence.totalHttpRequests,
      accessClassCounts,
    })}`,
  );
} finally {
  await Actor.exit();
}
