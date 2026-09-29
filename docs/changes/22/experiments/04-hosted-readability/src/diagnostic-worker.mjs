import { parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";

const workerStartedAt = performance.now();
parentPort.postMessage({ phase: "worker_started", atMs: workerStartedAt });
try {
  const importStartedAt = performance.now();
  const { extractFromHtml } = await import("@extractus/article-extractor");
  const importedAt = performance.now();
  parentPort.postMessage({ phase: "import_done", elapsedMs: importedAt - importStartedAt });

  const extractionStartedAt = performance.now();
  parentPort.postMessage({ phase: "extract_started" });
  const result = await extractFromHtml(workerData.html, workerData.url);
  const extractedAt = performance.now();
  parentPort.postMessage({ phase: "extract_done", elapsedMs: extractedAt - extractionStartedAt });

  const postStartedAt = performance.now();
  parentPort.postMessage({
    phase: "content",
    content: typeof result?.content === "string" ? result.content : "",
    timings: {
      workerBootToImportStartMs: importStartedAt - workerStartedAt,
      importMs: importedAt - importStartedAt,
      extractMs: extractedAt - extractionStartedAt,
    },
  });
  parentPort.postMessage({ phase: "post_done", elapsedMs: performance.now() - postStartedAt });
} catch (error) {
  parentPort.postMessage({ phase: "error", errorClass: error?.name || "ExtractionError" });
}
