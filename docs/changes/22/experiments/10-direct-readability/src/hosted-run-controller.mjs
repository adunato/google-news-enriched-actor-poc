import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HOSTED_RUN_OPTIONS = Object.freeze({
  build: null,
  memoryMbytes: 256,
  timeoutSecs: 900,
  maxTotalChargeUsd: 1,
  restartOnError: false,
  forcePermissionLevel: "LIMITED_PERMISSIONS",
});

const sourceFilesFromTree = async (root) => {
  const files = [];
  for (const name of SOURCE_ALLOWLIST) files.push({ name, format: "TEXT", content: await readFile(join(root, ...name.split("/")), "utf8") });
  return files.sort((a, b) => a.name.localeCompare(b.name));
};

export const SOURCE_ALLOWLIST = Object.freeze([
  "Dockerfile", "package.json", "package-lock.json", "src/aggregate.mjs", "src/extract-worker.mjs",
  "src/apify-cli-adapter.mjs", "src/extract.mjs", "src/hosted-run-controller.mjs", "src/launch-hosted-run.mjs",
  "src/network.mjs", "src/probe.mjs", "src/preflight.mjs", "src/runtime-gate.mjs", "src/run-approval.mjs",
  "src/source-continuity.mjs", "src/verify-run-options.mjs",
]);

export function hashSourceFiles(files) {
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name));
  const hash = createHash("sha256");
  for (const file of ordered) {
    if (typeof file.name !== "string" || typeof file.content !== "string") throw new Error("invalid_source_manifest");
    hash.update(file.name);
    hash.update("\0");
    hash.update(Buffer.from(file.content, "utf8"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function createHostedRunPlan({ sourceRoot, versionNumber = "10.0" }) {
  if (!/^[0-9]+\.[0-9]+$/.test(versionNumber)) throw new Error("invalid_version_number");
  const root = resolve(sourceRoot);
  const sourceFiles = await sourceFilesFromTree(root);
  if (!sourceFiles.some((file) => file.name === "src/runtime-gate.mjs") || !sourceFiles.some((file) => file.name === "src/probe.mjs")) {
    throw new Error("source_manifest_missing_required_file");
  }
  const sourceManifestSha256 = hashSourceFiles(sourceFiles);
  const runOptions = { ...HOSTED_RUN_OPTIONS };
  return {
    actor: {
      name: "issue22-i10-readability-probe",
      title: "Issue 22 Iteration 10 Readability Probe",
      description: "Private disposable actor for the approved Issue 22 Iteration 10 technical spike.",
      isPublic: false,
      actorPermissionLevel: "LIMITED_PERMISSIONS",
      defaultRunOptions: { build: versionNumber, memoryMbytes: 256, timeoutSecs: 900, restartOnError: false, forcePermissionLevel: "LIMITED_PERMISSIONS" },
    },
    version: { versionNumber, sourceType: "SOURCE_FILES", sourceFiles },
    build: { versionNumber },
    run: { ...runOptions, build: null },
    sourceManifestSha256,
    sourcePaths: sourceFiles.map(({ name }) => name),
  };
}

function actorIsSafe(actor) {
  return actor?.isPublic === false && actor?.actorPermissionLevel === "LIMITED_PERMISSIONS";
}

function versionMatches(version, plan) {
  return version?.versionNumber === plan.version.versionNumber &&
    version?.sourceType === "SOURCE_FILES" &&
    sourceSnapshotsEqual(version?.sourceFiles ?? [], plan.version.sourceFiles) &&
    hashSourceFiles(version?.sourceFiles ?? []) === plan.sourceManifestSha256;
}

function buildMatches(build, plan) {
  return build?.status === "SUCCEEDED" &&
    build?.actVersion?.versionNumber === plan.version.versionNumber &&
    sourceSnapshotsEqual(build?.actVersion?.sourceFiles ?? [], plan.version.sourceFiles) &&
    hashSourceFiles(build?.actVersion?.sourceFiles ?? []) === plan.sourceManifestSha256 &&
    typeof build?.buildNumber === "string" && build.buildNumber.length > 0;
}

export function sourceSnapshotsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].sort((x, y) => String(x?.name).localeCompare(String(y?.name)));
  const b = [...right].sort((x, y) => String(x?.name).localeCompare(String(y?.name)));
  return a.every((file, i) => file?.name === b[i]?.name && file?.format === b[i]?.format &&
    Buffer.from(file?.content ?? "", "utf8").equals(Buffer.from(b[i]?.content ?? "", "utf8")));
}

function exactRunOptions(buildNumber) {
  return { ...HOSTED_RUN_OPTIONS, build: buildNumber };
}

function runMatches(run, buildNumber, buildId) {
  const options = run?.options ?? {};
  return run?.buildNumber === buildNumber &&
    run?.buildId === buildId &&
    options.build === buildNumber &&
    options.memoryMbytes === 256 &&
    options.timeoutSecs === 900 &&
    options.maxTotalChargeUsd === 1 &&
    (!Object.hasOwn(options, "restartOnError") || options.restartOnError === false) &&
    (!Object.hasOwn(options, "forcePermissionLevel") || options.forcePermissionLevel === "LIMITED_PERMISSIONS");
}

function exactLaunchInput({ marker, actorId, buildId, buildNumber }) {
  return { i10LaunchMarker: marker, expectedActorId: actorId, expectedBuildId: buildId, expectedBuildNumber: buildNumber };
}

function launchInputMatches(input, expected) {
  return input && input.i10LaunchMarker === expected.i10LaunchMarker &&
    input.expectedActorId === expected.expectedActorId && input.expectedBuildId === expected.expectedBuildId &&
    input.expectedBuildNumber === expected.expectedBuildNumber;
}

const gateRecord = ({ marker, actorId, buildId, buildNumber, runId }) => ({ schemaVersion: "i10-run-approval-v1", marker, actorId, buildId, buildNumber, runId });
const terminalRunStatus = (status) => ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status);

