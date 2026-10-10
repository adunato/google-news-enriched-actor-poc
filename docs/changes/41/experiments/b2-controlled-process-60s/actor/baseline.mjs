/* global AbortSignal:readonly, Buffer:readonly, console:readonly, fetch:readonly, process:readonly */
import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { domContentType } from "./dom-content-type.mjs";
import { cancelResponseBody, readBoundedBody } from "./body-stream.mjs";

const MAX_ROWS = 100;
const MAX_REDIRECTS = 5;
const ROW_HTTP_TIMEOUT_MS = 10_000;
const CONCURRENCY = 4;
const R2_RESERVED_EVENTS = new Set([
  "signal_created",
  "body_reader_acquired",
  "body_read_entered",
  "body_read_completed",
  "abort_fired",
  "reader_closed_settled",
  "post_abort_snapshot",
  "post_abort_inflight_read_settled",
  "post_abort_cancel_enter",
  "post_abort_cancel_settled",
  "cleanup_enter",
  "cleanup_settled",
  "catch",
  "fetch_result",
  "row_write",
  "row_terminal",
]);
const R2_TRACE_BY_ROW = new Map();
let r2WorkerJoins = 0;
let r2RunSummaryLogged = false;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function logR2Global(stage) {
  try {
    if (stage === "worker_join") {
      if (r2WorkerJoins >= CONCURRENCY) return;
      r2WorkerJoins += 1;
    } else if (stage === "run_summary") {
      if (r2RunSummaryLogged) return;
      r2RunSummaryLogged = true;
    } else {
      return;
    }
    console.log(
      `ISSUE41_B2_R2 ${JSON.stringify({ stage, elapsedMs: Date.now() - r2RunStartedAt })}`,
    );
  } catch {
    // R2 observation must never affect Actor execution.
  }
}

let r2RunStartedAt = Date.now();

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

function logMemorySnapshot(rowId, rowStartedAt, stage) {
  try {
    const memory = process.memoryUsage();
    console.log(
      `ISSUE41_B2_M3 ${JSON.stringify({
        rowId,
        stage,
        elapsedMs: Date.now() - rowStartedAt,
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers,
      })}`,
    );
  } catch {
    // Diagnostic snapshots must never affect the Actor's work.
  }
}

function createR2Trace(rowId, rowStartedAt) {
  const reserved = new Set();
  let optionalEvents = 0;
  let readIndex = 0;
  let readInFlight = false;
  let currentPhase = "row_start";
  let signalCreationTime = null;
  let abortFireTime = null;
  let readerClosedState = "pending";
  let postAbortTimer = null;
  let postAbortSnapshotLogged = false;

  const record = (stage, error = null) => {
    try {
      const isReserved = R2_RESERVED_EVENTS.has(stage);
      if (isReserved) {
        if (reserved.has(stage)) return;
        reserved.add(stage);
      } else {
        if (optionalEvents >= 8) return;
        optionalEvents += 1;
      }
      const safe = error ? safeError(error) : null;
      console.log(
        `ISSUE41_B2_R2 ${JSON.stringify({
          rowId,
          stage,
          elapsedMs: Date.now() - rowStartedAt,
          signalCreationTime,
          abortFireTime,
          readIndex,
          readInFlight,
          currentPhase,
          readerClosedState,
          sanitizedErrorClass: safe?.errorClass ?? "none",
          sanitizedErrorCode: safe?.errorCode ?? "none",
        })}`,
      );
    } catch {
      // R2 observation must never affect row processing.
    }
  };

  return {
    record,
    setPhase(phase) {
      currentPhase = phase;
    },
    signalCreated() {
      try {
        signalCreationTime = Date.now() - rowStartedAt;
        currentPhase = "fetch";
        record("signal_created");
      } catch {
        // Signal metadata observation must not affect the request.
      }
    },
    abortFired() {
      try {
        abortFireTime = Date.now() - rowStartedAt;
        currentPhase = "abort_fired";
        record("abort_fired");
        if (postAbortTimer === null && !postAbortSnapshotLogged) {
          postAbortTimer = setTimeout(() => {
            postAbortTimer = null;
            postAbortSnapshotLogged = true;
            currentPhase = "post_abort_observation";
            record("post_abort_snapshot");
          }, 2_000);
          postAbortTimer.unref?.();
        }
      } catch {
        // Timer observation must never affect abort handling.
      }
    },
    readerAcquired(reader) {
      currentPhase = "body_reader_acquired";
      let setupError = null;
      let observerEnabled = false;
      try {
        const closed = reader.closed;
        const observer = closed.then(
          () => {
            if (!observerEnabled) return;
            readerClosedState = "fulfilled";
            currentPhase = "reader_closed_settled";
            record("reader_closed_settled");
          },
          (error) => {
            if (!observerEnabled) return;
            readerClosedState = "rejected";
            currentPhase = "reader_closed_settled";
            record("reader_closed_settled", error);
          },
        );
        observer.catch(() => {});
        observerEnabled = true;
      } catch (error) {
        readerClosedState = undefined;
        currentPhase = "body_reader_observer_setup_failed";
        setupError = error;
      }
      record("body_reader_acquired", setupError);
    },
    readEntered() {
      readIndex += 1;
      readInFlight = true;
      currentPhase = "body_read_in_flight";
      record("body_read_entered");
    },
    readSettled(error = null) {
      const wasInFlightAfterAbort = abortFireTime !== null && readInFlight;
      readInFlight = false;
      currentPhase = error ? "body_read_rejected" : "body_read_settled";
      if (wasInFlightAfterAbort) record("post_abort_inflight_read_settled", error);
      if (error) record("catch", error);
    },
    bodyReadCompleted() {
      currentPhase = "body_read_completed";
      record("body_read_completed");
    },
    cancelEntered() {
      currentPhase = "cancel_in_flight";
      if (abortFireTime !== null) record("post_abort_cancel_enter");
      else record("cancel_enter");
    },
    cancelSettled(error = null) {
      currentPhase = error ? "cancel_rejected" : "cancel_settled";
      if (abortFireTime !== null) record("post_abort_cancel_settled", error);
      else record("cancel_settled", error);
    },
    terminal() {
      const cancelledPostAbortSnapshot = postAbortTimer !== null;
      try {
        if (postAbortTimer !== null) clearTimeout(postAbortTimer);
      } catch {
        // Timer cleanup is observational and must not affect row completion.
      }
      postAbortTimer = null;
      currentPhase =
        abortFireTime !== null && cancelledPostAbortSnapshot
          ? "row_terminal_post_abort_snapshot_cancelled"
          : "row_terminal";
      record("row_terminal");
    },
  };
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

async function fetchPublisher(row, rowStartedAt, r2Trace, timing = () => {}) {
  const startedAt = Date.now();
  const signal = AbortSignal.timeout(ROW_HTTP_TIMEOUT_MS);
  r2Trace?.signalCreated();
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
  const abortObserver = () => {
    logStage("abort_fired");
    r2Trace?.abortFired();
  };
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
      if (redirectIndex > 0) r2Trace?.record("redirect_request");
      logMemorySnapshot(row.rowId, rowStartedAt, "fetch_before");
      if (requestCount === 1) timing('http_request_start');
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
      logMemorySnapshot(row.rowId, rowStartedAt, "fetch_after");
      const location = response.headers.get("location");
      stages.push({ status: response.status, host: current.hostname.toLowerCase() });
      state.httpStatus = response.status;
      state.normalizedMime = normalizedMime(response.headers.get("content-type"));
      logStage("response");
      r2Trace?.record("response");

      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        logStage("redirect");
        r2Trace?.record("redirect");
        await cancelResponseBody(response, logStage, "redirect", r2Trace);
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
        await cancelResponseBody(response, logStage, "http_error", r2Trace);
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
        await cancelResponseBody(response, logStage, "non_html", r2Trace);
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

      timing('body_read_start');
      const body = await readBoundedBody(response, logStage, r2Trace);
      timing('body_read_end');
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
    r2Trace?.record("catch", error);
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
    r2Trace?.setPhase("cleanup_enter");
    r2Trace?.record("cleanup_enter");
    if (abortObserverAttached) {
      try {
        signal.removeEventListener("abort", abortObserver);
      } catch {
        // Observer cleanup must not replace the original request result.
      }
    }
    logStage("cleanup");
    r2Trace?.setPhase("cleanup_settled");
    r2Trace?.record("cleanup_settled");
  }
}

