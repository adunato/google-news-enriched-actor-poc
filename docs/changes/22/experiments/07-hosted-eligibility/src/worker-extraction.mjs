import { Worker } from "node:worker_threads";
import { classifyExtractedContent } from "./readability-proxy.mjs";

export const EXTRACTION_DEADLINE_MS = 5000;
let extractionTail = Promise.resolve();
let workerInvocationCount = 0;
let activeWorkerCount = 0;
let maximumActiveWorkerCount = 0;

export function resetWorkerMetrics() {
  workerInvocationCount = 0;
  activeWorkerCount = 0;
  maximumActiveWorkerCount = 0;
}

export function readWorkerMetrics() {
  return { workerInvocationCount, maximumActiveWorkerCount };
}

export function extractOne(html, url, { WorkerClass = Worker, deadlineMs = EXTRACTION_DEADLINE_MS } = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const worker = new WorkerClass(new URL("./extract-worker.mjs", import.meta.url), {
      workerData: { html, url },
    });
    workerInvocationCount += 1;
    activeWorkerCount += 1;
    maximumActiveWorkerCount = Math.max(maximumActiveWorkerCount, activeWorkerCount);
    let settled = false;
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await worker.terminate().catch(() => {});
      activeWorkerCount -= 1;
      resolve({ ...result, extractMs: Math.min(EXTRACTION_DEADLINE_MS, Date.now() - startedAt) });
    };
    const timer = setTimeout(
      () => finish({ status: "timeout", wordCount: 0, segmentCount: 0, fivegramUniqueness: null }),
      deadlineMs,
    );
    worker.once("message", (message) => {
      if (message?.errorClass)
        finish({ status: "error", wordCount: 0, segmentCount: 0, fivegramUniqueness: null });
      else finish(classifyExtractedContent(message?.content ?? ""));
    });
    worker.once("error", () =>
      finish({ status: "error", wordCount: 0, segmentCount: 0, fivegramUniqueness: null }),
    );
    worker.once("exit", (code) => {
      if (code !== 0 && !settled)
        finish({ status: "error", wordCount: 0, segmentCount: 0, fivegramUniqueness: null });
    });
  });
}

export function extractSerially(html, url, options) {
  const current = extractionTail.then(() => extractOne(html, url, options));
  extractionTail = current.then(() => undefined, () => undefined);
  return current;
}
