import { Actor } from "apify";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { extractBounded } from "../../10-direct-readability/src/extract.mjs";
import { createSdkStub } from "./sdk-stub.mjs";
import { inspectImportGraph } from "./import-graph-check.mjs";
import { marker, state } from "./guard-preload.mjs";

const FIXTURE_INPUT = Object.freeze({ mode: "fixture-only", fixtureId: "readability-positive-v1" });
const storeId = "issue22-h12-local-store";
const stages = [];
const aggregate = { schemaVersion: "issue22-h12-fixture-v1", fixtureCount: 0, workerStatus: "not_started", readabilityStatus: "not_scored", readabilityWords: 0, outputChars: 0 };

function stage(name) { stages.push(name); }
function exactFixtureInput(input) {
  return input && typeof input === "object" && !Array.isArray(input) &&
    Object.keys(input).sort().join("|") === "fixtureId|mode" &&
    input.mode === FIXTURE_INPUT.mode && input.fixtureId === FIXTURE_INPUT.fixtureId;
}
const inputAllowlistVerified = exactFixtureInput(FIXTURE_INPUT) && [
  null, [], {}, { ...FIXTURE_INPUT, unexpected: "value" },
  { ...FIXTURE_INPUT, mode: "live" }, { ...FIXTURE_INPUT, fixtureId: "unknown" },
].every((input) => !exactFixtureInput(input));
function privacySafe(value) {
  return JSON.stringify(value).length < 2048 && !/https?:|<script|fixture article|article text/i.test(JSON.stringify(value));
}
function resetCounters() {
  state.allowedSdkByPhase = { sdk_init: 0, input_read: 0, aggregate_write: 0, other: 0 };
  state.deniedApplication = 0; state.tupleMiss = 0; state.socketDenied = 0;
  for (const key of Object.keys(state.socketHostClass)) state.socketHostClass[key] = 0;
  for (const key of Object.keys(state.socketCallShape)) state.socketCallShape[key] = 0;
  state.socketOptionKeySet = {};
  for (const key of Object.keys(state.blockedApi)) state.blockedApi[key] = 0;
}
function parentNegativeChecks() {
  const outcomes = [];
  const attempt = (name, operation) => {
    try { operation(); outcomes.push({ api: name, blocked: false }); }
    catch (error) { outcomes.push({ api: name, blocked: error?.code === "H12_NETWORK_DENIED" }); }
  };
  process.env.H12_PHASE = "guard_probe";
  attempt("fetch", () => fetch("https://news.google.com/"));
  attempt("http.request", () => http.request("http://news.google.com/"));
  attempt("http.get", () => http.get("http://news.google.com/"));
  attempt("https.request", () => https.request("https://news.google.com/"));
  attempt("https.get", () => https.get("https://news.google.com/"));
  attempt("http.request.unlisted_loopback", () => http.request("http://127.0.0.1:43821/not-allowlisted"));
  attempt("net.connect", () => net.connect(443, "news.google.com"));
  attempt("net.connect.unscoped_loopback", () => net.connect(43821, "127.0.0.1"));
  attempt("net.createConnection", () => net.createConnection(443, "news.google.com"));
  attempt("net.Socket.connect", () => new net.Socket().connect(443, "news.google.com"));
  attempt("dns.lookup", () => dns.lookup("news.google.com", () => {}));
  attempt("dns.lookupService", () => dns.lookupService("127.0.0.1", 80, () => {}));
  attempt("dns.resolve", () => dns.resolve("news.google.com", () => {}));
  attempt("dns.promises.lookup", () => dnsPromises.lookup("news.google.com"));
  attempt("dns.promises.resolve", () => dnsPromises.resolve("news.google.com"));
  return outcomes;
}
function workerNegativeChecks() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./guard-probe-worker.mjs", import.meta.url), { type: "module" });
    let finished = false;
    const timer = setTimeout(() => { if (!finished) { finished = true; void worker.terminate(); reject(new Error("guard_worker_timeout")); } }, 5000);
    worker.once("message", (message) => { finished = true; clearTimeout(timer); resolve(message); });
    worker.once("error", (error) => { if (!finished) { finished = true; clearTimeout(timer); reject(error); } });
  });
}

