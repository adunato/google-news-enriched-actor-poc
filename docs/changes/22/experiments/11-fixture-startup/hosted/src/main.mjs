import { Actor } from "apify";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { extractBounded } from "./extract.mjs";
import { verifyRuntimeGate } from "./runtime-gate.mjs";
import { marker, state, withSdkPhase } from "./guard-preload.mjs";

const FIXTURE = Object.freeze({ mode: "fixture-only", fixtureId: "readability-positive-v1" });
const FIXTURE_SHA256 = "cb58978a9ba481956d382e4fc153a666767a718a2e05d0ce5f5b3172fe1b5614";
const EXPECTED_WORDS = 26;
const EXPECTED_OUTPUT_CHARS = 186;
const stages = [];
let workerCount = 0;
let exitCode = 1;
let failureCode = "none";
let fixtureResult = null;
let aggregateWritten = false;
let readbackVerified = false;
let runGateChecks = null;
function stage(name) { stages.push(name); }
function exactInput(input) {
  return input && typeof input === "object" && !Array.isArray(input) &&
    Object.keys(input).sort().join("|") === "fixtureId|mode" &&
    input.mode === FIXTURE.mode && input.fixtureId === FIXTURE.fixtureId;
}
function failure(error) {
  if (error?.code === "H14_NETWORK_DENIED") return "network_denied";
  const candidates = new Set(["fixture_input_rejected", "fixture_hash_mismatch", "fixture_extract_failed", "run_gate_rejected", "guard_marker_missing", "aggregate_shape_rejected", "readback_rejected", "worker_before_fixture_gate"]);
  return candidates.has(error?.message) ? error.message : "stage_failed";
}
class GuardedReadabilityWorker extends Worker {
  constructor(url, options) {
    if (!stages.includes("fixture_gate_accepted")) throw new Error("worker_before_fixture_gate");
    workerCount++;
    super(url, { ...options, execArgv: ["--import", new URL("./guard-preload.mjs", import.meta.url).href] });
  }
}

