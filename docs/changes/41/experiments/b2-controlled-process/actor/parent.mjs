import { fork } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const workerPath = fileURLToPath(new URL("./worker.mjs", import.meta.url));

export async function runRowInChild(row, sampleId, {
  deadlineMs = 24_000,
  reapMs = 2_000,
  startupHangForTest = false,
} = {}) {
  const t0 = performance.now();
  const events = [];
  let spawnAt = null;
  let readyAt = null;
  let httpRequestAt = null;
  let result = null;
  let childError = null;
  let deadlineHit = false;
  let killSentAt = null;
  let exitAt = null;
  let closeAt = null;
  let exited = false;
  let closed = false;
  let exitCode = null;
  let exitSignal = null;
  let timeoutTimer;
  let reapTimer;
  const child = fork(workerPath, [], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    env: { ...process.env, ISSUE41_TEST_HANG_STARTUP: startupHangForTest ? "1" : "0" },
  });

  const completion = new Promise((resolve) => {
    child.once("spawn", () => { spawnAt = performance.now(); });
    child.on("message", (message) => {
      const receivedAt = performance.now();
      if (!message || typeof message !== "object") return;
      if (message.type === "ready") {
        readyAt ??= receivedAt;
        if (!startupHangForTest) child.send({ row, sampleId });
      } else if (message.type === "timing") {
        events.push({
          stage: message.stage,
          childElapsedMs: message.childElapsedMs,
          parentReceiptElapsedMs: receivedAt - t0,
        });
        if (message.stage === "http_request_start") httpRequestAt ??= receivedAt;
      } else if (message.type === "result") {
        result = message.result;
        events.push({
          stage: "result_received",
          childElapsedMs: message.childElapsedMs,
          parentReceiptElapsedMs: receivedAt - t0,
        });
      } else if (message.type === "error") {
        childError = message.errorClass || "UnknownError";
      }
    });
    child.once("exit", (code, signal) => {
      exitAt = performance.now();
      exited = true;
      exitCode = code;
      exitSignal = signal;
    });
    child.once("close", () => {
      closeAt = performance.now();
      closed = true;
      resolve();
    });
    child.once("error", (error) => {
      childError = error.name || "ChildProcessError";
      resolve();
    });
    timeoutTimer = setTimeout(() => {
      deadlineHit = true;
      killSentAt = performance.now();
      child.kill("SIGKILL");
      reapTimer = setTimeout(() => resolve(), reapMs);
    }, Math.max(0, deadlineMs - (performance.now() - t0)));
  });

  await completion;
  clearTimeout(timeoutTimer);
  clearTimeout(reapTimer);
  const elapsedMs = performance.now() - t0;
  const reaped = exited && closed;
  const timing = {
    t0ToSpawnMs: spawnAt === null ? null : spawnAt - t0,
    t0ToChildReadyMs: readyAt === null ? null : readyAt - t0,
    t0ToHttpRequestMs: httpRequestAt === null ? null : httpRequestAt - t0,
    t0ToTerminalReceiptMs: events.find((event) => event.stage === "result_received")?.parentReceiptElapsedMs ?? null,
    t0ToExitMs: exitAt === null ? null : exitAt - t0,
    t0ToCloseMs: closeAt === null ? null : closeAt - t0,
    t0ToReapMs: reaped && closeAt !== null ? closeAt - t0 : null,
    killRequestElapsedMs: killSentAt === null ? null : killSentAt - t0,
    childTimings: events,
    parentElapsedMs: elapsedMs,
    killToReapMs: killSentAt === null || !reaped || closeAt === null ? null : closeAt - killSentAt,
    childExitCode: exitCode,
    childExitSignal: exitSignal,
  };

  if (!reaped) {
    return { status: "child_error", errorClass: "ChildNotReaped", reaped: false, pid: child.pid, timing };
  }
  if (deadlineHit) {
    return { status: "child_timeout", errorClass: null, reaped: true, pid: child.pid, timing };
  }
  if (childError || !result || exitCode !== 0) {
    return { status: "child_error", errorClass: childError || "MissingChildResult", reaped: true, pid: child.pid, timing };
  }
  return { status: "success", result, reaped: true, pid: child.pid, timing };
}

export async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
