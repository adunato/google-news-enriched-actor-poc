import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { LIMITS } from "./limits.mjs";

const phases = ["worker_ready", "parse_started", "parse_complete"];
const statuses = new Set(["complete", "dom_limit", "output_limit", "worker_error", "network_attempt"]);
function keysAre(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"); }

export function extractBounded(html, url, { WorkerClass = Worker, deadlineMs = LIMITS.workerDeadlineMs, now = () => performance.now(), signal } = {}) {
  return new Promise((resolve) => {
    const start = now(), deadline = start + deadlineMs;
    let worker, terminal = false, timer, nextPhase = 0, result = null, guardMarker = false;
    const finish = async (status, value = null) => {
      if (terminal) return;
      terminal = true; clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      try { await worker?.terminate(); } catch { /* fixed outcome is already selected */ }
      const outcome = value ?? { status, elapsedMs: Math.max(0, Number((now() - start).toFixed(3))), domElements: 0, structuredStatus: "unavailable", structuredWords: 0, readabilityStatus: "unavailable", readabilityWords: 0, outputChars: 0 };
      resolve(process.env.H12_REQUIRE_GUARD === "1" ? { ...outcome, guardMarker } : outcome);
    };
    const onAbort = () => void finish("timeout");
    if (signal?.aborted) { void finish("timeout"); return; }
    signal?.addEventListener("abort", onAbort, { once: true });
    try { worker = new WorkerClass(new URL("./extract-worker.mjs", import.meta.url), { workerData: { html, url } }); }
    catch { signal?.removeEventListener("abort", onAbort); resolve({ status: "startup_error", elapsedMs: Math.max(0, Number((now() - start).toFixed(3))), domElements: 0, structuredStatus: "unavailable", structuredWords: 0, readabilityStatus: "unavailable", readabilityWords: 0, outputChars: 0 }); return; }
    timer = setTimeout(() => void finish("timeout"), Math.max(0, deadline - now()));
    const late = () => now() >= deadline;
    worker.on("message", (m) => {
      if (terminal) return;
      if (late()) return void finish("timeout");
      if (!m || typeof m !== "object" || Array.isArray(m)) return void finish("protocol_error");
      if (m.kind === "phase") {
        const guardedStartup = process.env.H12_REQUIRE_GUARD === "1" && m.phase === "worker_ready";
        const expectedKeys = m.phase === "parse_complete" ? ["kind", "phase", "durationMs"] : guardedStartup ? ["kind", "phase", "guardMarker"] : ["kind", "phase"];
        if (!keysAre(m, expectedKeys) || m.phase !== phases[nextPhase++]) return void finish("protocol_error");
        if (guardedStartup) {
          if (m.guardMarker !== true) return void finish("worker_error");
          guardMarker = true;
        }
        if (m.phase === "parse_complete" && (!Number.isFinite(m.durationMs) || m.durationMs < 0 || m.durationMs >= deadlineMs)) return void finish("protocol_error");
        return;
      }
      const expected = ["kind", "status", "domElements", "structuredStatus", "structuredWords", "readabilityStatus", "readabilityWords", "outputChars"];
      if (m.kind !== "result" || !keysAre(m, expected) || nextPhase !== 3 || result || !statuses.has(m.status) ||
          !Number.isSafeInteger(m.domElements) || m.domElements < 0 || m.domElements > LIMITS.maxDomElements ||
          !["present", "empty", "cap", "error", "not_scored"].includes(m.structuredStatus) ||
          !Number.isSafeInteger(m.structuredWords) || m.structuredWords < 0 ||
          !["success", "empty", "cap", "error", "not_scored"].includes(m.readabilityStatus) ||
          !Number.isSafeInteger(m.readabilityWords) || m.readabilityWords < 0 ||
          !Number.isSafeInteger(m.outputChars) || m.outputChars < 0 || m.outputChars > LIMITS.maxOutputChars) return void finish("protocol_error");
      if ((m.readabilityStatus === "success") !== (m.readabilityWords > 0) ||
          (m.structuredStatus === "present") !== (m.structuredWords > 0)) return void finish("protocol_error");
      result = m;
    });
    worker.on("error", () => void finish(late() ? "timeout" : "worker_error"));
    worker.on("messageerror", () => void finish(late() ? "timeout" : "protocol_error"));
    worker.on("exit", (code) => {
      if (terminal) return;
      if (late()) return void finish("timeout");
      if (code !== 0 || !result || nextPhase !== 3) return void finish("worker_error");
      void finish("complete", { ...result, elapsedMs: Math.max(0, Number((now() - start).toFixed(3))) });
    });
  });
}
