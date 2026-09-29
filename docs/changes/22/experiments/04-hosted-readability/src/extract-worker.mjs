import { parentPort, workerData } from "node:worker_threads";

try {
  const { extractFromHtml } = await import("@extractus/article-extractor");
  const result = await extractFromHtml(workerData.html, workerData.url);
  parentPort.postMessage({ content: typeof result?.content === "string" ? result.content : "" });
} catch (error) {
  parentPort.postMessage({ errorClass: error?.name || "ExtractionError" });
}
