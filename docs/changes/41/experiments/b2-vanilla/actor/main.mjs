/* global AbortSignal:readonly, Buffer:readonly, console:readonly, fetch:readonly, process:readonly */
import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { Actor } from "apify";
import { JSDOM } from "jsdom";
import { domContentType } from "./dom-content-type.mjs";

const MAX_ROWS = 100;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const ROW_HTTP_TIMEOUT_MS = 10_000;
const CONCURRENCY = 4;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function safeError(error) {
  const name =
    error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,39}$/u.test(error.name)
      ? error.name
      : "UnknownError";
  const code =
    error && typeof error.code === "string" && /^[A-Za-z0-9_-]{1,40}$/u.test(error.code)
      ? error.code
      : null;
  return { errorClass: name, errorCode: code };
}

function normalizedMime(contentType) {
  const mime = String(contentType || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(mime) ? mime : "unknown";
}

function logHttpStage(rowId, startedAt, state, stage, details = {}) {
  const error = details.error || {};
  try {
    console.log(
      `ISSUE41_B2_F1 ${JSON.stringify({
        rowId,
        stage,
        elapsedMs: Date.now() - startedAt,
        requestCount: state.requestCount,
        redirectCount: state.redirectCount,
        httpStatus: state.httpStatus ?? "none",
        normalizedMime: state.normalizedMime,
        bodyBytes: details.bodyBytes ?? state.bodyBytes ?? "unknown",
        errorClass: error.errorClass ?? "none",
        errorCode: error.errorCode ?? "none",
        phase: details.phase ?? "none",
      })}`,
    );
  } catch {
    // Diagnostic logging must never affect the HTTP request or its result.
  }
}

async function cancelResponseBody(response, logStage, phase) {
  logStage("cancel", { phase: `${phase}_start` });
  await response.body?.cancel();
  logStage("cancel", { phase: `${phase}_complete` });
}

function countWords(text) {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function collectArticleBodies(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectArticleBodies(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  const isArticle = types.some((type) =>
    /(?:^|\/)(?:Article|NewsArticle|BlogPosting|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle)$/iu.test(
      String(type || ""),
    ),
  );
  if (isArticle && typeof value.articleBody === "string") {
    const candidate = normalizeText(value.articleBody);
    if (candidate) output.push(candidate);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "@graph" || Array.isArray(child)) collectArticleBodies(child, output);
  }
  return output;
}

function structuredArticleText(document) {
  const candidates = [];
  for (const element of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      collectArticleBodies(JSON.parse(element.textContent || ""), candidates);
    } catch {
      // Malformed JSON-LD falls through to the general article parser.
    }
  }
  return candidates.sort((left, right) => right.length - left.length)[0] || null;
}

async function readBoundedBody(response, logStage) {
  logStage("body_read", { phase: "start" });
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    await cancelResponseBody(response, logStage, "declared_limit");
    throw Object.assign(new Error("Response exceeds the configured body bound"), {
      code: "BODY_LIMIT",
    });
  }
  if (!response.body) {
    logStage("body_read", { phase: "complete", bodyBytes: 0 });
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        logStage("cancel", { phase: "stream_limit_start" });
        await reader.cancel();
        logStage("cancel", { phase: "stream_limit_complete" });
        throw Object.assign(new Error("Response exceeds the configured body bound"), {
          code: "BODY_LIMIT",
        });
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  logStage("body_read", { phase: "complete", bodyBytes: byteLength });
  return Buffer.concat(chunks, byteLength);
}

function rowFields(row) {
  return {
    rowId: row.rowId,
    query: row.query,
    country: row.country,
    language: row.language,
    title: row.title,
    sourceName: row.sourceName,
    sourceHost: row.sourceHost,
    googleNewsUrl: row.googleNewsUrl,
    googleNewsUrlHash: row.googleNewsUrlHash,
    publisherUrl: row.publisherUrl,
    publisherHost: row.publisherHost,
    publisherUrlHash: row.publisherUrlHash,
    urlResolved: row.urlResolved,
    urlResolutionStatus: row.urlResolutionStatus,
  };
}

function safeUrlDetails(value) {
  const parsed = new URL(value);
  return {
    host: parsed.hostname.toLowerCase(),
    path: parsed.pathname,
  };
}

async function fetchPublisher(row) {
  const startedAt = Date.now();
  const signal = AbortSignal.timeout(ROW_HTTP_TIMEOUT_MS);
  let currentUrl = row.publisherUrl;
  let requestCount = 0;
  let redirectCount = 0;
  const stages = [];
  const state = {
    requestCount,
    redirectCount,
    httpStatus: null,
    normalizedMime: "unknown",
    bodyBytes: null,
  };
  const logStage = (stage, details) => logHttpStage(row.rowId, startedAt, state, stage, details);
  const abortObserver = () => logStage("abort_fired");
  let abortObserverAttached = false;

  try {
    try {
      signal.addEventListener("abort", abortObserver, { once: true });
      abortObserverAttached = true;
    } catch {
      // Observation is optional; attaching it must not change request behavior.
    }
    for (let redirectIndex = 0; redirectIndex <= MAX_REDIRECTS; redirectIndex += 1) {
      requestCount += 1;
      state.requestCount = requestCount;
      const current = new URL(currentUrl);
      if (!["http:", "https:"].includes(current.protocol)) {
        return {
          fetchStatus: "unsupported_scheme",
          fetchElapsedMs: Date.now() - startedAt,
          requestCount,
          redirectCount,
          stages,
        };
      }

      state.httpStatus = null;
      state.normalizedMime = "unknown";
      state.bodyBytes = null;
      logStage("request_start");
      const pendingResponse = fetch(currentUrl, {
        method: "GET",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 issue-41-b2-vanilla/1.0",
        },
        redirect: "manual",
        signal,
      });
      logStage("await_fetch");
      const response = await pendingResponse;
      const location = response.headers.get("location");
      stages.push({ status: response.status, host: current.hostname.toLowerCase() });
      state.httpStatus = response.status;
      state.normalizedMime = normalizedMime(response.headers.get("content-type"));
      logStage("response");

      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        logStage("redirect");
        await cancelResponseBody(response, logStage, "redirect");
        if (redirectIndex === MAX_REDIRECTS) {
          return {
            fetchStatus: "redirect_limit",
            httpStatus: response.status,
            fetchElapsedMs: Date.now() - startedAt,
            requestCount,
            redirectCount,
            stages,
          };
        }
        const nextUrl = new URL(location, currentUrl);
        if (!["http:", "https:"].includes(nextUrl.protocol)) {
          return {
            fetchStatus: "unsupported_redirect_scheme",
            httpStatus: response.status,
            fetchElapsedMs: Date.now() - startedAt,
            requestCount,
            redirectCount,
            stages,
          };
        }
        currentUrl = nextUrl.href;
        redirectCount += 1;
        state.redirectCount = redirectCount;
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const html = /\btext\/html\b|\bapplication\/xhtml\+xml\b/iu.test(contentType);
      const finalUrl = currentUrl;
      const final = safeUrlDetails(finalUrl);
      if (!response.ok) {
        await cancelResponseBody(response, logStage, "http_error");
        return {
          fetchStatus: [401, 403, 429].includes(response.status) ? "http_denied" : "http_error",
          httpStatus: response.status,
          contentType,
          finalHost: final.host,
          finalPath: final.path,
          fetchElapsedMs: Date.now() - startedAt,
          requestCount,
          redirectCount,
          stages,
        };
      }
      if (!html) {
        await cancelResponseBody(response, logStage, "non_html");
        return {
          fetchStatus: "non_html",
          httpStatus: response.status,
          contentType,
          finalHost: final.host,
          finalPath: final.path,
          fetchElapsedMs: Date.now() - startedAt,
          requestCount,
          redirectCount,
          stages,
        };
      }

      const body = await readBoundedBody(response, logStage);
      state.bodyBytes = body.length;
      if (body.length === 0) {
        return {
          fetchStatus: "empty_html",
          httpStatus: response.status,
          contentType,
          finalHost: final.host,
          finalPath: final.path,
          bodyBytes: 0,
          fetchElapsedMs: Date.now() - startedAt,
          requestCount,
          redirectCount,
          stages,
        };
      }
      return {
        fetchStatus: "eligible_html",
        httpStatus: response.status,
        contentType,
        finalUrl,
        finalHost: final.host,
        finalPath: final.path,
        body,
        bodyBytes: body.length,
        bodySha256: sha256(body),
        fetchElapsedMs: Date.now() - startedAt,
        requestCount,
        redirectCount,
        stages,
      };
    }
    throw Object.assign(new Error("Redirect loop ended unexpectedly"), { code: "REDIRECT_LIMIT" });
  } catch (error) {
    const safe = safeError(error);
    logStage("catch", { error: safe });
    return {
      fetchStatus:
        error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
          ? "timeout"
          : error?.code === "BODY_LIMIT"
            ? "body_limit"
            : "request_error",
      ...safe,
      fetchElapsedMs: Date.now() - startedAt,
      requestCount,
      redirectCount,
      stages,
    };
  } finally {
    if (abortObserverAttached) {
      try {
        signal.removeEventListener("abort", abortObserver);
      } catch {
        // Observer cleanup must not replace the original request result.
      }
    }
    logStage("cleanup");
  }
}

