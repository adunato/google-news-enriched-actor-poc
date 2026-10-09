/* global Buffer, process */
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

export const CHILD_DEADLINE_MS = 12_000;
export const CHILD_KILL_CONFIRM_MS = 2_000;
const DEADLINE_SCHEDULING_MARGIN_MS = 100;
export const MAX_IPC_BYTES = 2 * 1024 * 1024 + 64 * 1024;
const workerPath = fileURLToPath(new URL("./worker.mjs", import.meta.url));
const FETCH_STATUSES = new Set([
  "eligible_html",
  "unsupported_scheme",
  "redirect_limit",
  "unsupported_redirect_scheme",
  "http_denied",
  "http_error",
  "non_html",
  "body_limit",
  "request_error",
]);
const FULL_TEXT_STATUSES = new Set([
  "success",
  "no_readable_text_candidate",
  "not_attempted_fetch_ineligible",
]);

function safeError(error) {
  const name = error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,39}$/u.test(error.name)
    ? error.name
    : "UnknownError";
  const code = error && typeof error.code === "string" && /^[A-Za-z0-9_-]{1,40}$/u.test(error.code)
    ? error.code
    : null;
  return { errorClass: name, errorCode: code };
}

export function isValidWorkerResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result) || Object.hasOwn(result, "body")) return false;
  if (!FETCH_STATUSES.has(result.fetchStatus) || !FULL_TEXT_STATUSES.has(result.fullTextStatus)) return false;
  if (!Number.isInteger(result.requestCount) || result.requestCount < 1 || result.requestCount > 6) return false;
  if (!Number.isInteger(result.redirectCount) || result.redirectCount < 0 || result.redirectCount > 5) return false;
  if (!Number.isInteger(result.wordCount) || result.wordCount < 0 || typeof result.articleText !== "string") return false;
  if (Buffer.byteLength(result.articleText) > MAX_IPC_BYTES - 32_768) return false;
  if (result.httpStatus !== undefined && result.httpStatus !== null &&
      (!Number.isInteger(result.httpStatus) || result.httpStatus < 100 || result.httpStatus > 599)) return false;
  if (result.contentType !== undefined && result.contentType !== null &&
      (typeof result.contentType !== "string" || result.contentType.length > 512)) return false;
  if (result.finalUrl !== undefined && result.finalUrl !== null &&
      (typeof result.finalUrl !== "string" || result.finalUrl.length > 4096)) return false;
  if (result.fetchElapsedMs !== undefined &&
      (typeof result.fetchElapsedMs !== "number" || !Number.isFinite(result.fetchElapsedMs) || result.fetchElapsedMs < 0)) return false;
  if (result.fullTextStatus === "success") {
    return result.fetchStatus === "eligible_html" && result.wordCount > 0 && result.articleText.trim().length > 0;
  }
  if (result.fullTextStatus === "no_readable_text_candidate") {
    return result.fetchStatus === "eligible_html" && result.wordCount === 0 && result.articleText.length === 0;
  }
  return result.fetchStatus !== "eligible_html" && result.wordCount === 0 && result.articleText.length === 0;
}

function rowFailure(row, fetchStatus, extra = {}) {
  return {
    ...row,
    rowId: row.rowId,
    googleNewsUrl: row.googleNewsUrl,
    publisherUrl: row.publisherUrl,
    publisherFetchStatus: fetchStatus,
    fullTextStatus: fetchStatus === "child_timeout" ? "not_attempted_child_timeout" : "not_attempted_child_error",
    wordCount: 0,
    articleText: "",
    ...extra,
  };
}

