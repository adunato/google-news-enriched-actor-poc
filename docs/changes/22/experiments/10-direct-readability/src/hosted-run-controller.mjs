import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
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
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const name = relative(root, absolute).split(sep).join("/");
        if (name === "Dockerfile" || name === "package.json" || name === "package-lock.json" || name.startsWith("src/")) {
          files.push({ name, format: "TEXT", content: await readFile(absolute, "utf8") });
        }
      }
    }
  };
  await visit(root);
  return files.sort((a, b) => a.name.localeCompare(b.name));
};

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
    hashSourceFiles(version?.sourceFiles ?? []) === plan.sourceManifestSha256;
}

function buildMatches(build, plan) {
  return build?.status === "SUCCEEDED" &&
    build?.actVersion?.versionNumber === plan.version.versionNumber &&
    hashSourceFiles(build?.actVersion?.sourceFiles ?? []) === plan.sourceManifestSha256 &&
    typeof build?.buildNumber === "string" && build.buildNumber.length > 0;
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
    options.maxTotalChargeUsd === 1;
}

/**
 * Execute a future hosted launch using an explicitly supplied API adapter.
 * No adapter is bundled in this experiment, so the checked-in CLI is dry-run
 * only. A run POST is attempted once; an ambiguous response is reconciled by
 * listing runs created after the POST began and is never retried.
 */
export async function executeHostedRunPlan(plan, api) {
  if (!api || typeof api.createPrivateActor !== "function" || typeof api.setVersionSource !== "function" ||
    typeof api.getVersion !== "function" || typeof api.buildVersion !== "function" || typeof api.waitForBuild !== "function" || typeof api.getActor !== "function" ||
    typeof api.startRun !== "function" || typeof api.getRun !== "function" || typeof api.findRunsSince !== "function") {
    throw new Error("hosted_api_adapter_incomplete");
  }

  const actor = await api.createPrivateActor(plan.actor);
  if (!actor?.id || !actorIsSafe(actor)) throw new Error("actor_privacy_or_permission_gate_failed");

  await api.setVersionSource(actor.id, plan.version);
  const version = await api.getVersion(actor.id, plan.version.versionNumber);
  if (!versionMatches(version, plan)) throw new Error("version_source_snapshot_mismatch");

  const requestedBuild = await api.buildVersion(actor.id, plan.build.versionNumber);
  if (!requestedBuild?.id) throw new Error("build_creation_failed");
  const build = await api.waitForBuild(actor.id, requestedBuild.id);
  if (!buildMatches(build, plan)) throw new Error("build_snapshot_or_status_gate_failed");

  const actorReadback = await api.getActor(actor.id);
  if (!actorIsSafe(actorReadback)) throw new Error("actor_readback_privacy_or_permission_gate_failed");

  const buildNumber = build.buildNumber;
  const startedAt = Date.now();
  let run;
  try {
    run = await api.startRun(actor.id, exactRunOptions(buildNumber));
  } catch {
    const candidates = await api.findRunsSince(actor.id, startedAt);
    const exact = (candidates ?? []).filter((candidate) => runMatches(candidate, buildNumber, build.id));
    if (exact.length !== 1) throw new Error("run_start_ambiguous_reconciliation_required");
    run = exact[0];
  }
  if (!run?.id) throw new Error("run_start_returned_no_id");
  const runReadback = await api.getRun(run.id);
  if (!runMatches(runReadback, buildNumber, build.id)) throw new Error("run_readback_gate_failed");
  return { actorId: actor.id, buildId: build.id, buildNumber, runId: run.id, status: "run_started_after_readback" };
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
