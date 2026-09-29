import { parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import http from "node:http";
import https from "node:https";

let networkAttempts = 0;
const blockNetwork = () => {
  networkAttempts += 1;
  throw new Error("network_disabled_for_local_diagnostic");
};
globalThis.fetch = blockNetwork;
http.request = blockNetwork;
http.get = blockNetwork;
https.request = blockNetwork;
https.get = blockNetwork;

const workerStartedAt = performance.now();
parentPort.postMessage({ phase: "worker_started" });

try {
  const requireFromExperimentLock = createRequire(pathToFileURL(join(workerData.lockRoot, "package.json")));
  const extractorEntry = requireFromExperimentLock.resolve("@extractus/article-extractor");
  const importStartedAt = performance.now();
  const { extractFromHtml } = await import(pathToFileURL(extractorEntry));
  const importedAt = performance.now();
  parentPort.postMessage({ phase: "import_done", elapsedMs: importedAt - importStartedAt });

  const extractionStartedAt = performance.now();
  parentPort.postMessage({ phase: "extract_started" });
  const result = await extractFromHtml(workerData.html, workerData.url);
  const extractedAt = performance.now();
  parentPort.postMessage({ phase: "extract_done", elapsedMs: extractedAt - extractionStartedAt });

  const content = typeof result?.content === "string" ? result.content : "";
  if (content.length > workerData.maxOutputChars) {
    parentPort.postMessage({ phase: "output_limit", networkAttempts });
  } else {
    const postStartedAt = performance.now();
    parentPort.postMessage({
      phase: "content",
      content,
      networkAttempts,
      phaseTimings: {
        workerStartToImportStartMs: importStartedAt - workerStartedAt,
        importMs: importedAt - importStartedAt,
        extractMs: extractedAt - extractionStartedAt,
      },
    });
    parentPort.postMessage({ phase: "post_done", elapsedMs: performance.now() - postStartedAt });
  }
} catch (error) {
  parentPort.postMessage({
    phase: "error",
    errorClass: networkAttempts ? "network_attempt_blocked" : error?.name || "ExtractionError",
    networkAttempts,
  });
}
