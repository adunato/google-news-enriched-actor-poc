import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PROXY_ENV_KEYS } from "./runtime-origin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ids = {
  ACTOR_RUN_ID: "h15blocalrun000000000001",
  APIFY_DEFAULT_KEY_VALUE_STORE_ID: "h15blocalstore000000000001",
  APIFY_DEFAULT_DATASET_ID: "h15blocaldataset0000000001",
};
const localOrigin = "http://127.0.0.1:43822";
const fixtureHash = "cb58978a9ba481956d382e4fc153a666767a718a2e05d0ce5f5b3172fe1b5614";
const pinnedBaseDigest = "apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63";
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const actorConfig = JSON.parse(await readFile(path.join(root, ".actor/actor.json"), "utf8"));
const inputSchema = JSON.parse(await readFile(path.join(root, "INPUT_SCHEMA.json"), "utf8"));
const runOptions = JSON.parse(await readFile(path.join(root, "run-options.json"), "utf8"));
const deployFileList = JSON.parse(await readFile(path.join(root, "tools/deploy-file-list.json"), "utf8"));
const actorIgnore = await readFile(path.join(root, ".actorignore"), "utf8");
const tupleManifest = JSON.parse(await readFile(path.join(here, "tuple-manifest.json"), "utf8"));
const fixture = await readFile(path.join(root, "fixtures/readability-positive-v1.html"));
const pinnedVersions = {
  apify: packageJson.dependencies.apify === "3.7.2" && lock.packages["node_modules/apify"].version === "3.7.2",
  apifyClient: lock.packages["node_modules/apify-client"].version === "2.25.0",
  readability: packageJson.dependencies["@mozilla/readability"] === "0.6.0" && lock.packages["node_modules/@mozilla/readability"].version === "0.6.0",
  linkedom: packageJson.dependencies.linkedom === "0.18.13" && lock.packages["node_modules/linkedom"].version === "0.18.13",
  crawlee: lock.packages["node_modules/@crawlee/core"].version === "3.18.2",
};
const staticChecks = {
  packageVersionsPinned: Object.values(pinnedVersions).every(Boolean),
  baseImagePinned: (await readFile(path.join(root, "Dockerfile"), "utf8")).includes(`FROM ${pinnedBaseDigest}`),
  actorConfigValid: actorConfig.actorSpecification === 1 && actorConfig.name === "issue-22-h15b-private-origin-fixture" &&
    actorConfig.defaultRunOptions?.memoryMbytes === 256 && actorConfig.defaultRunOptions?.timeoutSecs === 180 &&
    actorConfig.defaultRunOptions?.restartOnError === false && actorConfig.defaultRunOptions?.forcePermissionLevel === "LIMITED_PERMISSIONS",
  exactFixtureSchema: inputSchema.additionalProperties === false && inputSchema.required.join("|") === "mode|fixtureId" && inputSchema.properties.mode.enum[0] === "fixture-only" && inputSchema.properties.fixtureId.enum[0] === "readability-positive-v1",
  boundedRunOptions: runOptions.privacy.startsWith("private Actor") && runOptions.memoryMbytes === 256 && runOptions.timeoutSecs === 180 && runOptions.maxTotalChargeUsd === 0.1 && runOptions.restartOnError === false && runOptions.sdkApiMaxRetries === 0,
  fixturePinned: createHash("sha256").update(fixture).digest("hex") === fixtureHash,
  tupleManifestFrozen: tupleManifest.schemaVersion === "issue22-h15b-sdk-tuples-v1" && tupleManifest.state === "source-checked" && tupleManifest.origin === "runtime-validated-private-ipv4" && tupleManifest.tuples.length === 7,
  deployAllowlistNarrow: deployFileList.includes("src/main.mjs") && deployFileList.includes("src/guard-preload.mjs") &&
    !deployFileList.some((name) => /(?:preflight|local-sdk-stub|guard-probe|hosted-launcher|deploy-file-list)/u.test(name)) &&
    actorIgnore.split(/\r?\n/u).includes("tools"),
};
if (!Object.values(staticChecks).every(Boolean)) throw new Error("h15b_static_preflight_failed");

