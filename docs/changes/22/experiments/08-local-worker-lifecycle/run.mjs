import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { caseMatrix, createFixture } from "./fixtures.mjs";
import { classifyExtractedContent } from "../07-hosted-eligibility/src/readability-proxy.mjs";

export const CASE_DEADLINE_MS = 5000;
export const TOTAL_DEADLINE_MS = 90_000;
export const MAX_INPUT_BYTES = 256 * 1024;
export const MAX_OUTPUT_CHARS = 1_048_576;
export const MAX_RSS_BYTES = 256 * 1024 * 1024;

let parentNetworkAttempts = 0;
function blockNetwork() {
  parentNetworkAttempts += 1;
  throw new Error("local_network_disabled");
}
globalThis.fetch = blockNetwork;
http.request = blockNetwork;
http.get = blockNetwork;
https.request = blockNetwork;
https.get = blockNetwork;
net.connect = blockNetwork;
net.createConnection = blockNetwork;
net.Socket.prototype.connect = blockNetwork;
dns.lookup = blockNetwork;
dns.resolve = blockNetwork;
dns.resolve4 = blockNetwork;
dns.resolve6 = blockNetwork;

function roundMs(value) {
  return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(3)) : null;
}

function safeCaseRecord({
  caseId,
  shape,
  targetBytes,
  inputBytes,
  status,
  lastStage,
  timeoutStage = null,
  startupMs = null,
  importMs = null,
  extractMs = null,
  resultDeliveryMs = null,
  parentScoringMs = null,
  exitAfterResultMs = null,
  totalMs,
  exitClass,
  outputChars = null,
  proxyStatus = null,
  proxyWordCount = null,
  proxySegmentCount = null,
  proxyFivegramUniqueness = null,
  networkAttempts = null,
  rssBytes,
  stopReason = null,
}) {
  return {
    caseId,
    shape,
    targetBytes,
    inputBytes,
    status,
    lastStage,
    timeoutStage,
    startupMs: roundMs(startupMs),
    importMs: roundMs(importMs),
    extractMs: roundMs(extractMs),
    resultDeliveryMs: roundMs(resultDeliveryMs),
    parentScoringMs: roundMs(parentScoringMs),
    exitAfterResultMs: roundMs(exitAfterResultMs),
    totalMs: roundMs(totalMs),
    exitClass,
    outputChars,
    proxyStatus,
    proxyWordCount,
    proxySegmentCount,
    proxyFivegramUniqueness,
    networkAttempts,
    rssBytes,
    stopReason,
  };
}

