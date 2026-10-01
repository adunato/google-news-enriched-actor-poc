import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const apiOrigin = "https://api.apify.com/v2";
const actorName = "issue-22-h15b-private-origin-fixture";
const actorTitle = "Issue 22 H15-B Private Origin Fixture Diagnostic";
const actorVersion = "1.0";
const buildTag = "h15b-fixture-v1";
const input = Object.freeze({ mode: "fixture-only", fixtureId: "readability-positive-v1" });
const desired = Object.freeze({
  isPublic: false,
  memoryMbytes: 256,
  timeoutSecs: 180,
  maxTotalChargeUsd: 0.1,
  restartOnError: false,
  forcePermissionLevel: "LIMITED_PERMISSIONS",
  sdkApiMaxRetries: 0,
});
const TERMINAL_BUILD = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  return JSON.stringify(value);
}

function compareName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function sourceDigest(fileRecords) {
  const material = fileRecords.map(({ name, content }) => ({ name, content })).sort(compareName);
  return sha256(canonical(material));
}

function normalizedSourceFiles(fileRecords) {
  return fileRecords.map(({ name, content }) => ({ format: "TEXT", content, name })).sort(compareName);
}

export function decodeRemoteSourceFiles(sourceFiles) {
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) throw new Error("remote_source_missing");
  return sourceFiles.map((file) => {
    if (file.folder === true || typeof file.name !== "string") throw new Error("remote_source_shape_mismatch");
    let content;
    if (file.format === "TEXT" && typeof file.content === "string") content = file.content;
    else if (file.format === "BASE64" && typeof file.content === "string") content = Buffer.from(file.content, "base64").toString("utf8");
    else throw new Error("remote_source_format_mismatch");
    return { name: file.name.replaceAll("\\", "/"), content };
  }).sort(compareName);
}

export function assertSameSource(expectedFiles, remoteFiles) {
  const actual = decodeRemoteSourceFiles(remoteFiles);
  const expected = expectedFiles.map(({ name, content }) => ({ name, content })).sort(compareName);
  if (canonical(actual) !== canonical(expected)) throw new Error("remote_source_mismatch");
  return sourceDigest(actual);
}

export function validateReviewedApproval({ execute, reviewedCommit, reviewedSourceSha256, headCommit, sourceSha256, treeClean }) {
  if (!execute) return { approved: false, mode: "dry-run" };
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(reviewedCommit ?? "") || reviewedCommit !== headCommit) {
    throw new Error("reviewed_commit_mismatch");
  }
  if (!/^[0-9a-f]{64}$/u.test(reviewedSourceSha256 ?? "") || reviewedSourceSha256 !== sourceSha256) {
    throw new Error("reviewed_source_digest_mismatch");
  }
  if (!treeClean) throw new Error("hosted_package_worktree_dirty");
  return { approved: true, mode: "execute" };
}