/**
 * Execute a future hosted launch using an explicitly supplied API adapter.
 * No adapter is bundled in this experiment, so the checked-in CLI is dry-run
 * only. A run POST is attempted once; an ambiguous response is reconciled by
 * listing runs created after the POST began and is never retried.
 */
export async function executeHostedRunPlan(plan, api, { sourceCheck } = {}) {
  if (typeof sourceCheck !== "function") throw new Error("source_continuity_check_required");
  const assertContinuity = async () => {
    const continuity = await sourceCheck(plan);
    if (!continuity?.valid || continuity.sourceManifestSha256 !== plan.sourceManifestSha256) throw new Error("source_continuity_gate_failed");
  };
  await assertContinuity();
  if (!api || typeof api.createPrivateActor !== "function" || typeof api.setVersionSource !== "function" ||
    typeof api.getVersion !== "function" || typeof api.buildVersion !== "function" || typeof api.waitForBuild !== "function" || typeof api.getActor !== "function" ||
    typeof api.startRun !== "function" || typeof api.getRun !== "function" || typeof api.findRunsSince !== "function" ||
    typeof api.getRunInput !== "function" || typeof api.putRunGate !== "function" || typeof api.getRunGate !== "function" || typeof api.abortRun !== "function") {
    throw new Error("hosted_api_adapter_incomplete");
  }

  await assertContinuity();
  const actor = await api.createPrivateActor(plan.actor);
  if (!actor?.id || !actorIsSafe(actor)) throw new Error("actor_privacy_or_permission_gate_failed");

  await assertContinuity();
  await api.setVersionSource(actor.id, plan.version);
  const version = await api.getVersion(actor.id, plan.version.versionNumber);
  if (!versionMatches(version, plan)) throw new Error("version_source_snapshot_mismatch");

  await assertContinuity();
  const requestedBuild = await api.buildVersion(actor.id, plan.build.versionNumber);
  if (!requestedBuild?.id) throw new Error("build_creation_failed");
  const build = await api.waitForBuild(actor.id, requestedBuild.id);
  if (!buildMatches(build, plan)) throw new Error("build_snapshot_or_status_gate_failed");

  const actorReadback = await api.getActor(actor.id);
  if (!actorIsSafe(actorReadback)) throw new Error("actor_readback_privacy_or_permission_gate_failed");

  const buildNumber = build.buildNumber;
  const marker = randomUUID();
  const expectedInput = exactLaunchInput({ marker, actorId: actor.id, buildId: build.id, buildNumber });
  await assertContinuity();
  const startedAt = Date.now();
  let run;
  try {
    run = await api.startRun(actor.id, { ...exactRunOptions(buildNumber), input: expectedInput });
  } catch {
    const candidates = await api.findRunsSince(actor.id, startedAt);
    const reconciled = [];
    for (const candidate of candidates ?? []) if (candidate?.id) {
      let markerMatched = false;
      try { markerMatched = launchInputMatches(await api.getRunInput(candidate.id), expectedInput); } catch { /* unavailable input still leaves a recent run unauthorized */ }
      reconciled.push({ candidate, markerMatched });
    }
    // This is a newly created private Actor. Abort every recent candidate: an
    // unreadable or different marker cannot authorize a run after an ambiguous POST.
    const matching = reconciled.filter(({ markerMatched }) => markerMatched).map(({ candidate }) => candidate);
    const unmatched = reconciled.filter(({ markerMatched }) => !markerMatched).map(({ candidate }) => candidate);
    const abortQueue = [...matching, ...unmatched];
    for (const candidate of abortQueue) await api.abortRun(candidate.id);
    for (const candidate of abortQueue) {
      const confirmed = await api.getRun(candidate.id);
      if (!terminalRunStatus(confirmed?.status)) throw new Error("ambiguous_run_abort_not_confirmed");
    }
    throw new Error("run_start_ambiguous_aborted_no_retry");
  }
  if (!run?.id) throw new Error("run_start_returned_no_id");
  let runReadback;
  try {
    runReadback = await api.getRun(run.id);
    const actualInput = await api.getRunInput(run.id);
    const finalActorReadback = await api.getActor(actor.id);
    if (runReadback?.id !== run.id || !runMatches(runReadback, buildNumber, build.id) || !launchInputMatches(actualInput, expectedInput) || !actorIsSafe(finalActorReadback)) {
      throw new Error("run_readback_gate_failed");
    }
    const expectedGate = gateRecord({ marker, actorId: actor.id, buildId: build.id, buildNumber, runId: run.id });
    await assertContinuity();
    await api.putRunGate(run.id, expectedGate);
    const gateDeadline = Date.now() + 30000;
    while (Date.now() < gateDeadline) {
      const observed = await api.getRunGate(run.id);
      if (observed && Object.keys(expectedGate).every((key) => observed[key] === expectedGate[key])) {
        return { actorId: actor.id, buildId: build.id, buildNumber, runId: run.id, status: "run_approved_after_readback" };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("run_gate_record_not_observed");
  } catch (error) {
    await api.abortRun(run.id);
    const confirmed = await api.getRun(run.id);
    if (!terminalRunStatus(confirmed?.status)) throw new Error("run_abort_not_confirmed");
    throw error;
  }
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const root = resolve(modulePath, "../..");
  const plan = await createHostedRunPlan({ sourceRoot: root });
  console.log(JSON.stringify({
    status: "dry_run_only",
    actorVisibility: "PRIVATE",
    permissionLevel: "LIMITED_PERMISSIONS",
    versionNumber: plan.version.versionNumber,
    sourceFileCount: plan.sourcePaths.length,
    sourceManifestSha256: plan.sourceManifestSha256,
    run: { memoryMbytes: 256, timeoutSecs: 900, maxTotalChargeUsd: 1, restartOnError: false, forcePermissionLevel: "LIMITED_PERMISSIONS", build: "resolved-after-successful-build" },
    hostedActorCreated: false,
    buildStarted: false,
    runStarted: false,
  }));
}
