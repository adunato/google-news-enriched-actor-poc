import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { classifyExtractedContent } from "./readability-proxy.mjs";

export const EXTRACTION_DEADLINE_MS = 5000;
const PHASE_ORDER = ["worker_ready", "import_complete", "extract_started", "extract_complete"];
const ERROR_CLASSES = new Set(["extractor_error", "network_attempt", "oversize_result"]);
const FAILURE_PHASES = new Set(["import", "extract"]);

function fixedOutcome(status, terminalPhase, timing, proxyStatus = "not_scored") {
  return { status, terminalPhase, timing, proxyStatus };
}

function phaseForLast(lastPhase) {
  if (lastPhase === null) return "startup";
  if (lastPhase === "worker_ready") return "import";
  if (lastPhase === "import_complete" || lastPhase === "extract_started") return "extract";
  if (lastPhase === "extract_complete") return "result_delivery";
  return "worker_exit";
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

export function runWorkerAttempt(html, url, {
  WorkerClass = Worker,
  deadlineMs = EXTRACTION_DEADLINE_MS,
  extractorSpecifier = null,
  now = () => performance.now(),
  classify = classifyExtractedContent,
} = {}) {
  return new Promise((resolve) => {
    const startedAt = now();
    const deadlineAt = startedAt + Math.max(0, deadlineMs);
    let worker;
    try {
      worker = new WorkerClass(new URL("./extract-worker.mjs", import.meta.url), {
        workerData: { html, url, ...(extractorSpecifier ? { extractorSpecifier } : {}) },
      });
    } catch {
      resolve(now() >= deadlineAt
        ? fixedOutcome("timeout", "startup", {})
        : fixedOutcome("worker_error", "startup", {}, "error"));
      return;
    }

    const timing = { startupMs: null, importMs: null, extractMs: null, resultDeliveryMs: null, workerExitMs: null };
    let settled = false;
    let lastPhase = null;
    let phaseIndex = -1;
    let resultReceivedAt = null;
    let extractCompleteReceivedAt = null;
    let pendingOutcome = null;
    let protocolError = false;
    let timer;

    const timeoutOutcome = () => pendingOutcome
      ? fixedOutcome("worker_exit_timeout", "worker_exit", timing, pendingOutcome.proxyStatus)
      : fixedOutcome("timeout", phaseForLast(lastPhase), timing);

    const expireIfLate = () => {
      if (now() < deadlineAt) return false;
      void finish(timeoutOutcome());
      return true;
    };

    const finish = async (outcome, terminate = true) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (terminate) {
        try { await worker.terminate(); } catch { /* fixed terminal class already selected */ }
      }
      resolve({ ...outcome, timing });
    };

    const protocolFailure = () => {
      protocolError = true;
      void finish(fixedOutcome("protocol_error", "protocol", timing, "error"));
    };

    timer = setTimeout(() => void finish(timeoutOutcome()), Math.max(0, deadlineAt - now()));

    worker.on("message", (message) => {
      if (settled) return;
      if (expireIfLate()) return;
      if (!message || typeof message !== "object" || Array.isArray(message)) return protocolFailure();

      if (message.kind === "phase") {
        const nextIndex = phaseIndex + 1;
        const expected = PHASE_ORDER[nextIndex];
        if (message.phase !== expected) return protocolFailure();
        if (message.phase === "worker_ready") {
          if (!exactKeys(message, ["kind", "phase"])) return protocolFailure();
          timing.startupMs = Number((now() - startedAt).toFixed(3));
        } else if (message.phase === "import_complete" || message.phase === "extract_complete") {
          if (!exactKeys(message, ["kind", "phase", "durationMs"]) ||
              !Number.isFinite(message.durationMs) || message.durationMs < 0 || message.durationMs >= deadlineMs)
            return protocolFailure();
          timing[message.phase === "import_complete" ? "importMs" : "extractMs"] = message.durationMs;
          if (message.phase === "extract_complete") extractCompleteReceivedAt = now();
        } else if (!exactKeys(message, ["kind", "phase"])) {
          return protocolFailure();
        }
        phaseIndex = nextIndex;
        lastPhase = message.phase;
        return;
      }

      if (message.kind === "result_error") {
        if (!exactKeys(message, ["kind", "errorClass", "failurePhase"]) ||
            !ERROR_CLASSES.has(message.errorClass) || !FAILURE_PHASES.has(message.failurePhase) || pendingOutcome)
          return protocolFailure();
        const phaseMatches = message.errorClass === "oversize_result"
          ? message.failurePhase === "extract" && phaseIndex === 3
          : message.failurePhase === "import"
            ? phaseIndex === 0
            : phaseIndex === 2;
        if (!phaseMatches) return protocolFailure();
        pendingOutcome = fixedOutcome(
          message.errorClass === "oversize_result" ? "oversize" : message.errorClass === "network_attempt" ? "network_attempt" : "worker_error",
          message.failurePhase,
          timing,
          message.errorClass === "oversize_result" ? "oversize" : "error",
        );
        return;
      }

      if (message.kind === "result") {
        if (!exactKeys(message, ["kind", "content", "outputChars"]) || phaseIndex !== 3 || pendingOutcome ||
            typeof message.content !== "string" || !Number.isSafeInteger(message.outputChars) ||
            message.outputChars !== message.content.length || message.outputChars > 1_048_576)
          return protocolFailure();
        const resultAt = now();
        let proxyStatus;
        try { proxyStatus = classify(message.content).status; } catch {
          timing.resultDeliveryMs = Number((now() - (extractCompleteReceivedAt ?? resultAt)).toFixed(3));
          resultReceivedAt = now();
          pendingOutcome = fixedOutcome("worker_error", "result_delivery", timing, "error");
          return;
        }
        timing.resultDeliveryMs = Number((now() - (extractCompleteReceivedAt ?? resultAt)).toFixed(3));
        resultReceivedAt = now();
        pendingOutcome = proxyStatus === "error"
          ? fixedOutcome("worker_error", "result_delivery", timing, "error")
          : fixedOutcome(proxyStatus, "worker_exit", timing, proxyStatus);
        return;
      }

      protocolFailure();
    });

    worker.on("error", () => {
      if (settled || expireIfLate()) return;
      void finish(fixedOutcome("worker_error", pendingOutcome ? "worker_exit" : phaseForLast(lastPhase), timing, "error"));
    });
    worker.on("messageerror", () => {
      if (settled || expireIfLate()) return;
      void finish(fixedOutcome("message_error", pendingOutcome ? "worker_exit" : phaseForLast(lastPhase), timing, "error"));
    });
    worker.on("exit", (code) => {
      if (settled) return;
      if (expireIfLate()) return;
      if (protocolError) return void finish(fixedOutcome("protocol_error", "protocol", timing, "error"), false);
      if (!pendingOutcome) return void finish(fixedOutcome("worker_exit_error", "worker_exit", timing, "error"), false);
      if (code !== 0) return void finish(fixedOutcome("worker_exit_error", "worker_exit", timing, "error"), false);
      if (resultReceivedAt !== null)
        timing.workerExitMs = Number((now() - resultReceivedAt).toFixed(3));
      void finish(pendingOutcome, false);
    });
  });
}

let serialTail = Promise.resolve();
let attemptCount = 0;
export function resetWorkerMetrics() { serialTail = Promise.resolve(); attemptCount = 0; }
export function readWorkerMetrics() { return { attemptCount, deadlineMs: EXTRACTION_DEADLINE_MS }; }

export function extractSerially(html, url, options) {
  const current = serialTail.then(() => {
    attemptCount += 1;
    return runWorkerAttempt(html, url, options);
  });
  serialTail = current.then(() => undefined, () => undefined);
  return current;
}
