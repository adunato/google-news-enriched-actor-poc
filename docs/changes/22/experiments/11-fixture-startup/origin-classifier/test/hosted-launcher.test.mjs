import test from "node:test";
import assert from "node:assert/strict";
import {
  launchWithApi,
  loadBundle,
  makeRunQuery,
  prepareWithApi,
  validateApproval,
} from "../tools/hosted-launcher.mjs";

const actorId = "mockH15Actor";
const buildId = "mockH15Build";
const buildNumber = "1.0.1";
const runId = "mockH15Run";
const actorName = "issue-22-h15-origin-classifier";

async function mockApi(bundle, tweaks = {}) {
  const sourceFiles = bundle.files.map(({ name, content }) => ({ format: "TEXT", name, content }));
  const build = {
    id: buildId, actId: actorId, status: "SUCCEEDED", buildNumber,
    actVersion: { sourceType: "SOURCE_FILES", versionNumber: "1.0", sourceFiles },
  };
  const actor = {
    id: actorId, name: actorName, isPublic: false,
    taggedBuilds: { [bundle.tag]: { buildId } },
    defaultRunOptions: { memoryMbytes: 256, timeoutSecs: 180, restartOnError: false, forcePermissionLevel: "LIMITED_PERMISSIONS" },
  };
  const version = { versionNumber: "1.0", sourceType: "SOURCE_FILES", buildTag: "h15-origin-v1", applyEnvVarsToBuild: false, envVars: [], sourceFiles };
  const run = { id: runId, actId: actorId, buildId, buildNumber, status: "RUNNING", options: { build: buildNumber, memoryMbytes: 256, timeoutSecs: 180, maxTotalChargeUsd: 0.1, restartOnError: false } };
  const calls = [];
  const api = {
    calls,
    async listOwnedActors() { calls.push("list-actors"); return tweaks.actors ?? []; },
    async createActor(payload) { calls.push("create-actor"); assert.equal(payload.isPublic, false); return { id: actorId }; },
    async getActor(id) { calls.push("get-actor"); assert.equal(id, actorId); return tweaks.badActor ? { ...actor, isPublic: true } : tweaks.badTag ? { ...actor, taggedBuilds: {} } : actor; },
    async getVersion(id) { calls.push("get-version"); assert.equal(id, actorId); return tweaks.badVersion ? { ...version, sourceFiles: [{ ...sourceFiles[0], content: "mismatch" }, ...sourceFiles.slice(1)] } : version; },
    async createBuild(id, query) { calls.push("create-build"); assert.equal(id, actorId); assert.equal(query.tag, bundle.tag); return build; },
    async getBuild(id) { calls.push("get-build"); assert.equal(id, buildId); return tweaks.badBuild ? { ...build, status: "FAILED" } : build; },
    async listActorRuns(id) { calls.push("list-runs"); assert.equal(id, actorId); return tweaks.priorRun ? [{ id: "prior", buildId, buildNumber }] : []; },
    async startRun(id, query, body) { calls.push("start-run"); assert.equal(id, actorId); assert.deepEqual(query, makeRunQuery(buildNumber)); assert.deepEqual(body, {}); return { id: runId }; },
    async getRun(id) { calls.push("get-run"); assert.equal(id, runId); return run; },
  };
  return { api, calls };
}

test("review gate binds prepare/run to reviewed commit, exact source digest, and clean package", () => {
  const commit = "a".repeat(40), sha = "b".repeat(64);
  assert.equal(validateApproval({ execute: false }).mode, "dry-run");
  assert.throws(() => validateApproval({ execute: true, reviewedCommit: commit, reviewedSourceSha256: sha, headCommit: commit, sourceSha256: sha, treeClean: false }), /worktree_dirty/u);
  assert.throws(() => validateApproval({ execute: true, reviewedCommit: commit, reviewedSourceSha256: sha, headCommit: commit, sourceSha256: "c".repeat(64), treeClean: true }), /source_digest_mismatch/u);
  assert.equal(validateApproval({ execute: true, reviewedCommit: commit, reviewedSourceSha256: sha, headCommit: commit, sourceSha256: sha, treeClean: true }).approved, true);
});

test("prepare creates one new private Actor and one exact successful build but no run", async () => {
  const bundle = await loadBundle({ git: false });
  const { api, calls } = await mockApi(bundle);
  const prepared = await prepareWithApi({ api, bundle });
  assert.equal(prepared.outcome, "private_actor_and_exact_build_prepared_no_run");
  assert.equal(prepared.actorPrivate, true);
  assert.equal(prepared.runStarted, false);
  assert.equal(calls.filter((call) => call === "create-actor").length, 1);
  assert.equal(calls.filter((call) => call === "create-build").length, 1);
  assert.equal(calls.includes("start-run"), false);
});

test("prepare collision or any actor/source/build mismatch stops before unsafe POST", async () => {
  const bundle = await loadBundle({ git: false });
  const collision = await mockApi(bundle, { actors: [{ name: "issue-22-h15-origin-classifier" }] });
  await assert.rejects(() => prepareWithApi({ api: collision.api, bundle }), /collision/u);
  assert.deepEqual(collision.calls, ["list-actors"]);

  for (const tweak of [{ badActor: true }, { badVersion: true }]) {
    const candidate = await mockApi(bundle, tweak);
    await assert.rejects(() => prepareWithApi({ api: candidate.api, bundle }));
    assert.equal(candidate.calls.includes("create-build"), false);
  }

  const badBuild = await mockApi(bundle, { badBuild: true });
  await assert.rejects(() => prepareWithApi({ api: badBuild.api, bundle }), /identity_or_status_mismatch/u);
  assert.equal(badBuild.calls.includes("start-run"), false);
});

test("one-run mode reads exact source/tag/settings and starts one run only", async () => {
  const bundle = await loadBundle({ git: false });
  const { api, calls } = await mockApi(bundle);
  const result = await launchWithApi({ api, bundle, actorId, buildId, buildNumber });
  assert.equal(result.outcome, "single_run_started_and_verified");
  assert.equal(result.run.status, "RUNNING");
  assert.equal(calls.filter((call) => call === "start-run").length, 1);
  assert.deepEqual(calls.filter((call) => call === "list-runs").length, 2);
});

test("one-run gate rejects bad tags, source, and prior build run before its only POST", async () => {
  const bundle = await loadBundle({ git: false });
  for (const [tweak, pattern] of [[{ badTag: true }, /build_tag_readback_mismatch/u], [{ badVersion: true }, /remote_source_mismatch/u], [{ priorRun: true }, /run_already_exists_for_build/u]]) {
    const candidate = await mockApi(bundle, tweak);
    await assert.rejects(() => launchWithApi({ api: candidate.api, bundle, actorId, buildId, buildNumber }), pattern);
    assert.equal(candidate.calls.includes("start-run"), false);
  }
});
