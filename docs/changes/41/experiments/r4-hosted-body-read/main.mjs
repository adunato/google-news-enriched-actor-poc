/* global AbortSignal:readonly, Buffer:readonly, console:readonly, fetch:readonly, process:readonly */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Readability } from "@mozilla/readability";
import { Actor } from "apify";
import { JSDOM } from "jsdom";
import { domContentType } from "./dom-content-type.mjs";

const MAX_ROWS = 100;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const ROW_HTTP_TIMEOUT_MS = 10_000;
const CONCURRENCY = 4;
const R4_MAX_MARKERS_PER_ROW = 40;
const R4_MAX_MARKERS_TOTAL = 4006;
const R4_MAX_MARKER_BYTES = 4 * 1024 * 1024;
const R4_MAX_MARKER_BYTES_PER_RECORD = 768;
const R4_MAX_ATTEMPT_MARKERS_PER_ROW = 12;
const R4_MAX_LIFECYCLE_MARKERS_PER_ROW = 16;
const R4_MAX_SNAPSHOTS_PER_ROW = 2;
const R4_LIFECYCLE_EVENTS = new Set([
  "row_start",
  "signal_created",
  "abort_delivered",
  "body_reader_acquired",
  "body_read_entered",
  "body_read_settled",
  "reader_closed_settled",
  "cancel_enter",
  "cancel_settled",
  "cleanup_enter",
  "cleanup_settled",
  "fetch_result",
  "catch",
  "extraction_enter",
  "extraction_exit",
  "dataset_write",
]);
const R4_TRACE_BY_ROW = new Map();
const r4RunStart = performance.now();
const r4MarkerTotals = { attempted: 0, emitted: 0, dropped: 0, deduplicated: 0, bytes: 0 };
let r4WorkerJoins = 0;
let r4RunSummaryLogged = false;
let r4GlobalOverflowLogged = false;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function emitR4Record(record, rowCounters = null, reserved = false, includeProspectiveRowTotals = false) {
  try {
    r4MarkerTotals.attempted += 1;
    if (rowCounters) rowCounters.attempted += 1;
    let bytes = 0;
    let line = "";
    if (includeProspectiveRowTotals && rowCounters) {
      let projectedBytes = rowCounters.bytes;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        record.state.counters = {
          attempted: rowCounters.attempted,
          emitted: rowCounters.emitted + 1,
          dropped: rowCounters.dropped,
          deduplicated: rowCounters.deduplicated,
          bytes: projectedBytes,
        };
        line = `ISSUE41_R4 ${JSON.stringify(record)}`;
        bytes = Buffer.byteLength(line, "utf8") + 1;
        const nextBytes = rowCounters.bytes + bytes;
        if (nextBytes === projectedBytes) break;
        projectedBytes = nextBytes;
      }
      record.state.counters.bytes = rowCounters.bytes + bytes;
      line = `ISSUE41_R4 ${JSON.stringify(record)}`;
      bytes = Buffer.byteLength(line, "utf8") + 1;
    } else {
      line = `ISSUE41_R4 ${JSON.stringify(record)}`;
      bytes = Buffer.byteLength(line, "utf8") + 1;
    }
    const rowLimitExceeded = rowCounters && rowCounters.emitted >= R4_MAX_MARKERS_PER_ROW;
    if (
      bytes > R4_MAX_MARKER_BYTES_PER_RECORD ||
      r4MarkerTotals.emitted >= R4_MAX_MARKERS_TOTAL ||
      r4MarkerTotals.bytes + bytes > R4_MAX_MARKER_BYTES ||
      (rowLimitExceeded && !reserved)
    ) {
      r4MarkerTotals.dropped += 1;
      if (rowCounters) rowCounters.dropped += 1;
      if (record.event !== "global_overflow" && !r4GlobalOverflowLogged) {
        logR4Global("global_overflow");
      }
      return false;
    }
    console.log(line);
    r4MarkerTotals.emitted += 1;
    r4MarkerTotals.bytes += bytes;
    if (rowCounters) {
      rowCounters.emitted += 1;
      rowCounters.bytes += bytes;
    }
    return true;
  } catch {
    r4MarkerTotals.dropped += 1;
    if (rowCounters) rowCounters.dropped += 1;
    return false;
  }
}

