import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import { parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";

let stage = "import";
let networkAttempts = 0;
function blockedNetwork() {
  networkAttempts += 1;
  throw new Error("network_disabled");
}
globalThis.fetch = blockedNetwork;
http.request = blockedNetwork;
http.get = blockedNetwork;
https.request = blockedNetwork;
https.get = blockedNetwork;
net.connect = blockedNetwork;
net.createConnection = blockedNetwork;
net.Socket.prototype.connect = blockedNetwork;
dns.lookup = blockedNetwork;
dns.lookupService = blockedNetwork;
for (const name of ["resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"])
  dns[name] = blockedNetwork;
for (const name of ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"])
  dns.promises[name] = blockedNetwork;

function post(message) {
  parentPort.postMessage(message);
}

post({ kind: "phase", phase: "worker_ready" });
try {
  const importStarted = performance.now();
  const { extractFromHtml } = await import(workerData.extractorSpecifier ?? "@extractus/article-extractor");
  post({
    kind: "phase",
    phase: "import_complete",
    durationMs: Number((performance.now() - importStarted).toFixed(3)),
  });
  stage = "extract";
  post({ kind: "phase", phase: "extract_started" });
  const extractStarted = performance.now();
  const result = await extractFromHtml(workerData.html, workerData.url);
  const durationMs = Number((performance.now() - extractStarted).toFixed(3));
  const content = typeof result?.content === "string" ? result.content : "";
  if (content.length > 1_048_576) {
    stage = "result_delivery";
    post({ kind: "phase", phase: "extract_complete", durationMs });
    post({ kind: "result_error", errorClass: "oversize_result", failurePhase: "extract" });
  } else {
    stage = "result_delivery";
    post({ kind: "phase", phase: "extract_complete", durationMs });
    post({ kind: "result", content, outputChars: content.length });
  }
} catch {
  const errorClass = networkAttempts > 0 ? "network_attempt" : "extractor_error";
  post({ kind: "result_error", errorClass, failurePhase: stage });
} finally {
  parentPort.close();
}
