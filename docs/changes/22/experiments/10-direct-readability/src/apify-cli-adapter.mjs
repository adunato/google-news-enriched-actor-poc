import { spawn } from "node:child_process";
import { execFile as execFileCallback } from "node:child_process";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30000;
const BUILD_TIMEOUT_MS = 12 * 60 * 1000;
const POLL_MS = 3000;
const PROCESS_CODES = new Set(["ENOENT", "EACCES", "EPERM", "ENOEXEC", "EINVAL", "EISDIR", "EFTYPE"]);

async function defaultCommandPath() {
  if (process.env.APIFY_CLI_PATH) return { command: process.env.APIFY_CLI_PATH, prefixArgs: [] };
  if (process.platform === "win32") {
    try {
      const shim = await execFile("where.exe", ["apify.ps1"], { windowsHide: true, maxBuffer: 4096 });
      const shimPath = shim.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (shimPath) return { command: join(dirname(shimPath), "apify-cli.exe"), prefixArgs: [] };
    } catch { /* stable unavailable error below */ }
    throw new Error("apify_cli_unavailable");
  }
  return { command: "apify", prefixArgs: [] };
}

function processError(code) {
  const safeCode = PROCESS_CODES.has(code) ? code : "UNKNOWN";
  const error = new Error(`apify_process_${safeCode}`);
  error.diagnostic = { kind: "local_process_error", code: safeCode };
  return error;
}

function cliExitError(exitCode, stderr) {
  const safeExitCode = Number.isInteger(exitCode) ? exitCode : null;
  const statusMatch = /(?:HTTP(?:\/\d(?:\.\d)?)?\s+|status(?:Code)?["']?\s*[:=]\s*["']?)([1-5]\d\d)\b/i.exec(stderr);
  const diagnostic = statusMatch
    ? { kind: "http_error", status: Number(statusMatch[1]) }
    : { kind: "cli_exit", exitCode: safeExitCode };
  const error = new Error(diagnostic.kind === "http_error" ? "apify_http_request_failed" : "apify_cli_exit_nonzero");
  error.diagnostic = diagnostic;
  return error;
}

export function runApifyCli(command, args, input, { spawnProcess = spawn, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawnProcess(command, args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }); }
    catch (error) { reject(processError(error?.code)); return; }
    const chunks = [];
    let stdoutBytes = 0, stderrBytes = 0, stderr = "", settled = false, timer;
    const finish = (error, output) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(output);
    };
    timer = setTimeout(() => { child.kill(); finish(new Error("apify_cli_timeout")); }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) { child.kill(); finish(new Error("apify_cli_output_limit")); return; }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      // Bounded transient parsing only; stderr is never returned or logged.
      if (stderrBytes < 65536) {
        const bounded = chunk.subarray(0, 65536 - stderrBytes);
        stderr += bounded.toString("utf8");
        stderrBytes += bounded.length;
      }
    });
    child.stdin.once("error", (error) => finish(processError(error?.code)));
    child.once("error", (error) => finish(processError(error?.code)));
    child.once("close", (code) => {
      if (settled) return;
      if (code !== 0) { finish(cliExitError(code, stderr)); return; }
      finish(null, Buffer.concat(chunks, stdoutBytes).toString("utf8"));
    });
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input, "utf8");
  });
}

function parseResponse(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("apify_api_response_invalid"); }
  return parsed && typeof parsed === "object" && Object.hasOwn(parsed, "data") ? parsed.data : parsed;
}

function pick(value, keys) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
}

const actorView = (value) => pick(value, ["id", "name", "isPublic", "actorPermissionLevel"]);
const versionView = (value) => ({
  ...pick(value, ["versionNumber", "sourceType"]),
  ...(Array.isArray(value?.sourceFiles) ? { sourceFiles: value.sourceFiles.map((file) => pick(file, ["name", "format", "content"])) } : {}),
});
const buildView = (value) => ({
  ...pick(value, ["id", "buildNumber", "status"]),
  ...(value?.actVersion ? { actVersion: versionView(value.actVersion) } : {}),
});
const runView = (value) => ({
  ...pick(value, ["id", "buildId", "buildNumber", "startedAt", "status"]),
  ...(value?.options ? { options: pick(value.options, ["build", "memoryMbytes", "timeoutSecs", "maxTotalChargeUsd", "restartOnError", "forcePermissionLevel"]) } : {}),
});

/**
 * Credential-safe adapter for the installed Apify CLI. The CLI owns
 * authentication; this module never reads a token, invokes a shell, or emits
 * stdout/stderr from the child process. API bodies travel through stdin.
 */
export async function createApifyCliAdapter({ commandPath, spawnProcess = spawn, execute = runApifyCli, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), clock = Date.now } = {}) {
  const invocation = commandPath ? { command: commandPath, prefixArgs: [] } : await defaultCommandPath();
  const request = async (method, endpoint, { body, params, timeoutMs } = {}) => {
    const args = [...invocation.prefixArgs, "api", method, endpoint];
    if (params && Object.keys(params).length) args.push("-p", JSON.stringify(params));
    if (body !== undefined) args.push("-d", "-");
    const raw = await execute(invocation.command, args, body === undefined ? undefined : JSON.stringify(body), { spawnProcess, timeoutMs });
    return parseResponse(raw);
  };

  return {
    async verifyAuthentication() {
      await request("GET", "users/me");
      return { authenticated: true };
    },
    async createPrivateActor(settings) {
      return actorView(await request("POST", "acts", { body: settings }));
    },
    async setVersionSource(actorId, version) {
      await request("PUT", `acts/${encodeURIComponent(actorId)}/versions/${encodeURIComponent(version.versionNumber)}`, { body: version });
    },
    async getVersion(actorId, versionNumber) {
      return versionView(await request("GET", `acts/${encodeURIComponent(actorId)}/versions/${encodeURIComponent(versionNumber)}`));
    },
    async buildVersion(actorId, versionNumber) {
      const result = await request("POST", `acts/${encodeURIComponent(actorId)}/builds`, { params: { version: versionNumber } });
      return pick(result, ["id"]);
    },
    async waitForBuild(_actorId, buildId) {
      const deadline = clock() + BUILD_TIMEOUT_MS;
      while (clock() < deadline) {
        const build = buildView(await request("GET", `actor-builds/${encodeURIComponent(buildId)}`, { timeoutMs: REQUEST_TIMEOUT_MS }));
        if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(build.status)) return build;
        await sleep(POLL_MS);
      }
      throw new Error("apify_build_wait_timeout");
    },
    async getActor(actorId) {
      return actorView(await request("GET", `acts/${encodeURIComponent(actorId)}`));
    },
    async listOwnActors() {
      const response = await request("GET", "acts", { params: { my: true, limit: 100 } });
      const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
      return items.map(actorView);
    },
    async startRun(actorId, options) {
      return runView(await request("POST", `acts/${encodeURIComponent(actorId)}/runs`, { params: options, timeoutMs: BUILD_TIMEOUT_MS }));
    },
    async findRunsSince(actorId, since) {
      const response = await request("GET", `acts/${encodeURIComponent(actorId)}/runs`, { params: { limit: 100, desc: true } });
      const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
      return items.map(runView).filter((run) => Number.isFinite(Date.parse(run.startedAt ?? "")) && Date.parse(run.startedAt) >= since);
    },
    async getRun(runId) {
      return runView(await request("GET", `actor-runs/${encodeURIComponent(runId)}`));
    },
  };
}
