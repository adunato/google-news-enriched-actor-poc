import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const actorName = "issue-22-h15-origin-classifier";
const actorVersion = "1.0";
const buildTag = "h15-origin-v1";
const settings = Object.freeze({ memoryMbytes: 256, timeoutSecs: 180, maxTotalChargeUsd: 0.1, restartOnError: false, forcePermissionLevel: "LIMITED_PERMISSIONS" });
const input = Object.freeze({});
const terminalBuildStatuses = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function canonical(value) { return JSON.stringify(value); }
function sortByName(a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; }

export function sourceDigest(files) {
  return hash(canonical(files.map(({ name, content }) => ({ name, content })).sort(sortByName)));
}

export async function loadBundle({ rootDir = root, git = true } = {}) {
  const names = JSON.parse(await readFile(path.join(here, "deploy-file-list.json"), "utf8"));
  if (!Array.isArray(names) || names.length !== 9 || new Set(names).size !== names.length) throw new Error("deploy_file_list_invalid");
  const files = [];
  for (const name of names) {
    if (typeof name !== "string" || name.startsWith("/") || name.split("/").includes("..")) throw new Error("deploy_file_list_invalid");
    const absolute = path.join(rootDir, ...name.split("/"));
    const info = await lstat(absolute);
    const resolved = await realpath(absolute);
    const relative = path.relative(rootDir, resolved);
    if (info.isSymbolicLink() || !info.isFile() || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("deploy_file_not_regular");
    files.push({ name, content: await readFile(absolute, "utf8") });
  }
  files.sort(sortByName);
  const actor = JSON.parse(files.find((file) => file.name === ".actor/actor.json").content);
  const schema = JSON.parse(files.find((file) => file.name === "INPUT_SCHEMA.json").content);
  const dockerfile = files.find((file) => file.name === "Dockerfile").content;
  const baseDigest = dockerfile.match(/^FROM\s+(apify\/actor-node@sha256:[0-9a-f]{64})\s*$/mu)?.[1];
  if (actor?.name !== actorName || actor?.version !== "1.0.0" || actor?.actorSpecification !== 1 ||
      actor?.dockerfile !== "Dockerfile" || actor?.defaultRunOptions?.memoryMbytes !== settings.memoryMbytes ||
      actor?.defaultRunOptions?.timeoutSecs !== settings.timeoutSecs || actor?.defaultRunOptions?.restartOnError !== false ||
      actor?.defaultRunOptions?.forcePermissionLevel !== settings.forcePermissionLevel || !baseDigest ||
      schema?.additionalProperties !== false || Object.keys(schema?.properties ?? {}).length !== 0) {
    throw new Error("local_candidate_contract_failed");
  }
  let headCommit = "local-uncommitted";
  let treeClean = false;
  if (git) {
    headCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: rootDir, encoding: "utf8" }).trim();
    const relativeRoot = path.relative(repoRoot, rootDir).replaceAll("\\", "/");
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", relativeRoot], { cwd: repoRoot, encoding: "utf8" });
    treeClean = status.trim().length === 0;
  }
  const sourceSha256 = sourceDigest(files);
  return { files, sourceSha256, headCommit, treeClean, baseDigest, tag: `${buildTag}-${sourceSha256.slice(0, 12)}` };
}

export function validateApproval({ execute, reviewedCommit, reviewedSourceSha256, headCommit, sourceSha256, treeClean }) {
  if (!execute) return { approved: false, mode: "dry-run" };
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(reviewedCommit ?? "") || reviewedCommit !== headCommit) throw new Error("reviewed_commit_mismatch");
  if (!/^[0-9a-f]{64}$/u.test(reviewedSourceSha256 ?? "") || reviewedSourceSha256 !== sourceSha256) throw new Error("reviewed_source_digest_mismatch");
  if (!treeClean) throw new Error("candidate_package_worktree_dirty");
  return { approved: true, mode: "execute" };
}