function extractArticle(body, finalUrl, contentType) {
  const startedAt = Date.now();
  const dom = new JSDOM(body, {
    url: finalUrl,
    contentType: domContentType(contentType),
  });
  try {
    let extractionMethod = "structured_article_body";
    let articleText = structuredArticleText(dom.window.document);
    if (!articleText) {
      extractionMethod = "mozilla_readability";
      const article = new Readability(dom.window.document, { disableJSONLD: true }).parse();
      articleText = normalizeText(article?.textContent);
    }
    const words = countWords(articleText || "");
    if (!articleText || words === 0) {
      return {
        fullTextStatus: "no_readable_text_candidate",
        extractionMethod,
        wordCount: 0,
        textCharacterCount: 0,
        extractionElapsedMs: Date.now() - startedAt,
      };
    }
    return {
      fullTextStatus: "success",
      extractionMethod,
      wordCount: words,
      textCharacterCount: articleText.length,
      textSha256: sha256(articleText),
      articleText,
      extractionElapsedMs: Date.now() - startedAt,
    };
  } finally {
    dom.window.close();
  }
}

async function processRow(row, sampleId) {
  const rowStart = Date.now();
  console.log(`ISSUE41_B2 sample=${sampleId} stage=row_start rowId=${row.rowId}`);
  const fetchResult = await fetchPublisher(row);
  console.log(
    `ISSUE41_B2 sample=${sampleId} stage=fetch_result rowId=${row.rowId} status=${fetchResult.fetchStatus} httpStatus=${fetchResult.httpStatus ?? "none"} requests=${fetchResult.requestCount} redirects=${fetchResult.redirectCount} elapsedMs=${fetchResult.fetchElapsedMs}`,
  );

  let extractionResult = {
    fullTextStatus: "not_attempted",
    extractionMethod: null,
    wordCount: 0,
    textCharacterCount: 0,
  };
  if (fetchResult.fetchStatus === "eligible_html") {
    try {
      extractionResult = extractArticle(
        fetchResult.body,
        fetchResult.finalUrl,
        fetchResult.contentType,
      );
      console.log(
        `ISSUE41_B2 sample=${sampleId} stage=extraction_result rowId=${row.rowId} status=${extractionResult.fullTextStatus} method=${extractionResult.extractionMethod ?? "none"} wordCount=${extractionResult.wordCount} elapsedMs=${extractionResult.extractionElapsedMs ?? 0}`,
      );
    } catch (error) {
      extractionResult = {
        fullTextStatus: "extraction_error",
        extractionMethod: null,
        wordCount: 0,
        textCharacterCount: 0,
        ...safeError(error),
      };
      console.log(
        `ISSUE41_B2 sample=${sampleId} stage=extraction_result rowId=${row.rowId} status=extraction_error errorClass=${extractionResult.errorClass} errorCode=${extractionResult.errorCode ?? "none"}`,
      );
    }
  } else {
    extractionResult.fullTextStatus = "not_attempted_fetch_ineligible";
    console.log(
      `ISSUE41_B2 sample=${sampleId} stage=extraction_result rowId=${row.rowId} status=not_attempted_fetch_ineligible wordCount=0`,
    );
  }

  const output = {
    evidenceType: "issue41_b2_vanilla_row",
    ...rowFields(row),
    publisherFetchStatus: fetchResult.fetchStatus,
    publisherHttpStatus: fetchResult.httpStatus ?? null,
    publisherContentType: fetchResult.contentType ?? null,
    publisherFinalHost: fetchResult.finalHost ?? null,
    publisherFinalPath: fetchResult.finalPath ?? null,
    publisherRedirectCount: fetchResult.redirectCount,
    publisherRequestCount: fetchResult.requestCount,
    publisherFetchElapsedMs: fetchResult.fetchElapsedMs,
    publisherBodyBytes: fetchResult.bodyBytes ?? null,
    publisherBodySha256: fetchResult.bodySha256 ?? null,
    publisherRedirectStages: fetchResult.stages,
    ...extractionResult,
    rowElapsedMs: Date.now() - rowStart,
  };
  delete output.body;
  return output;
}

