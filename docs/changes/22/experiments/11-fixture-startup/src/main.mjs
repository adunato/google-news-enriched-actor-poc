import { Actor } from "apify";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { extractBounded } from "../../10-direct-readability/src/extract.mjs";
import { createSdkStub } from "./sdk-stub.mjs";
import { inspectImportGraph } from "./import-graph-check.mjs";
import { marker, state } from "./guard-preload.mjs";

const FIXTURE_INPUT = Object.freeze({ mode: "fixture-only", fixtureId: "readability-positive-v1" });
const FIXTURE_SHA256 = "cb58978a9ba481956d382e4fc153a666767a718a2e05d0ce5f5b3172fe1b5614";
const EXPECTED_WORDS = 26;
const EXPECTED_OUTPUT_CHARS = 186;
const storeId = "issue22-h12-local-store";
const stages = [];
const aggregate = { schemaVersion: "issue22-h12-fixture-v1", fixtureCount: 0, workerStatus: "not_started", readabilityStatus: "not_scored", readabilityWords: 0, outputChars: 0 };
let workerCount = 0;

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
class GuardedReadabilityWorker extends Worker {
  constructor(url, options) {
    if (!stages.includes("fixture_input_accepted")) throw new Error("worker_before_input_gate");
    workerCount++;
    super(url, { ...options, execArgv: ["--import", new URL("./guard-preload.mjs", import.meta.url).href] });
  }
}

const malformedInput = process.env.H12_INPUT_MODE === "invalid";
const fixtureInput = malformedInput ? { ...FIXTURE_INPUT, mode: "live" } : FIXTURE_INPUT;
const stub = createSdkStub({
  expectedTuples: JSON.parse(await readFile(new URL("./tuple-manifest.json", import.meta.url), "utf8")).tuples,
  input: fixtureInput,
  discover: process.env.H12_DISCOVER_TUPLES === "1",
});
let persisted = false;
let inputRejected = false;
let exitCode = 0;
let failureCode = "none";
let extractionDiagnostics = null;
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
  process.env.H12_REQUIRE_GUARD = "1";
  const client = Actor.apifyClient;
  if (client.httpClient && Number.isSafeInteger(client.httpClient.maxRetries)) client.httpClient.maxRetries = 0;
  if (Actor.config.get("actorEventsWsUrl")) throw new Error("event_websocket_not_disabled");
  await Actor.init();
  stage("sdk_initialized");
  process.env.H12_PHASE = "input_read";
  const input = await Actor.getInput();
  if (!exactFixtureInput(input)) {
    inputRejected = true;
    exitCode = 2;
    stage("input_rejected");
    throw new Error("fixture_input_rejected");
  }
  stage("fixture_input_accepted");

  // The first Worker is created only after the exact fixture-only Actor input gate.
  const fixture = await readFile(new URL("../fixtures/readability-positive-v1.html", import.meta.url), "utf8");
  const fixtureHash = createHash("sha256").update(fixture).digest("hex");
  if (fixtureHash !== FIXTURE_SHA256) throw new Error("fixture_hash_mismatch");
  process.env.H12_PHASE = "aggregate_write";
  const extracted = await extractBounded(fixture, "https://fixture.invalid/article", { WorkerClass: GuardedReadabilityWorker, deadlineMs: 5000 });
  extractionDiagnostics = {
    status: extracted.status,
    readabilityStatus: extracted.readabilityStatus,
    wordCount: extracted.readabilityWords,
    outputCharCount: extracted.outputChars,
    workerGuardMarker: extracted.guardMarker === true,
    workerCount,
  };
  aggregate.fixtureCount = 1;
  aggregate.workerStatus = extracted.status;
  aggregate.readabilityStatus = extracted.readabilityStatus;
  aggregate.readabilityWords = extracted.readabilityWords;
  aggregate.outputChars = extracted.outputChars;
  aggregate.guardMarker = extracted.guardMarker === true;
  if (extracted.status !== "complete" || extracted.readabilityStatus !== "success" ||
      extracted.readabilityWords !== EXPECTED_WORDS || extracted.outputChars !== EXPECTED_OUTPUT_CHARS ||
      extracted.guardMarker !== true || workerCount !== 1) throw new Error("fixture_extraction_failed");
  stage("fixture_extracted");
  if (!privacySafe(aggregate)) throw new Error("aggregate_privacy_failed");
  await Actor.pushData(aggregate);
  if (!stub.aggregateWriteVerified()) throw new Error("aggregate_write_verification_failed");
  persisted = true;
  stage("aggregate_persisted");
} catch (error) {
  const knownFailures = new Set(["import_graph_gate_failed", "event_websocket_not_disabled", "guard_marker_missing", "fixture_input_rejected", "fixture_hash_mismatch", "fixture_extraction_failed", "aggregate_privacy_failed", "aggregate_write_verification_failed"]);
  failureCode = ["EADDRINUSE", "H12_NETWORK_DENIED", "H12_GUARD_FAILED", "ERR_INVALID_ARG_TYPE"].includes(error?.code)
    ? error.code
    : inputRejected ? "fixture_input_rejected" : knownFailures.has(error?.message) ? error.message : "unclassified";
  if (!inputRejected) stage("diagnostic_failed");
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
  outcome: persisted ? "fixture_complete" : inputRejected ? "input_rejected" : "failed",
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
  blockedApi: counters.blockedApi,
  externalNetwork: "disabled-by-runner-and-guard",
  fixtureOnly: true,
  inputAllowlistVerified,
  eventWebSocketDisabled: !Actor.config.get("actorEventsWsUrl"),
  workerCount,
  workerOnlyAfterInputGate: !stages.includes("fixture_extracted") || stages.indexOf("fixture_input_accepted") < stages.indexOf("fixture_extracted"),
  normalGuardDenials: counters.deniedApplication + counters.tupleMiss + counters.socketDenied,
  fixtureSha256: persisted ? FIXTURE_SHA256 : null,
  runtimeImageDigest: process.env.H12_IMAGE_DIGEST ?? "not_container_reported",
  aggregateWriteVerified: stub.aggregateWriteVerified(),
  extractionDiagnostics,
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