function validateTarget({ actorId, buildId, buildNumber }) {
  if (![actorId, buildId].every((value) => typeof value === "string" && /^[A-Za-z0-9_-]+$/u.test(value)) ||
      typeof buildNumber !== "string" || !/^\d+\.\d+\.\d+$/u.test(buildNumber)) throw new Error("target_identity_invalid");
}

function remoteSourceDigest(expectedFiles, remoteFiles) {
  if (!Array.isArray(remoteFiles) || remoteFiles.length !== expectedFiles.length) throw new Error("remote_source_shape_mismatch");
  const actual = remoteFiles.map((file) => {
    if (file.folder === true || typeof file.name !== "string" || file.format !== "TEXT" || typeof file.content !== "string") throw new Error("remote_source_shape_mismatch");
    return { name: file.name.replaceAll("\\", "/"), content: file.content };
  }).sort(sortByName);
  if (canonical(actual) !== canonical(expectedFiles)) throw new Error("remote_source_mismatch");
  return sourceDigest(actual);
}

function verifyActor(actor, actorId) {
  const options = actor?.defaultRunOptions ?? {};
  if (actor?.id !== actorId || actor?.name !== actorName || actor?.isPublic !== false ||
      options.memoryMbytes !== settings.memoryMbytes || options.timeoutSecs !== settings.timeoutSecs ||
      options.restartOnError !== false || options.forcePermissionLevel !== settings.forcePermissionLevel) throw new Error("actor_settings_readback_mismatch");
}

function verifyVersion(version, bundle) {
  if (version?.versionNumber !== actorVersion || version?.sourceType !== "SOURCE_FILES" || version?.buildTag !== buildTag ||
      version?.applyEnvVarsToBuild !== false || !(version?.envVars == null || Array.isArray(version.envVars) && version.envVars.length === 0)) {
    throw new Error("version_readback_mismatch");
  }
  remoteSourceDigest(bundle.files, version.sourceFiles);
}

function verifyBuild(build, actorId, bundle, buildId, buildNumber) {
  if (build?.id !== buildId || build?.actId !== actorId || build?.status !== "SUCCEEDED" || build?.buildNumber !== buildNumber ||
      build?.actVersion?.versionNumber !== actorVersion || build?.actVersion?.sourceType !== "SOURCE_FILES") throw new Error("build_identity_or_status_mismatch");
  remoteSourceDigest(bundle.files, build.actVersion.sourceFiles);
}

function verifyTag(actor, tag, buildId) {
  const value = actor?.taggedBuilds?.[tag];
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.buildId !== "string" || !value.buildId || value.buildId !== buildId) {
    throw new Error("build_tag_readback_mismatch");
  }
}

function verifyNoPriorRun(runs, build) {
  if (!Array.isArray(runs)) throw new Error("actor_runs_readback_invalid");
  if (runs.some((run) => run?.buildId === build.id || run?.buildNumber === build.buildNumber)) throw new Error("run_already_exists_for_build");
}

function actorPayload(bundle) {
  return {
    name: actorName,
    title: "Issue 22 H15 API Origin Classifier",
    description: "Private no-dispatch diagnostic that classifies API base URL shape without retaining its value.",
    isPublic: false,
    versions: [{ versionNumber: actorVersion, sourceType: "SOURCE_FILES", applyEnvVarsToBuild: false, buildTag, envVars: [],
      sourceFiles: bundle.files.map(({ name, content }) => ({ format: "TEXT", name, content })) }],
    defaultRunOptions: { memoryMbytes: settings.memoryMbytes, timeoutSecs: settings.timeoutSecs, restartOnError: false,
      forcePermissionLevel: settings.forcePermissionLevel },
  };
}

