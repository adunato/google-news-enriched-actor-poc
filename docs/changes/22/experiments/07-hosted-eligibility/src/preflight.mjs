import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import process from "node:process";

let interceptedNetworkAttempts = 0;
const blockNetwork = () => {
  interceptedNetworkAttempts += 1;
  throw new Error("preflight_network_disabled");
};
globalThis.fetch = blockNetwork;
http.request = blockNetwork;
http.get = blockNetwork;
https.request = blockNetwork;
https.get = blockNetwork;

const optionsPath = new URL("../hosted-run-options.json", import.meta.url);
const hostedRunOptions = JSON.parse(await readFile(optionsPath, "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
assert.equal(packageLock.packages["node_modules/@extractus/article-extractor"].version, "9.0.1");
assert.deepEqual(hostedRunOptions, {
  visibility: "private",
  runtime: "Node 20",
  maxTotalChargeUsd: 1,
  maxTotalChargeUsdMustBeUserSet: true,
  memoryMbytes: 256,
  timeoutSecs: 900,
  restartOnError: false,
  runCount: 1,
});

const { executeIteration7, inspectHtmlForIteration7, robotsAllows, mayFollowPublisherRedirect, runActorSafely, CONFIG } = await import("./probe.mjs");
const { allowedAggregateFields, cellIds } = await import("./aggregate.mjs");
const { EXTRACTION_DEADLINE_MS, extractOne, extractSerially, readWorkerMetrics, resetWorkerMetrics } = await import("./worker-extraction.mjs");
const network = await import("./probe-network.mjs");
const sentinel = "RAW_SENTINEL_MUST_NOT_PERSIST";

assert.equal(CONFIG.concurrency, 4);
assert.equal(CONFIG.timeoutMs, 10000);
assert.equal(CONFIG.maxRedirects, 5);
assert.equal(CONFIG.publisherMaxBytes, 256 * 1024);
assert.equal(CONFIG.perHostDelayMs, 250);
assert.equal(EXTRACTION_DEADLINE_MS, 5000);
assert.equal(hostedRunOptions.timeoutSecs, 900);
assert.equal(hostedRunOptions.maxTotalChargeUsd, 1);

assert.equal(network.addressIsPublic("93.184.216.34"), true);
assert.equal(network.addressIsPublic("127.0.0.1"), false);
const privateDnsTarget = await network.resolvePublicHttpTarget("https://publisher.example.org/article", {
  resolver: async () => [{ address: "127.0.0.1", family: 4 }],
});
assert.deepEqual(privateDnsTarget, { ok: false, reason: "non_public_dns_address" });
const publicDnsTarget = await network.resolvePublicHttpTarget("https://publisher.example.org/article", {
  resolver: async () => [{ address: "93.184.216.34", family: 4 }],
});
assert.equal(publicDnsTarget.ok, true);
const pinnedLookup = network.createPinnedLookup(publicDnsTarget);
const pinned = await new Promise((resolve, reject) => pinnedLookup("publisher.example.org", { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses)));
assert.deepEqual(pinned, [{ address: "93.184.216.34", family: 4 }]);
assert.equal(network.resolveRedirectUrl("/next", "https://publisher.example.org/a"), "https://publisher.example.org/next");
assert.equal(Array.from({ length: 5 }, (_, index) => mayFollowPublisherRedirect(index)).every(Boolean), true);
assert.equal(mayFollowPublisherRedirect(5), false);
assert.equal(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/open", "/private/x"), false);
assert.equal(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/open", "/private/open/story"), true);

const prefixResponse = Readable.from([Buffer.from("1234567890")]);
prefixResponse.headers = { "content-length": "10", "content-encoding": "identity" };
const capped = await network.boundedNodePrefix(prefixResponse, 5);
assert.equal(Buffer.byteLength(capped.text), 5);
assert.equal(capped.truncated, true);

const originalHttpRequest = http.request;
http.request = (_options, _callback) => {
  const request = new EventEmitter();
  request.end = () => {};
  request.destroy = (error) => {
    if (error) queueMicrotask(() => request.emit("error", error));
    return request;
  };
  return request;
};
let keepAlive = setTimeout(() => {}, 100);
await assert.rejects(
  network.requestPinnedPublicHttp("http://publisher.example.org/timeout", {
    headers: {},
    timeoutMs: 20,
    resolver: async () => [{ address: "93.184.216.34", family: 4 }],
  }),
  (error) => error.name === "TimeoutError",
);
clearTimeout(keepAlive);
http.request = originalHttpRequest;
http.request = blockNetwork;

class FakeWorker extends EventEmitter {
  constructor(_url, { workerData }) {
    super();
    this.workerData = workerData;
    FakeWorker.active += 1;
    FakeWorker.maximum = Math.max(FakeWorker.maximum, FakeWorker.active);
    queueMicrotask(() => this.emit("message", { content: "synthetic output" }));
  }
  async terminate() {
    FakeWorker.active -= 1;
  }
}
FakeWorker.active = 0;
FakeWorker.maximum = 0;
resetWorkerMetrics();
await Promise.all([
  extractSerially("synthetic input one", "https://publisher.example.org/one", { WorkerClass: FakeWorker, deadlineMs: 100 }),
  extractSerially("synthetic input two", "https://publisher.example.org/two", { WorkerClass: FakeWorker, deadlineMs: 100 }),
]);
assert.equal(FakeWorker.maximum, 1);
assert.equal(readWorkerMetrics().maximumActiveWorkerCount, 1);

class NeverWorker extends EventEmitter {
  constructor() { super(); NeverWorker.terminated = false; }
  async terminate() { NeverWorker.terminated = true; }
}
NeverWorker.terminated = false;
const timedOut = await extractOne("synthetic timeout input", "https://publisher.example.org/timeout", {
  WorkerClass: NeverWorker,
  deadlineMs: EXTRACTION_DEADLINE_MS,
});
assert.equal(timedOut.status, "timeout");
assert.equal(NeverWorker.terminated, true);

function alphaCode(value) {
  let number = value;
  let code = "";
  for (let i = 0; i < 7; i += 1) {
    code = String.fromCharCode(97 + (number % 26)) + code;
    number = Math.floor(number / 26);
  }
  return `story${code}`;
}
const authoredWords = Array.from({ length: 120 }, (_, index) => alphaCode(index));
const syntheticArticle = `<html><head><title>Synthetic article</title></head><body><article><h1>Synthetic fixture</h1><p>${authoredWords.slice(0, 60).join(" ")}</p><p>${authoredWords.slice(60).join(" ")}</p></article></body></html>`;
const challengeArticle = `<div>CAPTCHA automated requests</div>${syntheticArticle}`;

const syntheticRows = [];
const feedDiagnostics = [];
const syntheticResolutions = [];
for (const cell of cellIds()) {
  feedDiagnostics.push({ cell, status: 200, finalHost: sentinel, feedBytes: 64 * 1024, itemCount: 10, retainedCount: 10 });
  for (let position = 1; position <= 10; position += 1) {
    syntheticRows.push({
      rowId: `${sentinel}-${cell}-${position}`,
      cell,
      query: sentinel,
      country: "GB",
      title: sentinel,
      expectedTitle: sentinel,
      sourceName: sentinel,
      sourceHost: `${sentinel}.invalid`,
      googleNewsUrl: `https://${sentinel}.invalid/article`,
      html: sentinel,
      cookies: sentinel,
    });
    syntheticResolutions.push({ candidateUrl: `https://${sentinel}.invalid/article`, candidateStatus: "success_rpc" });
  }
}

resetWorkerMetrics();
const pushedPayloads = [];
const syntheticAggregate = await executeIteration7({
  actor: { pushData: async (payload) => pushedPayloads.push(payload) },
  acquireMatrix: async () => ({ rows: syntheticRows, feedDiagnostics }),
  resolveRow: async (_row, index) => syntheticResolutions[index],
  probeDestination: async (row) => {
    if (row.rowId.endsWith("-1")) {
      const inspected = await inspectHtmlForIteration7(challengeArticle, `https://${sentinel}.invalid/article`);
      return {
        rowId: row.rowId, accessStatus: "http_2xx_html", httpStatus: 200, robotsSignal: "allowed",
        responseBytes: Buffer.byteLength(challengeArticle), challengeLike: inspected.challengeLike,
        extraction: inspected.extraction,
      };
    }
    if (row.rowId.endsWith("-2")) {
      const inspected = await inspectHtmlForIteration7(syntheticArticle, `https://${sentinel}.invalid/article`);
      return {
        rowId: row.rowId, accessStatus: "http_2xx_html", httpStatus: 200, robotsSignal: "not_found",
        responseBytes: Buffer.byteLength(syntheticArticle), challengeLike: inspected.challengeLike,
        extraction: inspected.extraction,
      };
    }
    if (row.rowId.endsWith("-3")) throw new Error(sentinel);
    return { rowId: row.rowId, accessStatus: "skipped_robots_disallowed", robotsSignal: "disallowed", responseBytes: 0 };
  },
});
assert.equal(pushedPayloads.length, 1);
assert.deepEqual(pushedPayloads[0], syntheticAggregate);
assert.equal(syntheticAggregate.denominator, 100);
assert(syntheticAggregate.cells.every((cell) => cell.plannedRows === 10));
assert.equal(syntheticAggregate.cells.reduce((n, cell) => n + cell.gateSignal.positive, 0), 10);
assert.equal(syntheticAggregate.cells.reduce((n, cell) => n + Object.values(cell.gateProxyComparison.gate_positive).reduce((a, b) => a + b, 0), 0), 10);
assert.equal(syntheticAggregate.cells.reduce((n, cell) => n + cell.extraction.not_attempted, 0), 80);
assert.equal(syntheticAggregate.cells.reduce((n, cell) => n + cell.extraction.error, 0), 0);
assert.equal(readWorkerMetrics().workerInvocationCount, 20);
assert.equal(readWorkerMetrics().maximumActiveWorkerCount, 1);

const allowed = allowedAggregateFields();
function assertAggregateKeys(value) {
  if (Array.isArray(value)) return value.forEach(assertAggregateKeys);
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert(allowed.has(key), `unexpected aggregate key: ${key}`);
      assertAggregateKeys(child);
    }
  }
}
assertAggregateKeys(syntheticAggregate);
assert(!JSON.stringify(syntheticAggregate).includes(sentinel));
assert.equal(Object.hasOwn(syntheticAggregate, "rows"), false);

let incompleteSinkCalls = 0;
await assert.rejects(executeIteration7({
  actor: { pushData: async () => { incompleteSinkCalls += 1; } },
  acquireMatrix: async () => ({ rows: syntheticRows.slice(1), feedDiagnostics }),
}));
assert.equal(incompleteSinkCalls, 0);

let failedSinkCalls = 0;
await assert.rejects(executeIteration7({
  actor: { pushData: async (payload) => { failedSinkCalls += 1; assert(!JSON.stringify(payload).includes(sentinel)); throw new Error(sentinel); } },
  acquireMatrix: async () => ({ rows: syntheticRows, feedDiagnostics }),
  resolveRow: async (_row, index) => syntheticResolutions[index],
  probeDestination: async (row) => row.rowId.endsWith("-3")
    ? (() => { throw new Error(sentinel); })()
    : { rowId: row.rowId, accessStatus: "skipped_robots_disallowed", robotsSignal: "disallowed", responseBytes: 0 },
}));
assert.equal(failedSinkCalls, 1);

const sanitizedErrors = [];
const rawExecutionFailure = await runActorSafely({
  init: async () => {},
  execute: async () => { throw new Error(sentinel); },
  exit: async () => {},
  logError: (message) => sanitizedErrors.push(message),
  logComplete: () => assert.fail("failed run must not emit completion log"),
});
assert.equal(rawExecutionFailure, false);
assert.deepEqual(sanitizedErrors, ["iteration7_failed"]);

const exitFailure = await runActorSafely({
  init: async () => {},
  execute: async () => syntheticAggregate,
  exit: async () => { throw new Error(sentinel); },
  logError: (message) => sanitizedErrors.push(message),
  logComplete: () => {},
});
assert.equal(exitFailure, false);
assert.deepEqual(sanitizedErrors, ["iteration7_failed", "iteration7_exit_failed"]);

const navFixture = Array.from({ length: 128 }, (_, index) => `${alphaCode(index)} news world`);
const navMarkup = `<p>${navFixture.slice(0, 64).join(" ")}</p><p>${navFixture.slice(64).join(" ")}</p>`;
assert.equal((await import("./readability-proxy.mjs")).classifyExtractedContent(navMarkup).status, "accepted_proxy");
assert.equal(interceptedNetworkAttempts, 0);

const report = {
  mode: "offline exact-pipeline synthetic preflight only",
  networkRequestsMade: 0,
  interceptedNetworkAttempts,
  hostedBuildOrRun: false,
  publisherRequests: 0,
  localNodeVersion: process.version,
  lockedExtractorVersion: packageLock.packages["node_modules/@extractus/article-extractor"].version,
  syntheticDenominator: syntheticAggregate.denominator,
  syntheticCellCount: syntheticAggregate.cells.length,
  eligibleSyntheticRows: syntheticAggregate.cells.reduce((total, cell) => total + cell.eligible2xxHtml, 0),
  gatePositiveSyntheticRows: syntheticAggregate.cells.reduce((total, cell) => total + cell.gateSignal.positive, 0),
  extractionWorkerInvocations: readWorkerMetrics().workerInvocationCount,
  maximumConcurrentWorkers: readWorkerMetrics().maximumActiveWorkerCount,
  workerTimeoutTerminated: NeverWorker.terminated,
  aggregatePushCalls: pushedPayloads.length,
  incompleteCohortPushCalls: incompleteSinkCalls,
  failedSinkAttempts: failedSinkCalls,
  rawExecutionAndExitErrorsMappedToFixedLogStrings: true,
  aggregateOnlyAndRawSentinelChecksPassed: true,
  gatePositiveRowsEnteredExtractionPath: true,
  fullGateExtractionCrossTabPresent: true,
  runtimeAndBoundsAssertionsPassed: true,
  externalRunOptionsPinned: true,
  navigationHeavyFixtureAcceptedByOptimisticProxy: true,
  proxyInterpretation: "structural proxy only; no human readability or Issue 5 claim",
};
const experimentDir = dirname(dirname(fileURLToPath(import.meta.url)));
await writeFile(join(experimentDir, "preflight-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report));