stage("entrypoint_started");
try {
  if (process.env.H14_GUARD_MARKER !== marker || globalThis.__ISSUE22_H14_GUARD__ !== marker) throw new Error("guard_marker_missing");
  stage("preimport_guard_verified");
  if (Actor.config.get("actorEventsWsUrl")) throw new Error("websocket_not_disabled");
  if (Actor.apifyClient.httpClient && Number.isSafeInteger(Actor.apifyClient.httpClient.maxRetries)) Actor.apifyClient.httpClient.maxRetries = 0;
  stage("sdk_init_started");
  await withSdkPhase("sdk_init", () => Actor.init());
  stage("sdk_initialized");
  stage("input_read_started");
  const input = await withSdkPhase("input_read", () => Actor.getInput());
  stage("input_read_complete");
  if (!exactInput(input)) throw new Error("fixture_input_rejected");
  stage("fixture_gate_accepted");

  const actorEnv = Actor.getEnv();
  const runId = process.env.ACTOR_RUN_ID;
  const run = await withSdkPhase("run_gate", () => Actor.apifyClient.run(runId).get());
  runGateChecks = verifyRuntimeGate({ actorEnv, processEnv: process.env, run, sdkApiMaxRetries: Actor.apifyClient.httpClient?.maxRetries });
  if (!runGateChecks.valid) throw new Error("run_gate_rejected");
  stage("run_gate_verified");

  const html = await readFile(new URL("../fixtures/readability-positive-v1.html", import.meta.url), "utf8");
  const fixtureHash = createHash("sha256").update(html).digest("hex");
  if (fixtureHash !== FIXTURE_SHA256) throw new Error("fixture_hash_mismatch");
  process.env.H12_REQUIRE_GUARD = "1";
  stage("worker_start_requested");
  const extracted = await extractBounded(html, "https://fixture.invalid/article", { WorkerClass: GuardedReadabilityWorker, deadlineMs: 5000 });
  stage("worker_parse_returned");
  if (workerCount !== 1 || extracted.status !== "complete" || extracted.readabilityStatus !== "success" ||
      extracted.readabilityWords !== EXPECTED_WORDS || extracted.outputChars !== EXPECTED_OUTPUT_CHARS || extracted.guardMarker !== true) {
    throw new Error("fixture_extract_failed");
  }
  fixtureResult = {
    workerStatus: extracted.status,
    readabilityStatus: extracted.readabilityStatus,
    readabilityWords: extracted.readabilityWords,
    outputChars: extracted.outputChars,
    workerGuardMarker: extracted.guardMarker,
  };
  const aggregate = {
    schemaVersion: "issue22-h14-fixture-v1",
    fixtureCount: 1,
    workerStatus: extracted.status,
    readabilityStatus: extracted.readabilityStatus,
    readabilityWords: extracted.readabilityWords,
    outputChars: extracted.outputChars,
    workerGuardMarker: extracted.guardMarker,
  };
  stage("aggregate_write_started");
  await withSdkPhase("aggregate_write", () => Actor.pushData(aggregate));
  aggregateWritten = true;
  stage("aggregate_written");

  const datasetId = process.env.APIFY_DEFAULT_DATASET_ID;
  const resultPage = await withSdkPhase("readback", () => Actor.apifyClient.dataset(datasetId).listItems({
    clean: true,
    fields: ["schemaVersion", "fixtureCount", "workerStatus", "readabilityStatus", "readabilityWords", "outputChars", "workerGuardMarker"],
    limit: 1,
  }));
  const expectedKeys = ["schemaVersion", "fixtureCount", "workerStatus", "readabilityStatus", "readabilityWords", "outputChars", "workerGuardMarker"].sort().join("|");
  const item = resultPage?.items?.[0];
  readbackVerified = resultPage?.items?.length === 1 && item && Object.keys(item).sort().join("|") === expectedKeys &&
    item.schemaVersion === "issue22-h14-fixture-v1" && item.fixtureCount === 1 &&
    item.workerStatus === "complete" && item.readabilityStatus === "success" &&
    item.readabilityWords === EXPECTED_WORDS && item.outputChars === EXPECTED_OUTPUT_CHARS && item.workerGuardMarker === true;
  if (!readbackVerified) throw new Error("readback_rejected");
  stage("readback_verified");
  exitCode = 0;
} catch (error) {
  failureCode = failure(error);
  stage("diagnostic_failed");
} finally {
  stage("exit_started");
  try {
    if (Actor.getDefaultInstance?.().initialized) await withSdkPhase("exit", () => Actor.exit({ exitCode, exit: false }));
    stage("exit_complete");
  } catch {
    failureCode = "exit_failed";
    exitCode = 1;
    stage("exit_failed");
  }
}

const output = {
  schemaVersion: "issue22-h14-hosted-result-v1",
  outcome: exitCode === 0 && readbackVerified ? "fixture_complete" : "failed",
  failureCode,
  stages,
  baseImageAttestation: "not_available_from_actor_runtime",
  nodeVersion: process.version,
  workerCount,
  workerStartedAfterFixtureGate: workerCount === 0 || stages.indexOf("fixture_gate_accepted") < stages.indexOf("worker_start_requested"),
  fixtureResult,
  aggregateWritten,
  readbackVerified,
  runGateChecks,
  sdkAllowedByPhase: state.sdkAllowedByPhase,
  applicationDeniedByApi: state.applicationDeniedByApi,
  tupleMiss: state.tupleMiss,
  socketDenied: state.socketDenied,
  dnsDenied: state.dnsDenied,
  observedTuples: state.tuples,
  hostedMode: process.env.H14_LOCAL_PREFLIGHT !== "1",
  ...(process.env.H14_LOCAL_PREFLIGHT === "1" && state.localRejectedSdkRoute ? { localRejectedSdkRoute: state.localRejectedSdkRoute } : {}),
};
process.stdout.write(`${JSON.stringify(output)}\n`);
process.exitCode = exitCode;