function extractArticle(body, finalUrl, contentType, rowId, rowStartedAt) {
  const startedAt = Date.now();
  logMemorySnapshot(rowId, rowStartedAt, "jsdom_construction_before");
  const dom = new JSDOM(body, {
    url: finalUrl,
    contentType: domContentType(contentType),
  });
  logMemorySnapshot(rowId, rowStartedAt, "jsdom_construction_after");
  try {
    let extractionMethod = "structured_article_body";
    logMemorySnapshot(rowId, rowStartedAt, "jsonld_before");
    let articleText = structuredArticleText(dom.window.document);
    logMemorySnapshot(rowId, rowStartedAt, "jsonld_after");
    if (!articleText) {
      extractionMethod = "mozilla_readability";
      logMemorySnapshot(rowId, rowStartedAt, "readability_before");
      const article = new Readability(dom.window.document, { disableJSONLD: true }).parse();
      logMemorySnapshot(rowId, rowStartedAt, "readability_after");
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
    logMemorySnapshot(rowId, rowStartedAt, "dom_close_before");
    dom.window.close();
    logMemorySnapshot(rowId, rowStartedAt, "dom_close_after");
  }
}

export async function processRow(row, sampleId, timing = () => {}) {
  const rowStart = Date.now();
  const r2Trace = createR2Trace(row.rowId, rowStart);
  R2_TRACE_BY_ROW.set(row.rowId, r2Trace);
  r2Trace.setPhase("row_start");
  logMemorySnapshot(row.rowId, rowStart, "row_start");
  console.log(`ISSUE41_B2 sample=${sampleId} stage=row_start rowId=${row.rowId}`);
  timing('fetch_start');
  const fetchResult = await fetchPublisher(row, rowStart, r2Trace, timing);
  r2Trace.setPhase("fetch_result");
  r2Trace.record("fetch_result");
  logMemorySnapshot(row.rowId, rowStart, "fetch_complete");
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
      r2Trace.setPhase("extraction");
      timing('extract_start');
      extractionResult = extractArticle(
        fetchResult.body,
        fetchResult.finalUrl,
        fetchResult.contentType,
        row.rowId,
        rowStart,
      );
      timing('extract_end');
      console.log(
        `ISSUE41_B2 sample=${sampleId} stage=extraction_result rowId=${row.rowId} status=${extractionResult.fullTextStatus} method=${extractionResult.extractionMethod ?? "none"} wordCount=${extractionResult.wordCount} elapsedMs=${extractionResult.extractionElapsedMs ?? 0}`,
      );
      r2Trace.setPhase("extraction_result");
    } catch (error) {
      r2Trace.setPhase("extraction_error");
      r2Trace.record("catch", error);
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
    r2Trace.setPhase("extraction_not_attempted");
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
  logMemorySnapshot(row.rowId, rowStart, "row_end");
  timing('row_terminal');
  return output;
}


