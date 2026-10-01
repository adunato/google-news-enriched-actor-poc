import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../../..");
const main = path.join(here, "main.mjs");
const probes = path.join(here, "probe-harness.mjs");
const preload = path.join(here, "guard-preload.mjs");
const writeEvidence = process.argv.includes("--write-evidence");

function run(target, { inputMode = "valid", probeProcess = false } = {}) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      H12_INPUT_MODE: inputMode,
      H12_DISCOVER_TUPLES: "0",
      H12_TUPLE_MANIFEST: path.join(here, "tuple-manifest.json"),
      H12_PHASE: probeProcess ? "guard_probe" : "bootstrap",
      H12_LOCAL_PORT: "43821",
      APIFY_API_BASE_URL: "http://127.0.0.1:43821",
      APIFY_IS_AT_HOME: "1",
      ACTOR_EVENTS_WEBSOCKET_URL: "",
      APIFY_TOKEN: "h12-local-only-token",
      ACTOR_RUN_ID: "H12fixtureRun00000000000001",
      ACTOR_ID: "H12fixtureActor0000000001",
      ACTOR_BUILD_ID: "H12fixtureBuild000000000001",
      ACTOR_BUILD_NUMBER: "11.0.0",
      CRAWLEE_PURGE_ON_START: "0",
      APIFY_DEFAULT_KEY_VALUE_STORE_ID: "issue22-h12-local-store",
      CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID: "issue22-h12-local-store",
      APIFY_DEFAULT_DATASET_ID: "issue22-h12-local-store",
      CRAWLEE_DEFAULT_DATASET_ID: "issue22-h12-local-store",
    };
    for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete env[key];
    const args = ["--import", pathToFileURL(preload).href, target];
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      try {
        const result = JSON.parse(output.trim().split(/\r?\n/).at(-1));
        resolve({ result, exitCode });
      } catch { resolve({ result: { outcome: "unclassified_startup_failure" }, exitCode }); }
    });
  });
}

const invalidRun = await run(main, { inputMode: "invalid" });
const probeRun = await run(probes, { probeProcess: true });
const firstRun = await run(main);
const repeatRun = await run(main);
const invalidAccepted = invalidRun.exitCode === 2 && invalidRun.result.outcome === "input_rejected" &&
  invalidRun.result.workerCount === 0 && invalidRun.result.stages.includes("input_rejected") &&
  !invalidRun.result.stages.includes("fixture_extracted") && !invalidRun.result.aggregatePersisted;
const probeAccepted = probeRun.exitCode === 0 && probeRun.result.outcome === "all_probes_denied" &&
  probeRun.result.probeProcess === true && probeRun.result.parentAttemptCount === 15 &&
  probeRun.result.workerAttemptCount === 42 && probeRun.result.allParentAndWorkerProbesDenied &&
  probeRun.result.stubCallsDuringProbes === 0;
const normalAccepted = (run) => run.exitCode === 0 && run.result.outcome === "fixture_complete" &&
  run.result.aggregatePersisted && run.result.aggregateWriteVerified && run.result.workerCount === 1 &&
  run.result.workerOnlyAfterInputGate && run.result.normalGuardDenials === 0 &&
  run.result.deniedApplication === 0 && run.result.tupleMiss === 0 && run.result.socketDenied === 0 &&
  run.result.fixtureResult?.wordCount === 26 && run.result.fixtureResult?.outputCharCount === 186 &&
  run.result.fixtureSha256 === "cb58978a9ba481956d382e4fc153a666767a718a2e05d0ce5f5b3172fe1b5614";
const repeatabilityAccepted = normalAccepted(firstRun) && normalAccepted(repeatRun) &&
  JSON.stringify(firstRun.result.fixtureResult) === JSON.stringify(repeatRun.result.fixtureResult) &&
  JSON.stringify(firstRun.result.observedTuples) === JSON.stringify(repeatRun.result.observedTuples);
const passed = invalidAccepted && probeAccepted && repeatabilityAccepted;
const report = {
  schemaVersion: "issue22-h12-local-evidence-v2",
  outcome: passed ? "fixture_complete" : "failed",
  runtimeImageDigest: firstRun.result.runtimeImageDigest ?? "not_container_reported",
  fixtureOnly: true,
  malformedInput: {
    outcome: invalidRun.result.outcome,
    expectedExitCode: 2,
    actualExitCode: invalidRun.exitCode,
    workerCount: invalidRun.result.workerCount ?? null,
    rejectedBeforeWorker: invalidAccepted,
    stages: invalidRun.result.stages ?? [],
  },
  negativeProbes: probeRun.result,
  negativeProbesInSeparateProcess: probeAccepted,
  normalFixtureRuns: [firstRun.result, repeatRun.result],
  repeatability: {
    passed: repeatabilityAccepted,
    identicalFixtureResults: JSON.stringify(firstRun.result.fixtureResult) === JSON.stringify(repeatRun.result.fixtureResult),
    identicalObservedTuples: JSON.stringify(firstRun.result.observedTuples) === JSON.stringify(repeatRun.result.observedTuples),
  },
  fixedFixture: {
    id: "readability-positive-v1",
    sha256: firstRun.result.fixtureSha256 ?? null,
    expectedWords: 26,
    expectedOutputChars: 186,
  },
  checks: {
    malformedInputRejectedBeforeWorker: invalidAccepted,
    separateNegativeProbeProcess: probeAccepted,
    oneGuardedWorkerPerValidRun: normalAccepted(firstRun) && normalAccepted(repeatRun),
    deterministicRepeatedOutput: repeatabilityAccepted,
  },
};
process.stdout.write(`${JSON.stringify(report)}\n`);
if (writeEvidence) await writeFile(path.resolve(here, "../evidence/local-result.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.exitCode = passed ? 0 : 1;