function logR4Global(event) {
  try {
    if (event === "worker_join") {
      if (r4WorkerJoins >= CONCURRENCY) return;
      r4WorkerJoins += 1;
    } else if (event === "run_summary") {
      if (r4RunSummaryLogged) return;
      r4RunSummaryLogged = true;
    } else if (event === "global_overflow") {
      if (r4GlobalOverflowLogged) return;
      r4GlobalOverflowLogged = true;
    } else {
      return;
    }
    const markerState = {
      attempted: r4MarkerTotals.attempted,
      emitted: r4MarkerTotals.emitted,
      dropped: r4MarkerTotals.dropped,
      deduplicated: r4MarkerTotals.deduplicated,
      bytes: r4MarkerTotals.bytes,
      droppedGlobalOverflow: r4GlobalOverflowLogged,
    };
    if (event === "run_summary") {
      markerState.attempted += 1;
      markerState.emitted += 1;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const probe = {
          rowId: "run",
          attemptOrdinal: null,
          sequence: r4MarkerTotals.attempted + 1,
          elapsedMs: Math.max(0, Math.round(performance.now() - r4RunStart)),
          event,
          phase: event,
          state: markerState,
        };
        markerState.bytes = r4MarkerTotals.bytes + Buffer.byteLength(`ISSUE41_R4 ${JSON.stringify(probe)}`, "utf8") + 1;
      }
    }
    emitR4Record(
      {
        rowId: "run",
        attemptOrdinal: null,
        sequence: event === "worker_join" ? r4WorkerJoins : r4MarkerTotals.attempted + 1,
        elapsedMs: Math.max(0, Math.round(performance.now() - r4RunStart)),
        event,
        phase: event,
        state: markerState,
      },
      null,
      event === "global_overflow",
    );
  } catch {
    // R4 summary observation must never affect Actor execution.
  }
}

function safeError(error) {
  try {
    const name =
      error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,39}$/u.test(error.name)
        ? error.name
        : "UnknownError";
    const code =
      error && typeof error.code === "string" && /^[A-Za-z0-9_-]{1,40}$/u.test(error.code)
        ? error.code
        : null;
    return { errorClass: name, errorCode: code };
  } catch {
    return { errorClass: "UnknownError", errorCode: null };
  }
}