function makeChild(row, options) {
  const spawnedAt = Date.now();
  const child = fork(workerPath, [], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    execArgv: [],
    windowsHide: true,
  });
  return new Promise((resolve) => {
    let terminal = false;
    let killStartedAt = null;
    let killOutcome = null;
    let pendingMessage = null;
    let deadlineTimer;
    let killTimer;
    const clean = () => {
      clearTimeout(deadlineTimer);
      clearTimeout(killTimer);
      child.removeAllListeners("message");
      child.removeAllListeners("error");
      child.removeAllListeners("exit");
      child.removeAllListeners("close");
    };
    const finish = (outcome, exitCode, signalCode) => {
      if (terminal) return;
      terminal = true;
      clean();
      resolve({
        ...outcome,
        childPid: child.pid ?? null,
        exitCode: exitCode ?? null,
        signalCode: signalCode ?? null,
        spawnedAt,
        completedAt: Date.now(),
        elapsedMs: Date.now() - spawnedAt,
        killStartedAt,
        killToExitMs: killStartedAt === null ? null : Date.now() - killStartedAt,
      });
    };
    const forceKill = (outcome) => {
      if (terminal || killStartedAt !== null) return;
      killStartedAt = Date.now();
      killOutcome = outcome;
      const killRequested = child.kill("SIGKILL");
      killTimer = setTimeout(() => {
        if (!terminal) {
          finish(rowFailure(row, "child_reap_timeout", { childReaped: false, killRequested }), null, null);
        }
      }, CHILD_KILL_CONFIRM_MS);
      killTimer.unref?.();
    };
    deadlineTimer = setTimeout(
      () => forceKill({
        kind: "timeout",
        result: rowFailure(row, "child_timeout", { childReaped: true }),
      }),
      Math.max(0, (options.deadlineMs ?? CHILD_DEADLINE_MS) - DEADLINE_SCHEDULING_MARGIN_MS),
    );
    deadlineTimer.unref?.();
    child.on("message", (message) => {
      if (terminal) return;
      let encoded;
      try {
        encoded = Buffer.byteLength(JSON.stringify(message));
      } catch {
        forceKill({ kind: "invalid_ipc", result: rowFailure(row, "invalid_ipc") });
        return;
      }
      if (encoded > MAX_IPC_BYTES || !message || message.rowId !== row.rowId) {
        forceKill({ kind: "invalid_ipc", result: rowFailure(row, "invalid_ipc") });
        return;
      }
      if (message.type === "result" && isValidWorkerResult(message.result)) {
        pendingMessage = { kind: "result", result: message.result };
      } else if (message.type === "error" &&
          typeof message.errorClass === "string" && /^[A-Za-z][A-Za-z0-9]{0,39}$/u.test(message.errorClass) &&
          (message.errorCode === null || message.errorCode === undefined ||
            (typeof message.errorCode === "string" && /^[A-Za-z0-9_-]{1,40}$/u.test(message.errorCode)))) {
        pendingMessage = { kind: "error", errorClass: message.errorClass, errorCode: message.errorCode };
      } else {
        forceKill({ kind: "invalid_ipc", result: rowFailure(row, "invalid_ipc") });
      }
    });
    child.once("error", (error) => {
      const safe = safeError(error);
      if (child.pid === undefined) {
        finish({ kind: "spawn_error", errorClass: safe.errorClass, errorCode: safe.errorCode }, null, null);
      } else if (killStartedAt === null) {
        forceKill({ kind: "child_process_error", errorClass: safe.errorClass, errorCode: safe.errorCode });
      }
    });
    child.once("exit", (code, signal) => {
      if (terminal) return;
      if (killStartedAt !== null) {
        finish(killOutcome, code, signal);
      } else if (pendingMessage) {
        finish(pendingMessage, code, signal);
      } else {
        finish({ kind: "unexpected_exit", errorClass: "ChildProcessExit", errorCode: String(code ?? signal ?? "unknown") }, code, signal);
      }
    });
    child.once("close", (code, signal) => {
      if (terminal) return;
      if (killStartedAt !== null) {
        finish(killOutcome, code, signal);
      } else if (pendingMessage) {
        finish(pendingMessage, code, signal);
      } else {
        finish({ kind: "unexpected_exit", errorClass: "ChildProcessExit", errorCode: String(code ?? signal ?? "unknown") }, code, signal);
      }
    });
    const control = options.controlForRow ? options.controlForRow(row) : options.control;
    const sendMessage = options.sendMessage ?? ((processChild, message, callback) => processChild.send(message, callback));
    try {
      sendMessage(child, { job: { ...row, control } }, (error) => {
        if (error && !terminal) {
          const safe = safeError(error);
          forceKill({ kind: "ipc_error", errorClass: safe.errorClass, errorCode: safe.errorCode });
        }
      });
    } catch (error) {
      const safe = safeError(error);
      forceKill({ kind: "ipc_error", errorClass: safe.errorClass, errorCode: safe.errorCode });
    }
  });
}

export async function processRow(row, options = {}) {
  const childResult = await makeChild(row, options);
  let outcome;
  switch (childResult.kind) {
    case "result":
      outcome = {
        ...row,
        rowId: row.rowId,
        googleNewsUrl: row.googleNewsUrl,
        publisherUrl: row.publisherUrl,
        ...childResult.result,
        publisherFetchStatus: childResult.result.fetchStatus,
        publisherHttpStatus: childResult.result.httpStatus ?? null,
        childPid: childResult.childPid,
        childElapsedMs: childResult.elapsedMs,
      };
      delete outcome.fetchStatus;
      break;
    case "timeout":
      outcome = childResult.result;
      break;
    case "error":
      outcome = rowFailure(row, "child_error", {
        fullTextStatus: "not_attempted_child_error",
        errorClass: childResult.errorClass,
        errorCode: childResult.errorCode,
        childReaped: childResult.childPid === null || childResult.exitCode !== null || childResult.signalCode !== null,
      });
      break;
    default:
      outcome = rowFailure(row, childResult.kind, {
        fullTextStatus: "not_attempted_child_error",
        errorClass: childResult.errorClass ?? "UnknownError",
        errorCode: childResult.errorCode ?? null,
        childReaped: childResult.childPid === null || childResult.exitCode !== null || childResult.signalCode !== null,
      });
  }
  return {
    outcome,
    processEvidence: {
      kind: childResult.kind,
      childPid: childResult.childPid,
      exitCode: childResult.exitCode,
      signalCode: childResult.signalCode,
      childReaped: childResult.childPid === null || childResult.exitCode !== null || childResult.signalCode !== null,
      elapsedMs: childResult.elapsedMs,
      killToExitMs: childResult.killToExitMs,
    },
  };
}

export async function processRows(rows, options = {}) {
  const outcomes = new Array(rows.length);
  const processEvidence = new Array(rows.length);
  let nextIndex = 0;
  let writeFailure = null;
  const concurrency = options.concurrency ?? 1;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= rows.length || writeFailure) return;
      const result = await processRow(rows[index], options);
      if (!result.processEvidence.childReaped) {
        throw Object.assign(new Error("A child process was not confirmed exited"), { code: "CHILD_REAP_FAILED" });
      }
      outcomes[index] = result.outcome;
      processEvidence[index] = result.processEvidence;
      if (options.writeOutcome) {
        try {
          await options.writeOutcome(result.outcome);
        } catch (error) {
          writeFailure = error;
          return;
        }
      }
    }
  }));
  if (writeFailure) throw writeFailure;
  return { outcomes, processEvidence };
}