function validateLocalBundle(files) {
  const byName = new Map(files.map((file) => [file.name, file.content]));
  if (byName.size !== files.length) throw new Error("deploy_file_list_duplicate");
  const actorConfig = JSON.parse(byName.get(".actor/actor.json") ?? "null");
  const runOptions = JSON.parse(byName.get("run-options.json") ?? "null");
  const packageJson = JSON.parse(byName.get("package.json") ?? "null");
  const lock = JSON.parse(byName.get("package-lock.json") ?? "null");
  const inputSchema = JSON.parse(byName.get("INPUT_SCHEMA.json") ?? "null");
  const dockerfile = byName.get("Dockerfile") ?? "";
  const main = byName.get("src/main.mjs") ?? "";
  const sourceManifest = JSON.parse(byName.get("src/tuple-manifest.json") ?? "null");
  const runtimeOriginSource = byName.get("src/runtime-origin.mjs") ?? "";
  const baseDigest = dockerfile.match(/^FROM\s+(apify\/actor-node@sha256:[0-9a-f]{64})\s*$/mu)?.[1];
  const retryIndex = main.indexOf("Actor.apifyClient.httpClient.maxRetries = 0");
  const initIndex = main.indexOf("Actor.init()");
  const exactConfig = actorConfig?.name === actorName && actorConfig?.version === "1.0.0" && actorConfig?.actorSpecification === 1 &&
    actorConfig?.dockerfile === "Dockerfile" && actorConfig?.defaultRunOptions?.memoryMbytes === desired.memoryMbytes &&
    actorConfig?.defaultRunOptions?.timeoutSecs === desired.timeoutSecs && actorConfig?.defaultRunOptions?.restartOnError === false &&
    actorConfig?.defaultRunOptions?.forcePermissionLevel === desired.forcePermissionLevel;
  const exactRunOptions = runOptions?.privacy === "private Actor, LIMITED_PERMISSIONS" && runOptions?.memoryMbytes === desired.memoryMbytes &&
    runOptions?.timeoutSecs === desired.timeoutSecs && runOptions?.maxTotalChargeUsd === desired.maxTotalChargeUsd &&
    runOptions?.restartOnError === false && runOptions?.sdkApiMaxRetries === desired.sdkApiMaxRetries &&
    canonical(runOptions?.input) === canonical(input);
  const exactRuntimePins = packageJson?.dependencies?.apify === "3.7.2" && packageJson?.dependencies?.["@mozilla/readability"] === "0.6.0" &&
    packageJson?.dependencies?.linkedom === "0.18.13" && lock?.packages?.["node_modules/apify-client"]?.version === "2.25.0" &&
    lock?.packages?.["node_modules/@crawlee/core"]?.version === "3.18.2";
  const exactInput = inputSchema?.additionalProperties === false && inputSchema?.required?.join("|") === "mode|fixtureId" &&
    inputSchema?.properties?.mode?.enum?.[0] === input.mode && inputSchema?.properties?.fixtureId?.enum?.[0] === input.fixtureId;
  const failed = [
    ["base", Boolean(baseDigest)], ["actor_config", exactConfig], ["run_options", exactRunOptions],
    ["runtime_pins", exactRuntimePins], ["input", exactInput],
    ["tuple_manifest", sourceManifest?.schemaVersion === "issue22-h15b-sdk-tuples-v1" && sourceManifest?.state === "source-checked" && sourceManifest?.origin === "runtime-validated-private-ipv4" && sourceManifest?.tuples?.length === 7],
    ["runtime_origin_gate", runtimeOriginSource.includes("assertNoProxyOverride") && runtimeOriginSource.includes("resolveRuntimeOrigin")],
    ["retry_gate", retryIndex >= 0 && initIndex >= 0 && retryIndex < initIndex],
  ].filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`local_launch_contract_failed_${failed.join("_")}`);
  return { baseDigest, actorConfig, runOptions, inputSchema, packageJson, lock };
}

export async function loadSourceBundle({ rootDir = root, git = true } = {}) {
  const names = JSON.parse(await readFile(path.join(here, "deploy-file-list.json"), "utf8"));
  if (!Array.isArray(names) || names.length === 0 || names.some((name) => typeof name !== "string" || name.startsWith("/") || name.includes(".."))) {
    throw new Error("deploy_file_list_invalid");
  }
  const files = [];
  for (const name of names) {
    const absolute = path.join(rootDir, ...name.split("/"));
    const info = await lstat(absolute);
    const resolved = await realpath(absolute);
    const relativeResolved = path.relative(rootDir, resolved);
    if (info.isSymbolicLink() || !info.isFile() || relativeResolved.startsWith("..") || path.isAbsolute(relativeResolved)) {
      throw new Error("deploy_file_not_regular");
    }
    files.push({ name, content: await readFile(absolute, "utf8") });
  }
  files.sort(compareName);
  const config = validateLocalBundle(files);
  let headCommit = "local-uncommitted";
  let treeClean = false;
  if (git) {
    headCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: rootDir, encoding: "utf8" }).trim();
    const relativePackage = path.relative(repoRoot, rootDir).replaceAll("\\", "/");
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", relativePackage], { cwd: repoRoot, encoding: "utf8" });
    treeClean = status.trim().length === 0;
  }
  const digest = sourceDigest(files);
  return {
    files,
    sourceSha256: digest,
    headCommit,
    treeClean,
    baseDigest: config.baseDigest,
    packageLockSha256: sha256(files.find((file) => file.name === "package-lock.json").content),
    fileManifest: files.map(({ name, content }) => ({ name, sha256: sha256(content) })),
  };
}