const expectedTuples = tupleManifest.tuples.map((tuple) => ({
  method: tuple.method,
  path: tuple.path,
  phase: tuple.phase,
  originClass: "loopback_stub",
}));
const expectedCanonicalTuples = expectedTuples.map(JSON.stringify).sort();
const stub = spawn(process.execPath, [path.join(here, "local-sdk-stub.mjs")], { cwd: root, env: { ...process.env, H15B_STUB_INPUT_MODE: "valid" }, stdio: ["ignore", "pipe", "inherit", "ipc"] });
let stubReady = false;
let stubReport = null;
let stubOutput = "";
stub.stdout.setEncoding("utf8");
stub.stdout.on("data", (chunk) => {
  stubOutput += chunk;
  for (const line of stubOutput.split(/\r?\n/u)) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.ready === true) stubReady = true;
      if (Array.isArray(parsed.tuples)) stubReport = parsed;
    } catch { /* line is incomplete or fixed SDK log text */ }
  }
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("h15b_stub_start_timeout")), 5000);
  const poll = () => stubReady ? (clearTimeout(timer), resolve()) : setTimeout(poll, 20);
  stub.once("error", reject);
  poll();
});
function setStubInput(mode) {
  const requestId = `input-${mode}-${Date.now()}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("h15b_stub_input_mode_timeout")), 2000);
    const onMessage = (message) => {
      if (message?.type !== "input-set" || message.requestId !== requestId) return;
      clearTimeout(timer);
      stub.off("message", onMessage);
      resolve();
    };
    stub.on("message", onMessage);
    stub.send({ type: "input", mode, requestId });
  });
}

const baseEnv = {
  ...process.env,
  H15B_LOCAL_PREFLIGHT: "1",
  APIFY_API_BASE_URL: localOrigin,
  APIFY_IS_AT_HOME: "1",
  ACTOR_EVENTS_WEBSOCKET_URL: "",
  APIFY_ACTOR_EVENTS_WS_URL: "",
  APIFY_ACTOR_RUN_ID: ids.ACTOR_RUN_ID,
  APIFY_ACTOR_BUILD_ID: "h15blocalbuild000000000001",
  APIFY_ACTOR_BUILD_NUMBER: "1.0.0",
  APIFY_ACTOR_ID: "h15blocalactor000000000001",
  APIFY_MEMORY_MBYTES: "256",
  APIFY_STARTED_AT: "2026-01-01T00:00:00.000Z",
  APIFY_TIMEOUT_AT: "2026-01-01T00:03:00.000Z",
  APIFY_TOKEN: "h15b-local-only-token",
  ACTOR_RUN_ID: ids.ACTOR_RUN_ID,
  ACTOR_ID: "h15blocalactor000000000001",
  ACTOR_BUILD_ID: "h15blocalbuild000000000001",
  ACTOR_BUILD_NUMBER: "1.0.0",
  ACTOR_STARTED_AT: "2026-01-01T00:00:00.000Z",
  ACTOR_TIMEOUT_AT: "2026-01-01T00:03:00.000Z",
  ACTOR_PERMISSION_LEVEL: "LIMITED_PERMISSIONS",
  ACTOR_MEMORY_MBYTES: "256",
  ACTOR_MAX_TOTAL_CHARGE_USD: "0.1",
  ACTOR_RESTART_ON_ERROR: "0",
  CRAWLEE_PURGE_ON_START: "0",
  CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID: ids.APIFY_DEFAULT_KEY_VALUE_STORE_ID,
  CRAWLEE_DEFAULT_DATASET_ID: ids.APIFY_DEFAULT_DATASET_ID,
  ...ids,
};
for (const key of PROXY_ENV_KEYS) delete baseEnv[key];

function runChild(script, env, expectedExitCode = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", pathToFileURL(path.join(here, "guard-preload.mjs")).href, script], { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      const lastJsonLine = output.trim().split(/\r?\n/u).reverse().find((line) => line.startsWith("{"));
      let report;
      try { report = JSON.parse(lastJsonLine ?? "{}"); } catch { report = {}; }
      resolve({ code, report, expectedExitCode, passedExit: code === expectedExitCode });
    });
  });
}
function setStubRedirect() {
  const requestId = `redirect-${Date.now()}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("h15b_stub_redirect_mode_timeout")), 2000);
    const onMessage = (message) => {
      if (message?.type !== "redirect-set" || message.requestId !== requestId) return;
      clearTimeout(timer);
      stub.off("message", onMessage);
      resolve();
    };
    stub.on("message", onMessage);
    stub.send({ type: "redirect-next-run", requestId });
  });
}

let probeRun;
let invalidRun;
let redirectRun;
const validRuns = [];
try {
  probeRun = await runChild(path.join(here, "guard-probes.mjs"), baseEnv);
  await setStubInput("invalid");
  invalidRun = await runChild(path.join(here, "main.mjs"), { ...baseEnv, H15B_STUB_INPUT_MODE: "invalid" });
  await setStubInput("valid");
  await setStubRedirect();
  redirectRun = await runChild(path.join(here, "main.mjs"), { ...baseEnv, H15B_STUB_INPUT_MODE: "valid" });
  for (let index = 0; index < 2; index++) validRuns.push(await runChild(path.join(here, "main.mjs"), { ...baseEnv, H15B_STUB_INPUT_MODE: "valid" }));
  stub.send({ type: "report" });
  await new Promise((resolve) => setTimeout(resolve, 30));
} finally {
  stub.send({ type: "close" });
  await new Promise((resolve) => { if (stub.exitCode !== null) resolve(); else stub.once("exit", resolve); });
}

