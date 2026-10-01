import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSameSource,
  createActorPayload,
  createRunQuery,
  launchWithApi,
  loadSourceBundle,
  sourceDigest,
  validateReviewedApproval,
} from "./hosted-launcher.mjs";

const actorId = "mockActorH14";
const buildId = "mockBuildH14";
const runId = "mockRunH14";

async function mockApi(bundle, tweaks = {}) {
  const payload = createActorPayload(bundle);
  const sourceFiles = payload.versions[0].sourceFiles;
  const build = {
    id: buildId,
    actId: actorId,
    status: "SUCCEEDED",
    buildNumber: "1.0.1",
    actVersion: {
      sourceType: "SOURCE_FILES",
      versionNumber: "1.0",
      buildTag: `h14-fixture-v1-${bundle.sourceSha256.slice(0, 12)}`,
      sourceFiles,
    },
  };
  const actor = {
    id: actorId,
    name: "issue-22-h14-fixture-hosted-diagnostic",
    isPublic: false,
    taggedBuilds: { [build.actVersion.buildTag]: buildId },
    defaultRunOptions: {
      memoryMbytes: 256,
      timeoutSecs: 180,
      restartOnError: false,
      forcePermissionLevel: "LIMITED_PERMISSIONS",
    },
  };
  let actorReadCount = 0;
  const run = {
    id: runId,
    actId: actorId,
    buildId,
    buildNumber: "1.0.1",
    status: "READY",
    options: { build: "1.0.1", memoryMbytes: 256, timeoutSecs: 180, maxTotalChargeUsd: 0.1 },
  };
  const calls = [];
  const api = {
    calls,
    async listOwnedActors() { calls.push("list"); return tweaks.collidingActors ?? []; },
    async createActor(body) { calls.push("create"); assert.equal(body.isPublic, false); return { id: actorId }; },
    async getActor() {
      calls.push("actor");
      actorReadCount++;
      return tweaks.badActor || tweaks.badPreRunActor && actorReadCount > 1 ? { ...actor, isPublic: true } : actor;
    },
    async getVersion() { calls.push("version"); return { versionNumber: "1.0", sourceType: "SOURCE_FILES", buildTag: "h14-fixture-v1", applyEnvVarsToBuild: false, envVars: [], sourceFiles: tweaks.badVersion ? [{ ...sourceFiles[0], content: "changed" }] : sourceFiles }; },
    async createBuild(_id, query) { calls.push("build-create"); assert.deepEqual(query, { version: "1.0", useCache: false, betaPackages: false, tag: build.actVersion.buildTag, waitForFinish: 60 }); return build; },
    async getBuild() { calls.push("build-get"); return tweaks.badBuild ? { ...build, actVersion: { ...build.actVersion, sourceFiles: [{ ...sourceFiles[0], content: "changed" }] } } : build; },
    async startRun(_id, query, body) { calls.push("run-start"); assert.deepEqual(query, createRunQuery("1.0.1")); assert.deepEqual(body, { mode: "fixture-only", fixtureId: "readability-positive-v1" }); return { id: runId }; },
    async getRun() { calls.push("run-get"); return tweaks.badRun ? { ...run, options: { ...run.options, maxTotalChargeUsd: 1 } } : run; },
  };
  return { api, calls };
}

test("source digest is deterministic and remote source must match exact files", async () => {
  const bundle = await loadSourceBundle({ git: false });
  assert.equal(sourceDigest(bundle.files), bundle.sourceSha256);
  assert.equal(assertSameSource(bundle.files, createActorPayload(bundle).versions[0].sourceFiles), bundle.sourceSha256);
  assert.throws(() => assertSameSource(bundle.files, [{ ...createActorPayload(bundle).versions[0].sourceFiles[0], content: "altered" }]), /remote_source_mismatch/u);
});

test("review approval binds execute to exact committed source and clean package", () => {
  const sha = "a".repeat(64);
  const commit = "b".repeat(40);
  assert.deepEqual(validateReviewedApproval({ execute: false }), { approved: false, mode: "dry-run" });
  assert.throws(() => validateReviewedApproval({ execute: true, reviewedCommit: commit, reviewedSourceSha256: sha, headCommit: commit, sourceSha256: sha, treeClean: false }), /worktree_dirty/u);
  assert.throws(() => validateReviewedApproval({ execute: true, reviewedCommit: "c".repeat(40), reviewedSourceSha256: sha, headCommit: commit, sourceSha256: sha, treeClean: true }), /commit_mismatch/u);
  assert.throws(() => validateReviewedApproval({ execute: true, reviewedCommit: commit, reviewedSourceSha256: "d".repeat(64), headCommit: commit, sourceSha256: sha, treeClean: true }), /digest_mismatch/u);
  assert.equal(validateReviewedApproval({ execute: true, reviewedCommit: commit, reviewedSourceSha256: sha, headCommit: commit, sourceSha256: sha, treeClean: true }).approved, true);
});

test("launch uses only new private actor, exact build and bounded run, then reads back", async () => {
  const bundle = await loadSourceBundle({ git: false });
  const { api, calls } = await mockApi(bundle);
  const result = await launchWithApi({ api, bundle, sleep: async () => {} });
  assert.equal(result.outcome, "run_started_and_verified");
  assert.equal(result.actorPrivate, true);
  assert.equal(result.sourceVersionReadbackVerified, true);
  assert.equal(result.builtSourceReadbackVerified, true);
  assert.equal(result.run.restartOnErrorReadback, "not_exposed_by_run_api");
  assert.deepEqual(calls, ["list", "create", "actor", "version", "build-create", "actor", "version", "build-get", "run-start", "run-get"]);
});

test("collision, actor/source/build/run mismatches fail before an unsafe next mutation", async () => {
  const bundle = await loadSourceBundle({ git: false });
  const collision = await mockApi(bundle, { collidingActors: [{ name: "issue-22-h14-fixture-old" }] });
  await assert.rejects(() => launchWithApi({ api: collision.api, bundle, sleep: async () => {} }), /collision/u);
  assert.deepEqual(collision.calls, ["list"]);

  const badActor = await mockApi(bundle, { badActor: true });
  await assert.rejects(() => launchWithApi({ api: badActor.api, bundle, sleep: async () => {} }), /actor_settings_readback_mismatch/u);
  assert.equal(badActor.calls.includes("build-create"), false);

  const badVersion = await mockApi(bundle, { badVersion: true });
  await assert.rejects(() => launchWithApi({ api: badVersion.api, bundle, sleep: async () => {} }), /remote_source_mismatch/u);
  assert.equal(badVersion.calls.includes("build-create"), false);

  const badRun = await mockApi(bundle, { badRun: true });
  await assert.rejects(() => launchWithApi({ api: badRun.api, bundle, sleep: async () => {} }), /run_options_readback_mismatch/u);

  const changedBeforeRun = await mockApi(bundle, { badPreRunActor: true });
  await assert.rejects(() => launchWithApi({ api: changedBeforeRun.api, bundle, sleep: async () => {} }), /actor_settings_readback_mismatch/u);
  assert.equal(changedBeforeRun.calls.includes("run-start"), false);
});