function preparePlan(bundle) {
  return {
    outcome: "dry_run_only",
    mode: "prepare-private-actor-and-build",
    remoteMutation: false,
    actorName,
    actorIsPublic: false,
    actorVersion,
    buildTag: bundle.tag,
    sourceSha256: bundle.sourceSha256,
    sourceFileCount: bundle.files.length,
    actorCreateBodySha256: hash(canonical(actorPayload(bundle))),
    baseImageDigest: bundle.baseDigest,
    defaultRunOptions: settings,
    buildRequest: { method: "POST", endpoint: "/v2/actors/:actorId/builds", query: {
      version: actorVersion, useCache: false, betaPackages: false, tag: bundle.tag, waitForFinish: 60,
    } },
    runStarted: false,
  };
}

function assertNoNameCollision(items) {
  if (!Array.isArray(items) || items.some((item) => typeof item?.name === "string" && item.name.startsWith("issue-22-h15-origin"))) {
    throw new Error("actor_name_collision_or_list_invalid");
  }
}

export async function prepareWithApi({ api, bundle, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), buildWaitMs = 15 * 60_000 }) {
  assertNoNameCollision(await api.listOwnedActors());
  const created = await api.createActor(actorPayload(bundle));
  const actorId = created?.id;
  if (typeof actorId !== "string" || !/^[A-Za-z0-9_-]+$/u.test(actorId)) throw new Error("actor_create_response_invalid");
  let actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  let version = await api.getVersion(actorId, actorVersion);
  verifyVersion(version, bundle);

  let build = await api.createBuild(actorId, { version: actorVersion, useCache: false, betaPackages: false, tag: bundle.tag, waitForFinish: 60 });
  if (typeof build?.id !== "string" || !/^[A-Za-z0-9_-]+$/u.test(build.id)) throw new Error("build_create_response_invalid");
  const stopAt = Date.now() + buildWaitMs;
  while (!terminalBuildStatuses.has(build.status)) {
    if (Date.now() >= stopAt) throw new Error("build_wait_timeout");
    await sleep(5000);
    build = await api.getBuild(build.id);
  }
  verifyBuild(build, actorId, bundle, build.id, build.buildNumber);
  if (build.status !== "SUCCEEDED") throw new Error("build_not_succeeded");

  actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  verifyTag(actor, bundle.tag, build.id);
  version = await api.getVersion(actorId, actorVersion);
  verifyVersion(version, bundle);
  build = await api.getBuild(build.id);
  verifyBuild(build, actorId, bundle, build.id, build.buildNumber);
  if (build.status !== "SUCCEEDED") throw new Error("build_not_succeeded");
  return { outcome: "private_actor_and_exact_build_prepared_no_run", actorId, buildId: build.id, buildNumber: build.buildNumber,
    sourceSha256: bundle.sourceSha256, actorPrivate: true, sourceReadbackVerified: true, buildReadbackVerified: true,
    buildTagReadbackVerified: true, runStarted: false };
}

export function makeRunQuery(buildNumber) {
  if (!/^\d+\.\d+\.\d+$/u.test(buildNumber ?? "")) throw new Error("build_number_invalid");
  return { build: buildNumber, memory: settings.memoryMbytes, timeout: settings.timeoutSecs, maxTotalChargeUsd: settings.maxTotalChargeUsd,
    restartOnError: false, forcePermissionLevel: settings.forcePermissionLevel, waitForFinish: 0 };
}

function verifyRun(run, actorId, build) {
  const options = run?.options ?? {};
  if (run?.actId !== actorId || run?.buildId !== build.id || run?.buildNumber !== build.buildNumber ||
      options.build !== build.buildNumber || options.memoryMbytes !== settings.memoryMbytes || options.timeoutSecs !== settings.timeoutSecs ||
      options.maxTotalChargeUsd !== settings.maxTotalChargeUsd || options.restartOnError !== false) throw new Error("run_readback_mismatch");
  return { status: typeof run.status === "string" ? run.status : "unknown", buildNumber: run.buildNumber,
    memoryMbytes: options.memoryMbytes, timeoutSecs: options.timeoutSecs, maxTotalChargeUsd: options.maxTotalChargeUsd,
    restartOnError: options.restartOnError, permission: "actor_default_readback_plus_exact_run_query" };
}