export function createActorPayload(bundle) {
  const version = {
    versionNumber: actorVersion,
    sourceType: "SOURCE_FILES",
    applyEnvVarsToBuild: false,
    buildTag,
    envVars: [],
    sourceFiles: normalizedSourceFiles(bundle.files),
  };
  return {
    name: actorName,
    title: actorTitle,
    description: "Private Issue 22 fixture-only startup diagnostic.",
    isPublic: false,
    versions: [version],
    defaultRunOptions: {
      memoryMbytes: desired.memoryMbytes,
      timeoutSecs: desired.timeoutSecs,
      restartOnError: false,
      forcePermissionLevel: desired.forcePermissionLevel,
    },
  };
}

export function createRunQuery(buildNumber) {
  if (!/^\d+\.\d+\.\d+$/u.test(buildNumber ?? "")) throw new Error("build_number_invalid");
  return {
    build: buildNumber,
    memory: desired.memoryMbytes,
    timeout: desired.timeoutSecs,
    maxTotalChargeUsd: desired.maxTotalChargeUsd,
    restartOnError: false,
    forcePermissionLevel: desired.forcePermissionLevel,
    waitForFinish: 0,
  };
}

function verifyActor(actor, expectedId) {
  const options = actor?.defaultRunOptions ?? {};
  if (actor?.id !== expectedId || actor?.name !== actorName || actor?.isPublic !== false ||
      options.memoryMbytes !== desired.memoryMbytes || options.timeoutSecs !== desired.timeoutSecs ||
      options.restartOnError !== false || options.forcePermissionLevel !== desired.forcePermissionLevel) {
    throw new Error("actor_settings_readback_mismatch");
  }
}

function verifyBuildTagReadback(actor, tag, buildId) {
  const taggedBuild = actor?.taggedBuilds?.[tag];
  if (!taggedBuild || typeof taggedBuild !== "object" || Array.isArray(taggedBuild) ||
      typeof taggedBuild.buildId !== "string" || taggedBuild.buildId.length === 0 || taggedBuild.buildId !== buildId) {
    throw new Error("build_tag_readback_mismatch");
  }
}

function verifyRunReadback(run, actorId, build) {
  const options = run?.options ?? {};
  if (run?.actId !== actorId || run?.buildId !== build.id || run?.buildNumber !== build.buildNumber ||
      options.build !== build.buildNumber || options.memoryMbytes !== desired.memoryMbytes ||
      options.timeoutSecs !== desired.timeoutSecs || options.maxTotalChargeUsd !== desired.maxTotalChargeUsd) {
    throw new Error("run_options_readback_mismatch");
  }
  if (Object.hasOwn(options, "restartOnError") && options.restartOnError !== false) throw new Error("run_restart_readback_mismatch");
  return {
    runStatus: typeof run.status === "string" ? run.status : "unknown",
    buildNumber: run.buildNumber,
    memoryMbytes: options.memoryMbytes,
    timeoutSecs: options.timeoutSecs,
    maxTotalChargeUsd: options.maxTotalChargeUsd,
    restartOnErrorReadback: Object.hasOwn(options, "restartOnError") ? options.restartOnError : "not_exposed_by_run_api",
    permissionReadback: "actor_default_readback_plus_exact_run_query",
  };
}

function actorListHasCollision(items) {
  return items.some((item) => typeof item.name === "string" && item.name.startsWith("issue-22-h15b-private-origin"));
}

function assertBuild(build, actorId, bundle) {
  if (build?.actId !== actorId || build.status !== "SUCCEEDED" || build.actVersion?.sourceType !== "SOURCE_FILES" ||
      build.actVersion?.versionNumber !== actorVersion) throw new Error("build_identity_or_status_mismatch");
  assertSameSource(bundle.files, build.actVersion.sourceFiles);
}

function verifyVersion(version, bundle, expectedTag, errorCode) {
  if (version?.versionNumber !== actorVersion || version?.sourceType !== "SOURCE_FILES" || version?.buildTag !== expectedTag ||
      version?.applyEnvVarsToBuild !== false || !(version?.envVars == null || Array.isArray(version.envVars) && version.envVars.length === 0)) {
    throw new Error(errorCode);
  }
  assertSameSource(bundle.files, version.sourceFiles);
}