function normalizedMime(contentType) {
  const mime = String(contentType || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(mime) ? mime : "unknown";
}

function mediaTypeClass(contentType) {
  const mime = normalizedMime(contentType);
  if (mime === "text/html") return "html";
  if (mime === "application/xhtml+xml") return "xhtml";
  if (mime.startsWith("text/")) return "other_text";
  return mime === "unknown" ? "unknown" : "other";
}

function createR4Trace(rowId, rowStartedAt) {
  const counters = { attempted: 0, emitted: 0, dropped: 0, deduplicated: 0, bytes: 0 };
  const lifecycle = new Set();
  const timers = [];
  let requestAttemptMarkers = 0;
  let snapshotCount = 0;
  let sequence = 0;
  let currentPhase = "row_start";
  let signal = null;
  let abortDeliveredAt = null;
  let readerClosedState = "not_acquired";
  let readIndex = 0;
  let readInFlight = false;
  let cumulativeBodyBytes = 0;
  let lastEventAt = performance.now();
  let cancellationPending = false;
  let cleanupPending = false;
  let rowOverflowLogged = false;

  const emitOverflow = (reason) => {
    if (rowOverflowLogged) return false;
    rowOverflowLogged = true;
    emit("row_overflow", { state: { reason, counters: { ...counters } } }, "reserved", true);
    return false;
  };
  const dropAttempt = (reason) => {
    counters.attempted += 1;
    counters.dropped += 1;
    r4MarkerTotals.attempted += 1;
    r4MarkerTotals.dropped += 1;
    return emitOverflow(reason);
  };

  const elapsed = () => Math.max(0, Math.round(performance.now() - r4RunStart));
  const state = (extra = {}) => ({
    signalAborted: Boolean(signal?.aborted),
    requestPending: currentPhase === "request_pending",
    readIndex,
    readInFlight,
    readerClosedState,
    cancellationPending,
    cleanupPending,
    cumulativeBodyBytes,
    lastEventAgeMs: Math.max(0, Math.round(performance.now() - lastEventAt)),
    ...extra,
  });
  const emit = (event, extra = {}, category = "lifecycle", reserved = false) => {
    if (category === "attempt") {
      if (requestAttemptMarkers >= R4_MAX_ATTEMPT_MARKERS_PER_ROW) {
        return dropAttempt("request_attempt_marker_cap");
      }
      requestAttemptMarkers += 1;
    } else if (category === "snapshot") {
      if (snapshotCount >= R4_MAX_SNAPSHOTS_PER_ROW) {
        return dropAttempt("snapshot_marker_cap");
      }
      snapshotCount += 1;
    } else if (category === "lifecycle") {
      if (!R4_LIFECYCLE_EVENTS.has(event)) return dropAttempt("unrecognized_lifecycle_event");
      if (lifecycle.has(event)) {
        // Expected one-per-row deduplication is tracked separately, not as an attempted marker.
        counters.deduplicated += 1;
        r4MarkerTotals.deduplicated += 1;
        return false;
      }
      if (lifecycle.size >= R4_MAX_LIFECYCLE_MARKERS_PER_ROW) {
        return dropAttempt("lifecycle_marker_cap");
      }
    }
    sequence += 1;
    if (category !== "snapshot") lastEventAt = performance.now();
    const emitted = emitR4Record(
      {
        rowId,
        attemptOrdinal: extra.attemptOrdinal ?? null,
        sequence,
        elapsedMs: elapsed(),
        event,
        phase: currentPhase,
        state: state(extra.state ?? {}),
      },
      counters,
      reserved,
      event === "row_terminal",
    );
    if (emitted && category === "lifecycle") lifecycle.add(event);
    if (!emitted && !rowOverflowLogged && event !== "row_overflow") {
      emitOverflow("record_or_byte_cap");
    }
    return emitted;
  };
  const isPending = () =>
    currentPhase === "request_pending" ||
    readInFlight ||
    readerClosedState === "pending" ||
    cancellationPending ||
    cleanupPending;

  const trace = {
    record(event, error = null, stateExtra = {}) {
      const safe = error ? safeError(error) : null;
      emit(event, {
        state: {
          ...stateExtra,
          errorClass: safe?.errorClass ?? "none",
          errorCode: safe?.errorCode ?? "none",
        },
      });
    },
    setPhase(phase) {
      currentPhase = phase;
    },
    signalCreated(value) {
      signal = value;
      currentPhase = "fetch";
      emit("signal_created", { state: { signalCreatedElapsedMs: elapsed() } });
    },
    abortFired() {
      try {
        abortDeliveredAt = performance.now();
        emit("abort_delivered", { state: { abortElapsedMs: elapsed() } });
        for (const scheduledMs of [2_000, 30_000]) {
          const timer = setTimeout(() => {
            if (!isPending()) return;
            const actualMs = Math.max(0, Math.round(performance.now() - abortDeliveredAt));
            emit(
              `post_abort_snapshot_${scheduledMs}`,
              {
                state: {
                  snapshotScheduledMs: scheduledMs,
                  snapshotActualMs: actualMs,
                  timerDelayMs: actualMs - scheduledMs,
                  actualPhaseAtSnapshot: currentPhase,
                },
              },
              "snapshot",
            );
          }, scheduledMs);
          timer.unref?.();
          timers.push(timer);
        }
      } catch {
        // Snapshot scheduling must never affect abort handling.
      }
    },
    attemptStarted(attemptOrdinal, redirectCount) {
      currentPhase = "request_pending";
      emit("request_attempt_start", { attemptOrdinal, state: { redirectCount } }, "attempt");
    },
    attemptEnded(attemptOrdinal, response, error = null, redirectCount = 0) {
      try {
        const safe = error ? safeError(error) : null;
        currentPhase = response ? "response_received" : "request_failed";
        emit(
          "request_attempt_end",
          {
            attemptOrdinal,
            state: {
              responseStatus: response?.status ?? null,
              mediaTypeClass: mediaTypeClass(response?.headers?.get("content-type")),
              redirectCount,
              errorClass: safe?.errorClass ?? "none",
              errorCode: safe?.errorCode ?? "none",
            },
          },
          "attempt",
        );
      } catch {
        // Request-result observation must never affect publisher request handling.
      }
    },
    readerAcquired(reader) {
      currentPhase = "body_reader_acquired";
      readerClosedState = "pending";
      let setupError = null;
      let observerEnabled = false;
      try {
        const closed = reader.closed;
        const observer = closed.then(
          () => {
            if (!observerEnabled) return;
            readerClosedState = "fulfilled";
            emit("reader_closed_settled");
          },
          (error) => {
            if (!observerEnabled) return;
            readerClosedState = "rejected";
            trace.record("reader_closed_settled", error);
          },
        );
        observer.catch(() => {});
        observerEnabled = true;
      } catch (error) {
        readerClosedState = "unknown";
        setupError = error;
      }
      emit("body_reader_acquired", { state: { errorClass: setupError ? safeError(setupError).errorClass : "none" } });
    },
    readEntered() {
      readIndex += 1;
      readInFlight = true;
      currentPhase = "body_read_in_flight";
      if (readIndex === 1) emit("body_read_entered");
      else lastEventAt = performance.now();
    },
    readSettled(error = null, chunkBytes = 0) {
      readInFlight = false;
      cumulativeBodyBytes += chunkBytes;
      currentPhase = error ? "body_read_rejected" : "body_read_settled";
      lastEventAt = performance.now();
    },
    bodyReadCompleted(byteCount) {
      cumulativeBodyBytes = Math.max(cumulativeBodyBytes, byteCount);
      currentPhase = "body_read_completed";
      trace.record("body_read_settled", null, { outcome: "completed" });
    },
    bodyReadFailed(error) {
      currentPhase = "body_read_rejected";
      trace.record("body_read_settled", error, { outcome: "rejected" });
    },
    cancelEntered() {
      cancellationPending = true;
      currentPhase = "cancel_in_flight";
      emit("cancel_enter");
    },
    cancelSettled(error = null) {
      cancellationPending = false;
      currentPhase = error ? "cancel_rejected" : "cancel_settled";
      if (!lifecycle.has("cancel_settled")) trace.record("cancel_settled", error);
    },
    cleanupEntered() {
      cleanupPending = true;
      currentPhase = "cleanup_pending";
      emit("cleanup_enter");
    },
    cleanupSettled() {
      cleanupPending = false;
      currentPhase = "cleanup_settled";
      emit("cleanup_settled");
    },
    terminal() {
      try {
        for (const timer of timers) clearTimeout(timer);
      } catch {
        // Timer cleanup must never affect row completion.
      }
      currentPhase = "row_terminal";
      emit("row_terminal", { state: {} }, "reserved", true);
    },
  };
  emit("row_start", { state: { rowStartedElapsedMs: Math.max(0, Math.round(performance.now() - rowStartedAt)) } });
  return trace;
}

async function cancelResponseBody(response, r4Trace) {
  r4Trace?.cancelEntered();
  try {
    await response.body?.cancel();
    r4Trace?.cancelSettled();
  } catch (error) {
    r4Trace?.cancelSettled(error);
    throw error;
  }
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

async function readBoundedBody(response, r4Trace) {
  r4Trace?.setPhase("body_read_start");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    await cancelResponseBody(response, r4Trace);
    throw Object.assign(new Error("Response exceeds the configured body bound"), {
      code: "BODY_LIMIT",
    });
  }
  if (!response.body) {
    r4Trace?.bodyReadCompleted(0);
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  r4Trace?.readerAcquired(reader);
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      r4Trace?.readEntered();
      let readResult;
      try {
        readResult = await reader.read();
        r4Trace?.readSettled(null, readResult?.value?.byteLength ?? 0);
      } catch (error) {
        r4Trace?.readSettled(error);
        throw error;
      }
      const { done, value } = readResult;
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        r4Trace?.cancelEntered();
        try {
          await reader.cancel();
          r4Trace?.cancelSettled();
        } catch (error) {
          r4Trace?.cancelSettled(error);
          throw error;
        }
        throw Object.assign(new Error("Response exceeds the configured body bound"), {
          code: "BODY_LIMIT",
        });
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    r4Trace?.bodyReadFailed(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
  r4Trace?.bodyReadCompleted(byteLength);
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

async function fetchPublisher(row, r4Trace) {
  const startedAt = Date.now();
  const signal = AbortSignal.timeout(ROW_HTTP_TIMEOUT_MS);
  r4Trace?.signalCreated(signal);
  let currentUrl = row.publisherUrl;
  let requestCount = 0;
  let redirectCount = 0;
  const stages = [];
  const abortObserver = () => {
    r4Trace?.abortFired();
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

      r4Trace?.attemptStarted(requestCount, redirectCount);
      let response;
      try {
        response = await fetch(currentUrl, {
          method: "GET",
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent": "Mozilla/5.0 issue-41-b2-vanilla/1.0",
          },
          redirect: "manual",
          signal,
        });
        r4Trace?.attemptEnded(requestCount, response, null, redirectCount);
      } catch (error) {
        r4Trace?.attemptEnded(requestCount, null, error, redirectCount);
        throw error;
      }
      const location = response.headers.get("location");
      stages.push({ status: response.status, host: current.hostname.toLowerCase() });

      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        await cancelResponseBody(response, r4Trace);
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
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const html = /\btext\/html\b|\bapplication\/xhtml\+xml\b/iu.test(contentType);
      const finalUrl = currentUrl;
      const final = safeUrlDetails(finalUrl);
      if (!response.ok) {
        await cancelResponseBody(response, r4Trace);
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
        await cancelResponseBody(response, r4Trace);
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

      const body = await readBoundedBody(response, r4Trace);
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
    r4Trace?.record("catch", error);
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
    r4Trace?.cleanupEntered();
    if (abortObserverAttached) {
      try {
        signal.removeEventListener("abort", abortObserver);
      } catch {
        // Observer cleanup must not replace the original request result.
      }
    }
    r4Trace?.cleanupSettled();
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
  const r4Trace = createR4Trace(row.rowId, rowStart);
  R4_TRACE_BY_ROW.set(row.rowId, r4Trace);
  console.log(`ISSUE41_B2 sample=${sampleId} stage=row_start rowId=${row.rowId}`);
  const fetchResult = await fetchPublisher(row, r4Trace);
  r4Trace.setPhase("fetch_result");
  r4Trace.record("fetch_result", null, {
    httpStatus: fetchResult.httpStatus ?? null,
    mediaTypeClass: mediaTypeClass(fetchResult.contentType),
    redirectCount: fetchResult.redirectCount,
    cumulativeBodyBytes: fetchResult.bodyBytes ?? 0,
    fetchStatus: fetchResult.fetchStatus,
  });
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
      r4Trace.setPhase("extraction_pending");
      r4Trace.record("extraction_enter");
      extractionResult = extractArticle(
        fetchResult.body,
        fetchResult.finalUrl,
        fetchResult.contentType,
      );
      console.log(
        `ISSUE41_B2 sample=${sampleId} stage=extraction_result rowId=${row.rowId} status=${extractionResult.fullTextStatus} method=${extractionResult.extractionMethod ?? "none"} wordCount=${extractionResult.wordCount} elapsedMs=${extractionResult.extractionElapsedMs ?? 0}`,
      );
      r4Trace.setPhase("extraction_complete");
      r4Trace.record("extraction_exit", null, { extractionStatus: extractionResult.fullTextStatus });
    } catch (error) {
      r4Trace.setPhase("extraction_error");
      r4Trace.record("catch", error);
      r4Trace.record("extraction_exit", error, { extractionStatus: "error" });
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
    r4Trace.setPhase("extraction_not_attempted");
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
    `ISSUE41_B2 stage=run_start sample=${input.sampleId} totalRows=${input.rows.length} uniqueRowIds=${new Set(rowIds).size} uniquePublisherUrls=${new Set(input.rows.map((row) => row.publisherUrl)).size} duplicatePublisherUrlOccurrences=${input.rows.length - new Set(input.rows.map((row) => row.publisherUrl)).size} memoryMbytes=${process.env.APIFY_MEMORY_MBYTES ?? "unknown"} nodeVersion=${process.version} undiciVersion=${process.versions.undici ?? "unknown"}`,
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
        if (index >= input.rows.length) {
          logR4Global("worker_join");
          return;
        }
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
          const r4Trace = R4_TRACE_BY_ROW.get(row.rowId);
          r4Trace?.setPhase("dataset_write_pending");
          r4Trace?.record("dataset_write", null, { writeState: "pending" });
          console.log(
            `ISSUE41_B2 sample=${input.sampleId} stage=row_write_start rowId=${outcome.rowId}`,
          );
          await Actor.pushData(outcome);
          completedRows += 1;
          console.log(
            `ISSUE41_B2 sample=${input.sampleId} stage=row_write_result rowId=${outcome.rowId} status=written`,
          );
        } catch (error) {
          const r4Trace = R4_TRACE_BY_ROW.get(row.rowId);
          r4Trace?.setPhase("dataset_write_error");
          r4Trace?.record("catch", error);
          writeFailures += 1;
          const safe = safeError(error);
          console.error(
            `ISSUE41_B2 sample=${input.sampleId} stage=row_write_result rowId=${outcome.rowId} status=failed errorClass=${safe.errorClass} errorCode=${safe.errorCode ?? "none"}`,
          );
        }
        const r4Trace = R4_TRACE_BY_ROW.get(row.rowId);
        r4Trace?.terminal();
        R4_TRACE_BY_ROW.delete(row.rowId);
      }
    }),
  );

  currentStage = "dataset_output";
  console.log(
    `ISSUE41_B2 stage=run_summary sample=${input.sampleId} inputRows=${input.rows.length} rowsWritten=${completedRows} processingFailures=${processingFailures} datasetWriteFailures=${writeFailures} fetchCounts=${JSON.stringify(fetchCounts)} extractionCounts=${JSON.stringify(extractionCounts)}`,
  );
  logR4Global("run_summary");
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