export async function launchWithApi({ api, bundle, actorId, buildId, buildNumber }) {
  validateTarget({ actorId, buildId, buildNumber });
  const buildTag = bundle.tag;
  let actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  verifyTag(actor, buildTag, buildId);
  let version = await api.getVersion(actorId, actorVersion);
  verifyVersion(version, bundle);
  let build = await api.getBuild(buildId);
  verifyBuild(build, actorId, bundle, buildId, buildNumber);
  verifyNoPriorRun(await api.listActorRuns(actorId), build);

  actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  verifyTag(actor, buildTag, buildId);
  version = await api.getVersion(actorId, actorVersion);
  verifyVersion(version, bundle);
  build = await api.getBuild(buildId);
  verifyBuild(build, actorId, bundle, buildId, buildNumber);
  verifyNoPriorRun(await api.listActorRuns(actorId), build);

  const started = await api.startRun(actorId, makeRunQuery(buildNumber), input);
  if (typeof started?.id !== "string" || !/^[A-Za-z0-9_-]+$/u.test(started.id)) throw new Error("run_start_response_invalid");
  const run = await api.getRun(started.id);
  return { outcome: "single_run_started_and_verified", actorIdSha256: hash(actorId), buildIdSha256: hash(buildId), runIdSha256: hash(run.id),
    sourceSha256: bundle.sourceSha256, buildNumber, actorPrivate: true, sourceReadbackVerified: true, noPriorRunVerified: true,
    run: verifyRun(run, actorId, build) };
}

function parseApi(text) {
  try {
    const parsed = JSON.parse(text.trim());
    if (!parsed || typeof parsed !== "object" || !Object.hasOwn(parsed, "data")) throw new Error("bad_shape");
    return parsed.data;
  } catch { throw new Error("authenticated_cli_response_invalid"); }
}

export function makeCliApi() {
  const request = (method, endpoint, params, body) => new Promise((resolve, reject) => {
    const query = params && Object.keys(params).length ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : "";
    const pathWithQuery = `${endpoint}${query}`;
    if (!/^[A-Za-z0-9/?=&._~-]+$/u.test(pathWithQuery)) return reject(new Error("api_endpoint_invalid"));
    const quote = process.platform === "win32" ? `"${pathWithQuery}"` : `'${pathWithQuery}'`;
    const child = spawn(`apify api ${method} ${quote}${body === undefined ? "" : " --body -"}`, { shell: true, stdio: ["pipe", "pipe", "ignore"] });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => { child.kill(); if (!settled) { settled = true; reject(new Error("authenticated_cli_timeout")); } }, 60000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; if (output.length > 16 * 1024 * 1024) child.kill(); });
    child.once("error", () => { clearTimeout(timer); if (!settled) { settled = true; reject(new Error("authenticated_cli_unavailable")); } });
    child.once("close", (code) => { clearTimeout(timer); if (settled) return; settled = true; if (code !== 0) return reject(new Error(`authenticated_cli_http_${code ?? "unknown"}`)); try { resolve(parseApi(output)); } catch (error) { reject(error); } });
    if (body === undefined) child.stdin.end(); else child.stdin.end(JSON.stringify(body));
  });
  return {
    async listOwnedActors() {
      const all = []; let offset = 0; let total = Infinity;
      while (offset < total) {
        const page = await request("GET", "actors", { my: true, limit: 1000, offset });
        if (!Array.isArray(page?.items) || !Number.isSafeInteger(page.total) || page.items.length === 0 && offset < page.total) throw new Error("actor_list_readback_invalid");
        all.push(...page.items); total = page.total; offset += page.items.length;
      }
      return all;
    },
    async createActor(body) { return request("POST", "actors", undefined, body); },
    async getActor(id) { return request("GET", `actors/${id}`); },
    async getVersion(id, version) { return request("GET", `actors/${id}/versions/${version}`); },
    async createBuild(id, params) { return request("POST", `actors/${id}/builds`, params, {}); },
    async getBuild(id) { return request("GET", `actor-builds/${id}`); },
    async listActorRuns(id) {
      const all = []; let offset = 0; let total = Infinity;
      while (offset < total) {
        const page = await request("GET", `actors/${id}/runs`, { limit: 1000, offset });
        if (!Array.isArray(page?.items) || !Number.isSafeInteger(page.total) || page.items.length === 0 && offset < page.total) throw new Error("actor_runs_readback_invalid");
        all.push(...page.items); total = page.total; offset += page.items.length;
      }
      return all;
    },
    async startRun(id, params, runInput) { return request("POST", `actors/${id}/runs`, params, runInput); },
    async getRun(id) { return request("GET", `actor-runs/${id}`); },
  };
}