let exitCode = 0;
let currentStage = "actor_start";
await Actor.init();
try {
  currentStage = "input_read";
  const input = await Actor.getInput();
  if (
    !input ||
    !["smoke", "acceptance"].includes(input.sampleId) ||
    !Array.isArray(input.rows) ||
    input.rows.length < 1 ||
    input.rows.length > MAX_ROWS
  ) {
    throw Object.assign(new Error("Input does not match the bounded sample contract"), {
      code: "INVALID_INPUT",
    });
  }
  const rowIds = input.rows.map((row) => row?.rowId);
  const expectedSmokeRows = ["q1-gb-01", "q1-gb-02", "q1-gb-05"];
  if (
    input.rowCount !== input.rows.length ||
    input.uniqueRowIds !== new Set(rowIds).size ||
    rowIds.some((id) => typeof id !== "string" || !/^[a-z0-9-]{1,32}$/iu.test(id)) ||
    new Set(rowIds).size !== rowIds.length ||
    (input.sampleId === "smoke" &&
      (input.rows.length !== expectedSmokeRows.length ||
        JSON.stringify(rowIds) !== JSON.stringify(expectedSmokeRows))) ||
    (input.sampleId === "acceptance" && input.rows.length !== MAX_ROWS) ||
    input.rows.some(
      (row) =>
        typeof row.publisherUrl !== "string" ||
        row.publisherUrl.length === 0 ||
        typeof row.googleNewsUrl !== "string" ||
        row.googleNewsUrl.length === 0 ||
        row.urlResolved !== true,
    )
  ) {
    throw Object.assign(new Error("Input rows must be unique resolved publisher records"), {
      code: "INVALID_ROWS",
    });
  }

  currentStage = "row_processing";
  console.log(
    `ISSUE41_B2 stage=run_start sample=${input.sampleId} totalRows=${input.rows.length} uniqueRowIds=${new Set(rowIds).size} uniquePublisherUrls=${new Set(input.rows.map((row) => row.publisherUrl)).size} duplicatePublisherUrlOccurrences=${input.rows.length - new Set(input.rows.map((row) => row.publisherUrl)).size} memoryMbytes=${process.env.APIFY_MEMORY_MBYTES ?? "unknown"}`,
  );
  const fetchCounts = {};
  const extractionCounts = {};
  let completedRows = 0;
  let processingFailures = 0;
  let writeFailures = 0;
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, input.rows.length) }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= input.rows.length) return;
        const row = input.rows[index];
        let outcome;
        try {
          outcome = await processRow(row, input.sampleId);
        } catch (error) {
          processingFailures += 1;
          const safe = safeError(error);
          console.error(
            `ISSUE41_B2 sample=${input.sampleId} stage=row_processing_failure rowId=${row.rowId} errorClass=${safe.errorClass} errorCode=${safe.errorCode ?? "none"}`,
          );
          outcome = {
            evidenceType: "issue41_b2_vanilla_row",
            ...rowFields(row),
            publisherFetchStatus: "not_attempted_processing_error",
            publisherHttpStatus: null,
            publisherContentType: null,
            publisherFinalHost: null,
            publisherFinalPath: null,
            publisherRedirectCount: 0,
            publisherRequestCount: 0,
            publisherFetchElapsedMs: 0,
            publisherBodyBytes: null,
            publisherBodySha256: null,
            fullTextStatus: "not_attempted_processing_error",
            extractionMethod: null,
            wordCount: 0,
            textCharacterCount: 0,
            errorClass: safe.errorClass,
            errorCode: safe.errorCode,
          };
        }
        fetchCounts[outcome.publisherFetchStatus] =
          (fetchCounts[outcome.publisherFetchStatus] || 0) + 1;
        extractionCounts[outcome.fullTextStatus] =
          (extractionCounts[outcome.fullTextStatus] || 0) + 1;
        try {
          console.log(
            `ISSUE41_B2 sample=${input.sampleId} stage=row_write_start rowId=${outcome.rowId}`,
          );
          await Actor.pushData(outcome);
          completedRows += 1;
          console.log(
            `ISSUE41_B2 sample=${input.sampleId} stage=row_write_result rowId=${outcome.rowId} status=written`,
          );
        } catch (error) {
          writeFailures += 1;
          const safe = safeError(error);
          console.error(
            `ISSUE41_B2 sample=${input.sampleId} stage=row_write_result rowId=${outcome.rowId} status=failed errorClass=${safe.errorClass} errorCode=${safe.errorCode ?? "none"}`,
          );
        }
      }
    }),
  );

  currentStage = "dataset_output";
  console.log(
    `ISSUE41_B2 stage=run_summary sample=${input.sampleId} inputRows=${input.rows.length} rowsWritten=${completedRows} processingFailures=${processingFailures} datasetWriteFailures=${writeFailures} fetchCounts=${JSON.stringify(fetchCounts)} extractionCounts=${JSON.stringify(extractionCounts)}`,
  );
  if (processingFailures > 0 || writeFailures > 0) exitCode = 1;
} catch (error) {
  const safe = safeError(error);
  console.error(
    `ISSUE41_B2 stage=run_failure currentStage=${currentStage} errorClass=${safe.errorClass} errorCode=${safe.errorCode ?? "none"}`,
  );
  exitCode = 1;
} finally {
  await Actor.exit({ exitCode });
}