function buildTagNameFor(bundle) {
  return `${buildTag}-${bundle.sourceSha256.slice(0, 12)}`;
}

function validateResumeIds({ actorId, buildId, buildNumber }) {
  if (typeof actorId !== "string" || !/^[A-Za-z0-9_-]+$/u.test(actorId) ||
      typeof buildId !== "string" || !/^[A-Za-z0-9_-]+$/u.test(buildId) ||
      typeof buildNumber !== "string" || !/^\d+\.\d+\.\d+$/u.test(buildNumber)) {
    throw new Error("resume_identity_invalid");
  }
}

function assertNoPriorBuildRuns(runs, build) {
  if (!Array.isArray(runs)) throw new Error("actor_runs_readback_invalid");
  if (runs.some((run) => run?.buildId === build.id || run?.buildNumber === build.buildNumber)) {
    throw new Error("resume_run_already_exists");
  }
}

export async function verifyResumeCandidateWithApi({ api, bundle, actorId, buildId, buildNumber }) {
  validateResumeIds({ actorId, buildId, buildNumber });
  const list = await api.listOwnedActors();
  if (!Array.isArray(list)) throw new Error("actor_list_readback_invalid");
  const matches = list.filter((item) => item?.name === actorName);
  if (matches.length !== 1 || matches[0]?.id !== actorId || actorListHasCollision(list.filter((item) => item?.id !== actorId))) {
    throw new Error("resume_actor_identity_or_collision_mismatch");
  }

  let actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  verifyBuildTagReadback(actor, buildTagNameFor(bundle), buildId);
  let version = await api.getVersion(actorId, actorVersion);
  verifyVersion(version, bundle, buildTag, "resume_version_readback_mismatch");
  let build = await api.getBuild(buildId);
  assertBuild(build, actorId, bundle);
  if (build.buildNumber !== buildNumber) throw new Error("resume_build_number_mismatch");
  verifyBuildTagReadback(actor, buildTagNameFor(bundle), build.id);

  assertNoPriorBuildRuns(await api.listActorRuns(actorId), build);

  // Repeat all mutable readbacks immediately before the only permitted POST.
  actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  verifyBuildTagReadback(actor, buildTagNameFor(bundle), buildId);
  version = await api.getVersion(actorId, actorVersion);
  verifyVersion(version, bundle, buildTag, "pre_run_version_readback_mismatch");
  build = await api.getBuild(buildId);
  assertBuild(build, actorId, bundle);
  if (build.buildNumber !== buildNumber) throw new Error("resume_build_number_mismatch");
  verifyBuildTagReadback(actor, buildTagNameFor(bundle), build.id);
  assertNoPriorBuildRuns(await api.listActorRuns(actorId), build);

  return {
    actorId,
    buildId: build.id,
    buildNumber: build.buildNumber,
    sourceSha256: bundle.sourceSha256,
    actorPrivate: true,
    actorDefaultRunOptionsVerified: true,
    sourceVersionReadbackVerified: true,
    builtSourceReadbackVerified: true,
    buildTagObjectVerified: true,
    noPriorRunForBuildVerified: true,
  };
}

export async function resumeWithApi({ api, bundle, actorId, buildId, buildNumber }) {
  await verifyResumeCandidateWithApi({ api, bundle, actorId, buildId, buildNumber });

  const build = { id: buildId, buildNumber };
  const runQuery = createRunQuery(build.buildNumber);
  const started = await api.startRun(actorId, runQuery, input);
  if (typeof started?.id !== "string" || !/^[A-Za-z0-9_-]+$/u.test(started.id)) throw new Error("run_start_response_invalid");
  const run = await api.getRun(started.id);
  const readback = verifyRunReadback(run, actorId, build);
  return {
    outcome: "resumed_existing_build_run_started_and_verified",
    actorIdSha256: sha256(actorId),
    buildIdSha256: sha256(build.id),
    runIdSha256: sha256(run.id),
    sourceSha256: bundle.sourceSha256,
    buildNumber: build.buildNumber,
    actorPrivate: true,
    actorDefaultRunOptionsVerified: true,
    sourceVersionReadbackVerified: true,
    builtSourceReadbackVerified: true,
    preRunActorVersionBuildReadbackVerified: true,
    noPriorRunForBuildVerified: true,
    run: readback,
  };
}