export function parseArgs(args) {
  const parsed = { execute: false, prepare: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!["--execute", "--prepare", "--reviewed-commit", "--reviewed-source-sha256", "--actor-id", "--build-id", "--build-number"].includes(flag) || seen.has(flag)) {
      throw new Error("launcher_argument_invalid");
    }
    seen.add(flag);
    if (flag === "--execute") parsed.execute = true;
    else if (flag === "--prepare") parsed.prepare = true;
    else {
      const value = args[++i];
      if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) throw new Error("launcher_argument_value_invalid");
      const property = {
        "--reviewed-commit": "reviewedCommit",
        "--reviewed-source-sha256": "reviewedSourceSha256",
        "--actor-id": "actorId",
        "--build-id": "buildId",
        "--build-number": "buildNumber",
      }[flag];
      parsed[property] = value;
    }
  }
  return parsed;
}

export async function runLauncher(args, { bundle, makeApi = makeCliApi, write = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`) } = {}) {
  if (!bundle) bundle = await loadBundle();
  if (args.prepare) {
    if (args.actorId !== undefined || args.buildId !== undefined || args.buildNumber !== undefined) throw new Error("prepare_and_run_modes_are_separate");
    if (!args.execute) {
      write(preparePlan(bundle));
      return;
    }
    const approval = validateApproval({ ...args, headCommit: bundle.headCommit, sourceSha256: bundle.sourceSha256, treeClean: bundle.treeClean });
    if (!approval.approved) throw new Error("prepare_not_approved");
    write(await prepareWithApi({ api: makeApi(), bundle }));
    return;
  }
  if (args.execute) {
    validateTarget(args);
    const approval = validateApproval({ ...args, headCommit: bundle.headCommit, sourceSha256: bundle.sourceSha256, treeClean: bundle.treeClean });
    if (!approval.approved) throw new Error("execution_not_approved");
    write(await launchWithApi({ api: makeApi(), bundle, ...args }));
    return;
  }
  if (args.actorId !== undefined || args.buildId !== undefined || args.buildNumber !== undefined || args.reviewedCommit !== undefined || args.reviewedSourceSha256 !== undefined) {
    throw new Error("launcher_mode_invalid");
  }
  write({ outcome: "dry_run_only", remoteMutation: false, sourceSha256: bundle.sourceSha256,
    sourceFileCount: bundle.files.length, sourceFiles: bundle.files.map(({ name, content }) => ({ name, sha256: hash(content) })),
    reviewedHeadCommit: bundle.headCommit, packageClean: bundle.treeClean, packageLockSha256: hash(bundle.files.find((f) => f.name === "package-lock.json").content),
    baseImageDigest: bundle.baseDigest, buildTag: bundle.tag, actorName, actorVersion, input,
    runQuery: { ...makeRunQuery("1.0.1"), build: "<exact-build-number>" } });
}

async function main() {
  await runLauncher(parseArgs(process.argv.slice(2)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message?.startsWith("authenticated_cli_") ? error.message : error.message || "launcher_failed"}\n`); process.exitCode = 1; });
}
