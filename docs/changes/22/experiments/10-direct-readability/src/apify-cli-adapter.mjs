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

export async function defaultCommandPath() {
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

function parseErrorJson(text) {
  const objectStart = text.indexOf("{");
  if (objectStart < 0) return null;
  try {
    const value = JSON.parse(text.slice(objectStart));
    return value && typeof value === "object" ? value : null;
  } catch { return null; }
}

const CREATE_FIELD_PATH = /^(?:name|title|description|isPublic|actorPermissionLevel|defaultRunOptions(?:\.(?:build|memoryMbytes|timeoutSecs|maxTotalChargeUsd|restartOnError|forcePermissionLevel))?|versions(?:\.\d+)?(?:\.(?:versionNumber|sourceType|sourceFiles(?:\.\d+)?(?:\.(?:name|format|content))?))?)$/;
const FREE_TEXT_FIELD_TOKEN = /(?:^|[^A-Za-z0-9_])(defaultRunOptions|actorPermissionLevel|sourceFiles|sourceType|versionNumber|isPublic|name|title|description)(?:\.(?:\d+|build|memoryMbytes|timeoutSecs|maxTotalChargeUsd|restartOnError|forcePermissionLevel|versionNumber|sourceType|sourceFiles|name|format|content))*/g;

function safeFieldPath(value) {
  const path = Array.isArray(value) ? value.map((part) => String(part)).join(".") : typeof value === "string" ? value : "";
  return CREATE_FIELD_PATH.test(path) ? path : undefined;
}

function reasonCategory(value) {
  if (typeof value !== "string") return "validation";
  const code = value.toLowerCase();
  if (/required|missing/.test(code)) return "required";
  if (/unknown|unexpected|additional|extra/.test(code)) return "unknown_field";
  if (/type|expected|must be (?:a |an )?(?:number|string|boolean|array|object)/.test(code)) return "invalid_type";
  if (/enum|choice/.test(code)) return "invalid_choice";
  if (/format|pattern|length|range|min|max|constraint/.test(code)) return "constraint";
  return "validation";
}

function safeValidationIssues(...outputs) {
  const envelope = outputs.map(parseErrorJson).find(Boolean);
  const error = envelope?.error && typeof envelope.error === "object" ? envelope.error : envelope;
  const candidates = [];
  const collect = (value) => {
    if (Array.isArray(value)) for (const item of value) collect(item);
    else if (value && typeof value === "object") candidates.push(value);
  };
  collect(error?.details);
  collect(error?.issues);
  collect(error?.validationErrors);
  const safe = [];
  const add = (fieldPath, category) => {
    if (fieldPath && !safe.some((item) => item.fieldPath === fieldPath && item.reasonCategory === category)) {
      safe.push({ fieldPath, reasonCategory: category });
    }
  };
  for (const issue of candidates) {
    const fieldPath = safeFieldPath(issue.path ?? issue.fieldPath ?? issue.field ?? issue.propertyName ?? issue.property);
    const category = reasonCategory(issue.code ?? issue.type ?? issue.constraint);
    add(fieldPath, category);
    if (!fieldPath && typeof issue.message === "string") {
      FREE_TEXT_FIELD_TOKEN.lastIndex = 0;
      let match;
      while ((match = FREE_TEXT_FIELD_TOKEN.exec(issue.message)) !== null) add(safeFieldPath(match[1] + match[0].slice(match[0].indexOf(match[1]) + match[1].length)), reasonCategory(issue.code ?? issue.type ?? issue.message));
    }
  }
  // Some CLI/provider versions expose only a validation message. Return only
  // recognized create-schema paths and a coarse category; never the message.
  if (safe.length === 0) {
    for (const output of outputs) {
      const parsed = parseErrorJson(output);
      const message = parsed?.error?.message ?? parsed?.message;
      if (typeof message !== "string") continue;
      FREE_TEXT_FIELD_TOKEN.lastIndex = 0;
      let match;
      while ((match = FREE_TEXT_FIELD_TOKEN.exec(message)) !== null) {
        const start = match[0].indexOf(match[1]);
        add(safeFieldPath(match[1] + match[0].slice(start + match[1].length)), reasonCategory(message));
      }
    }
  }
  return safe.slice(0, 8);
}

function safeErrorFields(...outputs) {
  const value = outputs.map(parseErrorJson).find(Boolean);
  if (!value) return {};
  const rawType = value?.type ?? value?.error?.type;
  const safeType = typeof rawType === "string" && /^[a-z0-9-]{1,80}$/i.test(rawType) ? rawType : undefined;
  const rawCode = value?.code ?? value?.error?.code;
  const code = typeof rawCode === "string" && /^[a-z0-9._-]{1,80}$/i.test(rawCode) ? rawCode : undefined;
  const rawRequestId = value?.requestId ?? value?.request_id;
  const requestId = typeof rawRequestId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(rawRequestId) ? rawRequestId : undefined;
  const rawTimestamp = value?.timestamp ?? value?.error?.timestamp;
  const timestamp = typeof rawTimestamp === "string" && Number.isFinite(Date.parse(rawTimestamp)) ? new Date(rawTimestamp).toISOString() : undefined;
  const validationIssues = safeValidationIssues(...outputs);
  return { ...(safeType ? { apifyErrorType: safeType } : {}), ...(code ? { apifyErrorCode: code } : {}), ...(requestId ? { requestId } : {}), ...(timestamp ? { apifyTimestamp: timestamp } : {}), ...(validationIssues.length ? { validationIssues } : {}) };
}

function cliExitError(exitCode, signal, stdout, stderr) {
  const safeExitCode = Number.isInteger(exitCode) ? exitCode : null;
  const jsonError = parseErrorJson(stdout) ?? parseErrorJson(stderr);
  const rawStatus = jsonError?.statusCode ?? jsonError?.status_code ?? jsonError?.status ?? jsonError?.error?.statusCode ?? jsonError?.error?.status;
  const textStatus = /(?:HTTP(?:\/\d(?:\.\d)?)?\s+|status(?:Code)?["']?\s*[:=]\s*["']?)([1-5]\d\d)\b/i.exec(stderr);
  const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599
    ? rawStatus
    : textStatus ? Number(textStatus[1]) : undefined;
  const safeSignal = typeof signal === "string" && /^[A-Z0-9]{1,16}$/.test(signal) ? signal : undefined;
  const fields = safeErrorFields(stdout, stderr);
  const kind = status !== undefined ? "http_error" : fields.apifyErrorType || fields.apifyErrorCode ? "api_error" : "cli_exit";
  const diagnostic = {
    kind,
    ...(status !== undefined ? { status } : {}),
    ...(safeExitCode !== null ? { exitCode: safeExitCode } : {}),
    ...(safeSignal ? { signal: safeSignal } : {}),
    ...fields,
  };
  const error = new Error(kind === "http_error" ? "apify_http_request_failed" : kind === "api_error" ? "apify_api_error" : "apify_cli_exit_nonzero");
  error.diagnostic = diagnostic;
  return error;
}

export function runApifyCli(command, args, input, { spawnProcess = spawn, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawnProcess(command, args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }); }
    catch (error) { reject(processError(error?.code)); return; }
    const chunks = [];
    let stdoutBytes = 0, stderrBytes = 0, stderr = "", settled = false, closing = false, terminationReason, timer, forceTimer, confirmationTimer;
    const finish = (error, output) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(forceTimer); clearTimeout(confirmationTimer);
      if (error) reject(error); else resolve(output);
    };
    const terminate = (reason) => {
      if (closing || settled) return;
      closing = true;
      terminationReason = reason;
      try { child.kill(); } catch { /* wait for process state below */ }
      forceTimer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* process may already have exited */ } }, 3000);
      // Do not report an ordinary settled request if the OS never confirms exit.
      forceTimer.unref?.();
      confirmationTimer = setTimeout(() => {
        if (!settled) {
          const error = new Error("apify_cli_termination_unconfirmed");
          error.diagnostic = { kind: "process_termination_unconfirmed" };
          finish(error);
        }
      }, 10000);
      confirmationTimer.unref?.();
    };
    timer = setTimeout(() => terminate("apify_cli_timeout"), timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) { terminate("apify_cli_output_limit"); return; }
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
    child.stdin.once("error", () => terminate("apify_cli_stdin_error"));
    child.once("error", (error) => { if (!closing) finish(processError(error?.code)); });
    child.once("close", (code, signal) => {
      if (closing) { clearTimeout(forceTimer); finish(new Error(terminationReason)); return; }
      if (settled) return;
      const stdout = Buffer.concat(chunks, stdoutBytes).toString("utf8");
      if (code !== 0) { finish(cliExitError(code, signal, stdout, stderr)); return; }
      finish(null, stdout);
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
function isNotFound(error) {
  return (error?.diagnostic?.kind === "http_error" && error?.diagnostic?.status === 404) ||
    (error?.diagnostic?.kind === "api_error" && ["page-not-found", "record-not-found"].includes(error?.diagnostic?.apifyErrorType));
}

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
    let raw;
    try {
      raw = await execute(invocation.command, args, body === undefined ? undefined : JSON.stringify(body), { spawnProcess, timeoutMs });
    } catch (cause) {
      const existing = cause?.diagnostic && typeof cause.diagnostic === "object" ? cause.diagnostic : {};
      const error = new Error(cause?.message === "apify_http_request_failed" ? "apify_http_request_failed" : cause?.message === "apify_api_error" ? "apify_api_error" : cause?.message === "apify_cli_exit_nonzero" ? "apify_cli_exit_nonzero" : "apify_request_failed");
      error.diagnostic = { ...existing, method, endpoint, requestTimestamp: new Date().toISOString() };
      throw error;
    }
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
      const { input, ...runOptions } = options;
      return runView(await request("POST", `acts/${encodeURIComponent(actorId)}/runs`, { params: runOptions, body: input, timeoutMs: BUILD_TIMEOUT_MS }));
    },
    async findRunsSince(actorId, since) {
      const response = await request("GET", `acts/${encodeURIComponent(actorId)}/runs`, { params: { limit: 100, desc: true } });
      const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
      return items.map(runView).filter((run) => Number.isFinite(Date.parse(run.startedAt ?? "")) && Date.parse(run.startedAt) >= since);
    },
    async getRun(runId) {
      return runView(await request("GET", `actor-runs/${encodeURIComponent(runId)}`));
    },
    async getRunInput(runId) {
      try { return await request("GET", `actor-runs/${encodeURIComponent(runId)}/key-value-store/records/INPUT`); }
      catch (error) { if (isNotFound(error)) return null; throw error; }
    },
    async putRunGate(runId, record) {
      await request("PUT", `actor-runs/${encodeURIComponent(runId)}/key-value-store/records/I10_GATE`, { body: record });
    },
    async getRunGate(runId) {
      try { return await request("GET", `actor-runs/${encodeURIComponent(runId)}/key-value-store/records/I10_GATE`); }
      catch (error) { if (isNotFound(error)) return null; throw error; }
    },
    async abortRun(runId) {
      await request("POST", `actor-runs/${encodeURIComponent(runId)}/abort`);
    },
  };
}