export async function launchWithApi({ api, bundle, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), buildWaitMs = 15 * 60_000 }) {
  const list = await api.listOwnedActors();
  if (!Array.isArray(list) || actorListHasCollision(list)) throw new Error("actor_name_collision_or_list_invalid");

  const createPayload = createActorPayload(bundle);
  const created = await api.createActor(createPayload);
  const actorId = created?.id;
  if (typeof actorId !== "string" || !/^[A-Za-z0-9_-]+$/u.test(actorId)) throw new Error("actor_create_response_invalid");
  let actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  let version = await api.getVersion(actorId, actorVersion);
  if (version?.versionNumber !== actorVersion || version?.sourceType !== "SOURCE_FILES" || version?.buildTag !== buildTag ||
      version?.applyEnvVarsToBuild !== false || !(version?.envVars == null || Array.isArray(version.envVars) && version.envVars.length === 0)) {
    throw new Error("version_readback_shape_mismatch");
  }
  assertSameSource(bundle.files, version.sourceFiles);

  const buildTagName = buildTagNameFor(bundle);
  let build = await api.createBuild(actorId, { version: actorVersion, useCache: false, betaPackages: false, tag: buildTagName, waitForFinish: 60 });
  if (typeof build?.id !== "string" || !/^[A-Za-z0-9_-]+$/u.test(build.id)) throw new Error("build_create_response_invalid");
  const stopAt = Date.now() + buildWaitMs;
  while (!TERMINAL_BUILD.has(build.status)) {
    if (Date.now() >= stopAt) throw new Error("build_wait_timeout");
    await sleep(5000);
    build = await api.getBuild(build.id);
  }
  assertBuild(build, actorId, bundle);

  actor = await api.getActor(actorId);
  verifyActor(actor, actorId);
  verifyBuildTagReadback(actor, buildTagName, build.id);
  version = await api.getVersion(actorId, actorVersion);
  if (version?.versionNumber !== actorVersion || version?.sourceType !== "SOURCE_FILES" || version?.buildTag !== buildTag ||
      version?.applyEnvVarsToBuild !== false || !(version?.envVars == null || Array.isArray(version.envVars) && version.envVars.length === 0)) {
    throw new Error("pre_run_version_readback_mismatch");
  }
  assertSameSource(bundle.files, version.sourceFiles);
  build = await api.getBuild(build.id);
  assertBuild(build, actorId, bundle);
  verifyBuildTagReadback(actor, buildTagName, build.id);
  assertNoPriorBuildRuns(await api.listActorRuns(actorId), build);

  const runQuery = createRunQuery(build.buildNumber);
  if (runQuery.memory !== desired.memoryMbytes || runQuery.timeout !== desired.timeoutSecs || runQuery.maxTotalChargeUsd !== desired.maxTotalChargeUsd ||
      runQuery.restartOnError !== false || runQuery.forcePermissionLevel !== desired.forcePermissionLevel || runQuery.build !== build.buildNumber) {
    throw new Error("run_request_contract_failed");
  }
  assertNoPriorBuildRuns(await api.listActorRuns(actorId), build);
  const started = await api.startRun(actorId, runQuery, input);
  if (typeof started?.id !== "string" || !/^[A-Za-z0-9_-]+$/u.test(started.id)) throw new Error("run_start_response_invalid");
  const run = await api.getRun(started.id);
  const readback = verifyRunReadback(run, actorId, build);
  return {
    outcome: "run_started_and_verified",
    actorIdSha256: sha256(actorId),
    buildIdSha256: sha256(build.id),
    runIdSha256: sha256(run.id),
    sourceSha256: bundle.sourceSha256,
    buildNumber: build.buildNumber,
    actorPrivate: true,
    actorDefaultRunOptionsVerified: true,
    sourceVersionReadbackVerified: true,
    builtSourceReadbackVerified: true,
    preRunActorVersionBuildReadbackVerified: true,
    run: readback,
  };
}