const negativeProbesPassed = probeRun?.passedExit && probeRun.report.passed === true && probeRun.report.parentAttemptCount === 15 && probeRun.report.workerAttemptCount === 42;
const invalidInputPassed = invalidRun?.code === 1 && invalidRun.report.outcome === "failed" && invalidRun.report.failureCode === "h15b_fixture_input_rejected" && invalidRun.report.workerCount === 0 && !invalidRun.report.stages.includes("worker_start_requested");
const redirectDenied = redirectRun?.code === 1 && redirectRun.report.outcome === "failed" && redirectRun.report.failureCode === "h15b_network_denied" && redirectRun.report.workerCount === 0 && redirectRun.report.tupleMiss > 0;
const validAccepted = (run) => run?.passedExit && run.report.outcome === "fixture_complete" && run.report.workerCount === 1 && run.report.workerStartedAfterFixtureGate && run.report.aggregateWritten && run.report.readbackVerified && run.report.runGateChecks?.valid && Object.values(run.report.applicationDeniedByApi).every((count) => count === 0) && run.report.tupleMiss === 0 && run.report.socketDenied === 0 && run.report.dnsDenied === 0 && run.report.fixtureResult?.readabilityWords === 26 && run.report.fixtureResult?.outputChars === 186;
const validRunsPassed = validRuns.length === 2 && validRuns.every(validAccepted) && JSON.stringify(validRuns[0].report.fixtureResult) === JSON.stringify(validRuns[1].report.fixtureResult);
const tupleObserved = validRuns.every((run) => JSON.stringify(run.report.observedTuples.map(JSON.stringify).sort()) === JSON.stringify(expectedCanonicalTuples));
const stubObserved = stubReport?.itemCount === 2 && stubReport.tuples.length === 18 && !stubReport.tuples.some((tuple) => tuple.path === "/v2/not-allowlisted");
const passed = negativeProbesPassed && invalidInputPassed && redirectDenied && validRunsPassed && tupleObserved && stubObserved;
const stubRoutes = new Set();
for (const tuple of stubReport?.tuples ?? []) {
  let route = tuple.path;
  for (const [name, value] of Object.entries(ids)) route = route.replaceAll(value, `{${name}}`);
  stubRoutes.add(`${tuple.method} ${route}`);
}
const stubRoutePatterns = [...stubRoutes].sort();
const output = {
  schemaVersion: "issue22-h15b-local-preflight-v1",
  outcome: passed ? "passed" : "failed",
  staticChecks,
  negativeProbes: { passed: negativeProbesPassed, result: probeRun?.report ?? null },
  malformedInput: { passed: invalidInputPassed, failureCode: invalidRun?.report.failureCode ?? null, workerCount: invalidRun?.report.workerCount ?? null, stages: invalidRun?.report.stages ?? [] },
  redirect: { passed: redirectDenied, failureCode: redirectRun?.report.failureCode ?? null, tupleMiss: redirectRun?.report.tupleMiss ?? null, workerCount: redirectRun?.report.workerCount ?? null, destinationReached: stubReport?.tuples.some((tuple) => tuple.path === "/v2/not-allowlisted") ?? false },
  validRuns: validRuns.map((run) => ({ outcome: run.report.outcome, failureCode: run.report.failureCode, workerCount: run.report.workerCount, aggregateWritten: run.report.aggregateWritten, readbackVerified: run.report.readbackVerified, fixtureResult: run.report.fixtureResult, runGateChecks: run.report.runGateChecks, normalDenials: run.report.applicationDeniedByApi, localRejectedSdkRoute: run.report.localRejectedSdkRoute ?? null, tuples: run.report.observedTuples ?? [] })),
  exactTupleSetMatched: tupleObserved,
  stub: { requestCount: stubReport?.tuples.length ?? null, aggregateCount: stubReport?.itemCount ?? null, routePatterns: stubRoutePatterns },
  baseImage: pinnedBaseDigest,
  hostedAuthenticationAvailable: "verified separately with filtered read-only CLI check; no API credential content retained",
  hostedBuildOrRunPerformed: false,
};
process.stdout.write(`${JSON.stringify(output)}\n`);
process.exitCode = passed ? 0 : 1;
