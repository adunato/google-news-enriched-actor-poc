import http from "node:http";
import https from "node:https";
import net from "node:net";
import { parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";

let networkAttempts = 0;
function blockNetwork() {
  networkAttempts += 1;
  throw new Error("local_network_disabled");
}
globalThis.fetch = blockNetwork;
http.request = blockNetwork;
http.get = blockNetwork;
https.request = blockNetwork;
https.get = blockNetwork;
net.connect = blockNetwork;
net.createConnection = blockNetwork;
net.Socket.prototype.connect = blockNetwork;

function phase(name, extra = {}) {
  parentPort.postMessage({ kind: "phase", phase: name, ...extra });
}

phase("worker_ready");
try {
  const importStarted = performance.now();
  const { extractFromHtml } = await import(
    new URL("../07-hosted-eligibility/node_modules/@extractus/article-extractor/esm/mod.js", import.meta.url)
  );
  phase("import_complete", { importMs: Number((performance.now() - importStarted).toFixed(3)), networkAttempts });
  phase("extract_started");
  const extractionStarted = performance.now();
  const result = await extractFromHtml(workerData.html, workerData.url);
  const extractMs = Number((performance.now() - extractionStarted).toFixed(3));
  const content = typeof result?.content === "string" ? result.content : "";
  phase("extract_complete", { extractMs, networkAttempts });
  if (content.length > 1_048_576) {
    parentPort.postMessage({ kind: "oversize_result", outputChars: content.length, networkAttempts });
  } else {
    parentPort.postMessage({ kind: "result", content, outputChars: content.length, networkAttempts });
  }
} catch {
  parentPort.postMessage({ kind: "result_error", errorClass: "extraction_error", networkAttempts });
}