function parseCliResponse(text) {
  const candidate = text.trim();
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object" || !Object.hasOwn(parsed, "data")) throw new Error("api_response_shape_invalid");
    return parsed.data;
  } catch {
    throw new Error("authenticated_apify_cli_response_invalid");
  }
}

export function makeCliApi() {
  const request = (method, endpoint, params, body) => new Promise((resolve, reject) => {
    const query = params && Object.keys(params).length
      ? `?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()}`
      : "";
    const endpointWithQuery = `${endpoint}${query}`;
    if (!/^[A-Za-z0-9/?=&._~-]+$/u.test(endpointWithQuery)) return reject(new Error("authenticated_apify_cli_endpoint_invalid"));
    const quote = process.platform === "win32" ? `"${endpointWithQuery}"` : `'${endpointWithQuery}'`;
    const command = `apify api ${method} ${quote}${body === undefined ? "" : " --body -"}`;
    const child = spawn(command, { shell: true, stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      if (!settled) { settled = true; reject(new Error("authenticated_apify_cli_timeout")); }
    }, 60_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 16 * 1024 * 1024) child.kill();
    });
    child.once("error", () => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(new Error("authenticated_apify_cli_unavailable")); }
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0) return reject(new Error(`authenticated_apify_cli_http_${code ?? "unknown"}`));
      try { resolve(parseCliResponse(stdout)); } catch (error) { reject(error); }
    });
    if (body === undefined) child.stdin.end();
    else child.stdin.end(JSON.stringify(body));
  });
  return {
    async listOwnedActors() {
      const all = [];
      let offset = 0;
      let total = Infinity;
      while (offset < total) {
        const page = await request("GET", "actors", { my: true, limit: 1000, offset });
        if (!Array.isArray(page?.items) || !Number.isSafeInteger(page.total) || page.items.length === 0 && offset < page.total) throw new Error("actor_list_readback_invalid");
        all.push(...page.items);
        total = page.total;
        offset += page.items.length;
      }
      return all;
    },
    async createActor(payload) { return request("POST", "actors", undefined, payload); },
    async getActor(actorId) { return request("GET", `actors/${actorId}`); },
    async getVersion(actorId, version) { return request("GET", `actors/${actorId}/versions/${version}`); },
    async createBuild(actorId, params) { return request("POST", `actors/${actorId}/builds`, params, {}); },
    async getBuild(buildId) { return request("GET", `actor-builds/${buildId}`); },
    async listActorRuns(actorId) {
      const all = [];
      let offset = 0;
      let total = Infinity;
      while (offset < total) {
        const page = await request("GET", `actors/${actorId}/runs`, { limit: 1000, offset });
        if (!Array.isArray(page?.items) || !Number.isSafeInteger(page.total) || page.items.length === 0 && offset < page.total) throw new Error("actor_runs_readback_invalid");
        all.push(...page.items);
        total = page.total;
        offset += page.items.length;
      }
      return all;
    },
    async startRun(actorId, params, runInput) { return request("POST", `actors/${actorId}/runs`, params, runInput); },
    async getRun(runId) { return request("GET", `actor-runs/${runId}`); },
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(args) {
  const parsed = { execute: false, resumeExisting: false, verifyResumeReadonly: false, resumeActorId: undefined, resumeBuildId: undefined, resumeBuildNumber: undefined, reviewedCommit: undefined, reviewedSourceSha256: undefined };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--execute") parsed.execute = true;
    else if (args[i] === "--resume-existing") parsed.resumeExisting = true;
    else if (args[i] === "--verify-resume-readonly") parsed.verifyResumeReadonly = true;
    else if (args[i] === "--resume-actor-id") parsed.resumeActorId = args[++i];
    else if (args[i] === "--resume-build-id") parsed.resumeBuildId = args[++i];
    else if (args[i] === "--resume-build-number") parsed.resumeBuildNumber = args[++i];
    else if (args[i] === "--reviewed-commit") parsed.reviewedCommit = args[++i];
    else if (args[i] === "--reviewed-source-sha256") parsed.reviewedSourceSha256 = args[++i];
    else throw new Error("launcher_argument_invalid");
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.resumeExisting || args.verifyResumeReadonly) validateResumeIds({ actorId: args.resumeActorId, buildId: args.resumeBuildId, buildNumber: args.resumeBuildNumber });
  else if (args.resumeActorId !== undefined || args.resumeBuildId !== undefined || args.resumeBuildNumber !== undefined) throw new Error("resume_arguments_require_resume_mode");
  if (args.verifyResumeReadonly && (args.execute || args.resumeExisting)) throw new Error("readonly_resume_mode_cannot_execute");
  const bundle = await loadSourceBundle();
  const approval = validateReviewedApproval({
    ...args,
    headCommit: bundle.headCommit,
    sourceSha256: bundle.sourceSha256,
    treeClean: bundle.treeClean,
  });
  if (args.verifyResumeReadonly) {
    const verified = await verifyResumeCandidateWithApi({ api: makeCliApi(), bundle, actorId: args.resumeActorId, buildId: args.resumeBuildId, buildNumber: args.resumeBuildNumber });
    printJson({
      outcome: "resume_candidate_readback_verified_no_mutation",
      remoteMutation: false,
      actorIdSha256: sha256(verified.actorId),
      buildIdSha256: sha256(verified.buildId),
      buildNumber: verified.buildNumber,
      sourceSha256: verified.sourceSha256,
      actorPrivate: verified.actorPrivate,
      actorDefaultRunOptionsVerified: verified.actorDefaultRunOptionsVerified,
      sourceVersionReadbackVerified: verified.sourceVersionReadbackVerified,
      builtSourceReadbackVerified: verified.builtSourceReadbackVerified,
      buildTagObjectVerified: verified.buildTagObjectVerified,
      noPriorRunForBuildVerified: verified.noPriorRunForBuildVerified,
    });
    return;
  }
  if (!approval.approved) {
    printJson({
      outcome: "dry_run_only",
      remoteMutation: false,
      mode: args.resumeExisting ? "resume-existing" : "create-build-run",
      ...(args.resumeExisting ? { resumeTarget: { actorId: args.resumeActorId, buildId: args.resumeBuildId, buildNumber: args.resumeBuildNumber } } : {}),
      actorName,
      ...(args.resumeExisting ? {} : { actorCreateBodySha256: sha256(canonical(createActorPayload(bundle))) }),
      ...(!args.resumeExisting ? { actorCreateRequest: {
        method: "POST",
        endpoint: "/v2/actors",
        isPublic: false,
        versionNumber: actorVersion,
        sourceType: "SOURCE_FILES",
        versionBuildTag: buildTag,
        defaultRunOptions: {
          memoryMbytes: desired.memoryMbytes,
          timeoutSecs: desired.timeoutSecs,
          restartOnError: false,
          forcePermissionLevel: desired.forcePermissionLevel,
        },
      } } : {}),
      sourceSha256: bundle.sourceSha256,
      sourceFiles: bundle.fileManifest,
      sourceFileCount: bundle.files.length,
      packageLockSha256: bundle.packageLockSha256,
      baseImageDigest: bundle.baseDigest,
      localHeadCommit: bundle.headCommit,
      localPackageClean: bundle.treeClean,
      ...(!args.resumeExisting ? { buildRequest: { method: "POST", endpoint: "/v2/actors/:actorId/builds", query: { version: actorVersion, useCache: false, betaPackages: false, tag: buildTagNameFor(bundle), waitForFinish: 60 } } } : {}),
      runRequest: { method: "POST", endpoint: "/v2/actors/:actorId/runs", query: { ...createRunQuery("0.0.0"), build: "<exact-build-number>" }, input },
    });
    return;
  }
  const result = args.resumeExisting
    ? await resumeWithApi({ api: makeCliApi(), bundle, actorId: args.resumeActorId, buildId: args.resumeBuildId, buildNumber: args.resumeBuildNumber })
    : await launchWithApi({ api: makeCliApi(), bundle });
  printJson(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message?.startsWith("authenticated_apify_cli_") ? error.message : error.message || "launcher_failed"}\n`);
    process.exitCode = 1;
  });
}