export function executeCase({
  caseId,
  shape,
  targetBytes,
  html,
  deadlineMs = CASE_DEADLINE_MS,
  WorkerClass = Worker,
  onWorker = () => {},
  getStopReason = () => null,
  onNetworkAttempt = () => {},
}) {
  const inputBytes = Buffer.byteLength(html, "utf8");
  assert(inputBytes <= MAX_INPUT_BYTES, "case_input_over_cap");
  const startedAt = performance.now();
  const deadlineAt = startedAt + deadlineMs;
  const worker = new WorkerClass(new URL("./worker.mjs", import.meta.url), {
    workerData: { html, url: `https://fixture.invalid/${caseId}` },
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  onWorker(worker);

  return new Promise((resolve) => {
    let settled = false;
    let lastStage = "startup";
    let startupMs = null;
    let importMs = null;
    let extractMs = null;
    let parseCompleteAt = null;
    let resultAt = null;
    let resultDeliveryMs = null;
    let parentScoringMs = null;
    let exitAfterResultMs = null;
    let resultRecord = null;
    let exitClass = "unobserved";
    let outputChars = null;
    let proxyStatus = null;
    let proxyWordCount = null;
    let proxySegmentCount = null;
    let proxyFivegramUniqueness = null;
    let networkAttempts = null;
    let timeoutTriggered = false;
    const timer = setTimeout(async () => {
      timeoutTriggered = true;
      const stopReason = getStopReason();
      const terminationCode = await worker.terminate().catch(() => null);
      finish({
        status: stopReason ? "stopped" : resultRecord?.status ?? "timeout",
        lastStage: stopReason ? "stopped" : resultRecord ? "worker_exit" : lastStage,
        timeoutStage: !stopReason && !resultRecord ? lastStage : null,
        exitClass: resultRecord ? "not_observed_before_deadline" : terminationCode === null ? "termination_unknown" : "terminated",
        stopReason,
      });
    }, Math.max(1, deadlineAt - performance.now()));

    const finish = (extra) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      onWorker(null);
      resolve(safeCaseRecord({
        caseId,
        shape,
        targetBytes,
        inputBytes,
        startupMs,
        importMs,
        extractMs,
        resultDeliveryMs,
        parentScoringMs,
        exitAfterResultMs,
        totalMs: performance.now() - startedAt,
        outputChars,
        proxyStatus,
        proxyWordCount,
        proxySegmentCount,
        proxyFivegramUniqueness,
        networkAttempts,
        rssBytes: process.memoryUsage().rss,
        ...extra,
      }));
    };

    worker.on("message", (message) => {
      if (message?.kind === "phase") {
        if (message.phase === "worker_ready") {
          startupMs = performance.now() - startedAt;
          lastStage = "import";
        } else if (message.phase === "import_complete") {
          importMs = message.importMs;
          networkAttempts = message.networkAttempts;
          lastStage = "extract";
        } else if (message.phase === "extract_started") {
          lastStage = "extract";
        } else if (message.phase === "extract_complete") {
          extractMs = message.extractMs;
          networkAttempts = message.networkAttempts;
          parseCompleteAt = performance.now();
          lastStage = "result_delivery";
        }
        if (Number.isSafeInteger(message.networkAttempts) && message.networkAttempts > 0)
          onNetworkAttempt(message.networkAttempts);
        return;
      }

      if (message?.kind === "result" || message?.kind === "oversize_result") {
        resultAt = performance.now();
        if (parseCompleteAt !== null) resultDeliveryMs = resultAt - parseCompleteAt;
        lastStage = "parent_scoring";
        outputChars = Number.isSafeInteger(message.outputChars) ? message.outputChars : null;
        const scoreStarted = performance.now();
        const scored = message.kind === "oversize_result" || (outputChars !== null && outputChars > MAX_OUTPUT_CHARS)
          ? { status: "oversize", wordCount: 0, segmentCount: 0, fivegramUniqueness: null }
          : classifyExtractedContent(message.content ?? "");
        parentScoringMs = performance.now() - scoreStarted;
        proxyStatus = scored.status;
        proxyWordCount = scored.wordCount;
        proxySegmentCount = scored.segmentCount;
        proxyFivegramUniqueness = scored.fivegramUniqueness;
        networkAttempts = Number.isSafeInteger(message.networkAttempts) ? message.networkAttempts : null;
        if (networkAttempts > 0) onNetworkAttempt(networkAttempts);
        resultRecord = { status: scored.status };
        lastStage = "worker_exit";
        return;
      }

      if (message?.kind === "result_error") {
        networkAttempts = Number.isSafeInteger(message.networkAttempts) ? message.networkAttempts : null;
        if (networkAttempts > 0) onNetworkAttempt(networkAttempts);
        resultRecord = { status: "error" };
        lastStage = "worker_exit";
      }
    });

    worker.on("error", () => {
      resultRecord ??= { status: "error" };
      exitClass = "worker_error";
      void worker.terminate().catch(() => {});
      finish({ status: resultRecord.status, lastStage: "worker_exit", timeoutStage: null, exitClass });
    });

    worker.on("exit", (code) => {
      if (timeoutTriggered) return;
      if (resultAt !== null) exitAfterResultMs = performance.now() - resultAt;
      exitClass = code === 0 ? "normal" : "nonzero";
      if (resultRecord) {
        finish({ status: resultRecord.status, lastStage: "worker_exit", timeoutStage: null, exitClass });
      } else {
        const stopReason = getStopReason();
        finish({
          status: stopReason ? "stopped" : "error",
          lastStage: stopReason ? "stopped" : "worker_exit",
          timeoutStage: null,
          exitClass,
          stopReason,
        });
      }
    });
  });
}

function summarize(cases) {
  const counts = (key) => cases.reduce((out, item) => {
    const value = item[key] ?? "unavailable";
    out[value] = (out[value] ?? 0) + 1;
    return out;
  }, {});
  const timing = (key) => {
    const values = cases.map((item) => item[key]).filter(Number.isFinite).sort((a, b) => a - b);
    return values.length
      ? { count: values.length, minMs: values[0], medianMs: values[Math.floor(values.length / 2)], maxMs: values.at(-1) }
      : { count: 0, minMs: null, medianMs: null, maxMs: null };
  };
  return {
    caseCount: cases.length,
    statusCounts: counts("status"),
    timeoutStageCounts: cases.filter((item) => item.timeoutStage).reduce((out, item) => {
      out[item.timeoutStage] = (out[item.timeoutStage] ?? 0) + 1;
      return out;
    }, {}),
    exitClassCounts: counts("exitClass"),
    phases: Object.fromEntries(["startupMs", "importMs", "extractMs", "resultDeliveryMs", "parentScoringMs", "exitAfterResultMs", "totalMs"].map((key) => [key, timing(key)])),
    networkCounter: {
      completedWorkerCounters: cases.filter((item) => Number.isSafeInteger(item.networkAttempts)).length,
      zeroAttemptCounters: cases.filter((item) => item.networkAttempts === 0).length,
      unavailableCounters: cases.filter((item) => item.networkAttempts === null).length,
      parentInterceptedAttempts: parentNetworkAttempts,
    },
  };
}

async function writeResults(report) {
  await writeFile(new URL("./results.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export async function runDiagnostic() {
  const resultsUrl = new URL("./results.json", import.meta.url);
  const markerUrl = new URL("./execution-started.json", import.meta.url);
  for (const evidenceUrl of [resultsUrl, markerUrl]) {
    try {
      await readFile(evidenceUrl, "utf8");
      throw new Error("iteration_run_already_started");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  assert.equal(process.version, "v20.19.0", "node_20_19_required");
  const lockBytes = await readFile(new URL("../07-hosted-eligibility/package-lock.json", import.meta.url));
  const lock = JSON.parse(lockBytes.toString("utf8"));
  assert.equal(lock.packages["node_modules/@extractus/article-extractor"].version, "9.0.1", "extractor_lock_mismatch");
  const lockSha256 = createHash("sha256").update(lockBytes).digest("hex");
  const matrix = caseMatrix();
  assert.equal(matrix.length, 10, "case_matrix_must_be_10");
  assert.equal(new Set(matrix.map((item) => item.caseId)).size, 10, "case_ids_must_be_unique");
  await writeFile(markerUrl, `${JSON.stringify({ status: "started", nodeVersion: process.version, plannedCaseCount: matrix.length }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  const overallStarted = performance.now();
  const overallDeadline = overallStarted + TOTAL_DEADLINE_MS;
  let activeWorker = null;
  let stopReason = null;
  let peakRssBytes = process.memoryUsage().rss;
  const cases = [];
  const rssTimer = setInterval(() => {
    const rss = process.memoryUsage().rss;
    peakRssBytes = Math.max(peakRssBytes, rss);
    if (rss > MAX_RSS_BYTES) stopReason ??= "rss_limit_exceeded";
    if (performance.now() >= overallDeadline) stopReason ??= "overall_deadline";
    if (stopReason && activeWorker) void activeWorker.terminate().catch(() => {});
  }, 50);

  try {
    for (const item of matrix) {
      if (stopReason || performance.now() >= overallDeadline) {
        stopReason ??= "overall_deadline";
        break;
      }
      const html = createFixture(item.shape, item.targetBytes);
      const result = await executeCase({
        ...item,
        html,
        deadlineMs: Math.min(CASE_DEADLINE_MS, Math.max(1, overallDeadline - performance.now())),
        onWorker: (worker) => { activeWorker = worker; },
        getStopReason: () => stopReason,
        onNetworkAttempt: () => { stopReason ??= "network_attempt_blocked"; },
      });
      cases.push(result);
      const rss = process.memoryUsage().rss;
      peakRssBytes = Math.max(peakRssBytes, rss);
      if (parentNetworkAttempts > 0) stopReason ??= "parent_network_attempt_blocked";
      if (result.networkAttempts > 0) stopReason ??= "worker_network_attempt_blocked";
      if (rss > MAX_RSS_BYTES) stopReason ??= "rss_limit_exceeded";
      if (performance.now() >= overallDeadline) stopReason ??= "overall_deadline";
      if (stopReason) break;
    }
  } finally {
    clearInterval(rssTimer);
    if (activeWorker) await activeWorker.terminate().catch(() => {});
  }

  const elapsedMs = performance.now() - overallStarted;
  const perCaseSumMs = cases.reduce((total, item) => total + (item.totalMs ?? 0), 0);
  const report = {
    schemaVersion: "issue22-iteration8-worker-lifecycle-v1",
    nodeVersion: process.version,
    extractorVersion: lock.packages["node_modules/@extractus/article-extractor"].version,
    packageLockSha256: lockSha256,
    parentOldSpaceLimitMb: 128,
    workerOldSpaceLimitMb: 128,
    perCaseDeadlineMs: CASE_DEADLINE_MS,
    overallDeadlineMs: TOTAL_DEADLINE_MS,
    maxInputBytes: MAX_INPUT_BYTES,
    maxOutputChars: MAX_OUTPUT_CHARS,
    maxRssBytes: MAX_RSS_BYTES,
    status: stopReason ? "stopped" : cases.length === matrix.length ? "completed" : "incomplete",
    stopReason,
    plannedCaseCount: matrix.length,
    elapsedMs: roundMs(elapsedMs),
    perCaseElapsedSumMs: roundMs(perCaseSumMs),
    unallocatedHarnessMs: roundMs(elapsedMs - perCaseSumMs),
    peakRssBytes,
    networkRequestsMade: parentNetworkAttempts,
    aggregate: summarize(cases),
    cases,
  };
  await writeResults(report);
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = await runDiagnostic();
  console.log(JSON.stringify({
    status: report.status,
    stopReason: report.stopReason,
    plannedCaseCount: report.plannedCaseCount,
    completedCases: report.cases.length,
    elapsedMs: report.elapsedMs,
    peakRssBytes: report.peakRssBytes,
    aggregate: report.aggregate,
  }));
  if (report.status !== "completed" || report.cases.length !== 10 || report.networkRequestsMade !== 0)
    process.exitCode = 1;
}