const stub = createSdkStub({
  expectedTuples: JSON.parse(await readFile(new URL("./tuple-manifest.json", import.meta.url), "utf8")).tuples,
  input: FIXTURE_INPUT,
  discover: process.env.H12_DISCOVER_TUPLES === "1",
});
let persisted = false;
let exitCode = 0;
let failureCode = "none";
let parentNegative = [];
let workerNegative = null;
let stubCallsDuringNegativeChecks = null;
let parentDeniedByApi = null;
let workerDeniedByApi = null;
const importGraph = await inspectImportGraph();
stage("application_entry");
try {
  if (!importGraph.passed) throw new Error("import_graph_gate_failed");
  const apiBase = await stub.listen(43821);
  stage("loopback_stub_ready");
  process.env.APIFY_API_BASE_URL = apiBase;
  process.env.APIFY_TOKEN = "h12-local-only-token";
  process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID = storeId;
  process.env.CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID = storeId;
  process.env.APIFY_DEFAULT_DATASET_ID = storeId;
  process.env.CRAWLEE_DEFAULT_DATASET_ID = storeId;
  process.env.CRAWLEE_PURGE_ON_START = "0";
  process.env.ACTORS_DISABLE_OUTDATED_WARNING = "1";
  process.env.H12_PHASE = "sdk_init";
  if (process.env.H12_GUARD_MARKER !== marker || globalThis.__ISSUE22_H12_GUARD__ !== marker) throw new Error("guard_marker_missing");
  stage("guard_ready");
  const beforeNegativeStubCalls = stub.tuples().length;
  parentNegative = parentNegativeChecks();
  workerNegative = await workerNegativeChecks();
  parentDeniedByApi = { ...state.blockedApi };
  workerDeniedByApi = workerNegative.blockedApi;
  stubCallsDuringNegativeChecks = stub.tuples().length - beforeNegativeStubCalls;
  if (!parentNegative.length || parentNegative.some((item) => !item.blocked) || !workerNegative.marker || !workerNegative.allBlocked || workerNegative.attempted < 30 || workerNegative.blockedApplication !== workerNegative.attempted || stubCallsDuringNegativeChecks !== 0) throw new Error("negative_guard_checks_failed");
  stage("parent_worker_guards_verified");
  resetCounters();
  process.env.H12_PHASE = "sdk_init";
  process.env.H12_REQUIRE_GUARD = "1";
  const client = Actor.apifyClient;
  if (client.httpClient && Number.isSafeInteger(client.httpClient.maxRetries)) client.httpClient.maxRetries = 0;
  if (Actor.config.get("actorEventsWsUrl")) throw new Error("event_websocket_not_disabled");
  await Actor.init();
  stage("sdk_initialized");
  process.env.H12_PHASE = "input_read";
  const input = await Actor.getInput();
  if (!exactFixtureInput(input)) { stage("input_rejected"); exitCode = 2; throw new Error("fixture_input_rejected"); }
  stage("fixture_input_accepted");
  const fixture = await readFile(new URL("../fixtures/readability-positive-v1.html", import.meta.url), "utf8");
  process.env.H12_PHASE = "aggregate_write";
  const extracted = await extractBounded(fixture, "https://fixture.invalid/article", { deadlineMs: 5000 });
  aggregate.fixtureCount = 1;
  aggregate.workerStatus = extracted.status;
  aggregate.readabilityStatus = extracted.readabilityStatus;
  aggregate.readabilityWords = extracted.readabilityWords;
  aggregate.outputChars = extracted.outputChars;
  aggregate.guardMarker = extracted.guardMarker === true;
  if (extracted.status !== "complete" || extracted.readabilityStatus !== "success" || extracted.readabilityWords < 1 || extracted.guardMarker !== true) throw new Error("fixture_extraction_failed");
  stage("fixture_extracted");
  if (!privacySafe(aggregate)) throw new Error("aggregate_privacy_failed");
  await Actor.pushData(aggregate);
  if (!stub.aggregateWriteVerified()) throw new Error("aggregate_write_verification_failed");
  persisted = true;
  stage("aggregate_persisted");
} catch (error) {
  failureCode = ["EADDRINUSE", "H12_NETWORK_DENIED", "H12_GUARD_FAILED", "ERR_INVALID_ARG_TYPE"].includes(error?.code) ? error.code : "unclassified";
  stage("diagnostic_failed");
  if (exitCode === 0) exitCode = 1;
} finally {
  try { if (Actor.getDefaultInstance?.().initialized) await Actor.exit({ exitCode, exit: false }); } catch { exitCode = 1; }
  await stub.close();
}

const manifest = JSON.parse(await readFile(new URL("./tuple-manifest.json", import.meta.url), "utf8"));
const stubTuples = stub.tuples();
const counters = globalThis.__ISSUE22_H12_COUNTERS__;
const result = {
  schemaVersion: "issue22-h12-local-result-v1",
  outcome: persisted ? "fixture_complete" : "failed",
  failureCode,
  stages,
  aggregatePersisted: persisted,
  deterministicStoreId: storeId,
  guardMarker: process.env.H12_GUARD_MARKER === marker,
  guardGlobalMarker: globalThis.__ISSUE22_H12_GUARD__ === marker,
  tupleManifestState: manifest.state,
  tupleManifestCount: manifest.tuples.length,
  observedTupleCount: stubTuples.length,
  observedTuples: stubTuples,
  allowedSdkByPhase: counters.allowedSdkByPhase,
  deniedApplication: counters.deniedApplication,
  tupleMiss: counters.tupleMiss,
  socketDenied: counters.socketDenied,
  socketHostClass: counters.socketHostClass,
  socketCallShape: counters.socketCallShape,
  socketOptionKeySet: counters.socketOptionKeySet,
  blockedApi: counters.blockedApi,
  externalNetwork: "disabled-by-runner-and-guard",
  fixtureOnly: true,
  inputAllowlistVerified,
  eventWebSocketDisabled: !Actor.config.get("actorEventsWsUrl"),
  runtimeImageDigest: process.env.H12_IMAGE_DIGEST ?? "not_container_reported",
  parentNegativeApiCount: parentNegative?.length ?? 0,
  workerNegativeApiCount: workerNegative?.attempted ?? 0,
  parentDeniedByApi,
  workerDeniedByApi,
  parentAndWorkerDeniedAll: !!parentNegative?.length && parentNegative.every((item) => item.blocked) && !!workerNegative?.allBlocked,
  stubCallsDuringNegativeChecks: stubCallsDuringNegativeChecks ?? null,
  aggregateWriteVerified: stub.aggregateWriteVerified(),
  fixtureResult: persisted ? {
    workerStatus: aggregate.workerStatus,
    readabilityStatus: aggregate.readabilityStatus,
    wordCount: aggregate.readabilityWords,
    outputCharCount: aggregate.outputChars,
    workerGuardMarker: aggregate.guardMarker,
  } : null,
  importGraph,
};
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = exitCode;
