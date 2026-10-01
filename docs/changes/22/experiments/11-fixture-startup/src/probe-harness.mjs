import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { Worker } from "node:worker_threads";
import { createSdkStub } from "./sdk-stub.mjs";
import { marker, state } from "./guard-preload.mjs";

const stub = createSdkStub({ expectedTuples: [], input: null });
const parentAttempts = [];
const expectParentCount = 15;
function blocked(name, call) {
  try { call(); parentAttempts.push({ api: name, blocked: false }); }
  catch (error) { parentAttempts.push({ api: name, blocked: error?.code === "H12_NETWORK_DENIED" }); }
}
function runParentProbes() {
  blocked("fetch", () => fetch("https://news.google.com/"));
  blocked("http.request", () => http.request("http://news.google.com/"));
  blocked("http.get", () => http.get("http://news.google.com/"));
  blocked("https.request", () => https.request("https://news.google.com/"));
  blocked("https.get", () => https.get("https://news.google.com/"));
  blocked("http.request.unlisted_loopback", () => http.request("http://127.0.0.1:43821/not-allowlisted"));
  blocked("net.connect", () => net.connect(443, "news.google.com"));
  blocked("net.connect.unscoped_loopback", () => net.connect(43821, "127.0.0.1"));
  blocked("net.createConnection", () => net.createConnection(443, "news.google.com"));
  blocked("net.Socket.connect", () => new net.Socket().connect(443, "news.google.com"));
  blocked("dns.lookup", () => dns.lookup("news.google.com", () => {}));
  blocked("dns.lookupService", () => dns.lookupService("127.0.0.1", 80, () => {}));
  blocked("dns.resolve", () => dns.resolve("news.google.com", () => {}));
  blocked("dns.promises.lookup", () => dnsPromises.lookup("news.google.com"));
  blocked("dns.promises.resolve", () => dnsPromises.resolve("news.google.com"));
}
function runWorkerProbes() {
  return new Promise((resolve, reject) => {
    const preload = new URL("./guard-preload.mjs", import.meta.url).href;
    const worker = new Worker(new URL("./guard-probe-worker.mjs", import.meta.url), {
      type: "module",
      execArgv: ["--import", preload],
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("guard_worker_timeout")); }, 5000);
    worker.once("message", (message) => { clearTimeout(timer); resolve(message); });
    worker.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

let result;
let exitCode = 0;
try {
  await stub.listen(43821);
  if (process.env.H12_GUARD_MARKER !== marker || globalThis.__ISSUE22_H12_GUARD__ !== marker) throw new Error("guard_marker_missing");
  const before = stub.tuples().length;
  runParentProbes();
  const parentDeniedByApi = { ...state.blockedApi };
  const workerResult = await runWorkerProbes();
  const stubCallsDuringProbes = stub.tuples().length - before;
  const passed = parentAttempts.length === expectParentCount && parentAttempts.every((item) => item.blocked) &&
    workerResult.marker && workerResult.attempted === 42 && workerResult.allBlocked &&
    stubCallsDuringProbes === 0 && state.deniedApplication === expectParentCount &&
    workerResult.blockedApplication === 42 && state.tupleMiss === 1 && workerResult.tupleMiss === 1 &&
    state.socketDenied === 4 && workerResult.socketDenied === 4;
  result = {
    schemaVersion: "issue22-h12-probe-result-v1",
    outcome: passed ? "all_probes_denied" : "probe_failed",
    probeProcess: true,
    parentAttemptCount: parentAttempts.length,
    parentDeniedByApi,
    workerAttemptCount: workerResult.attempted,
    workerDeniedByApi: workerResult.blockedApi,
    allParentAndWorkerProbesDenied: passed,
    parentGuardMarker: globalThis.__ISSUE22_H12_GUARD__ === marker,
    workerGuardMarker: workerResult.marker,
    stubCallsDuringProbes,
    externalNetwork: "disabled-by-runner-and-guard",
  };
  if (!passed) exitCode = 1;
} catch {
  result = {
    schemaVersion: "issue22-h12-probe-result-v1",
    outcome: "probe_failed",
    probeProcess: true,
    failureCode: parentAttempts.length ? "worker_or_probe_assertion_failed" : "stub_or_parent_probe_failed",
    parentAttemptCount: parentAttempts.length,
    parentDeniedCount: parentAttempts.filter((item) => item.blocked).length,
    parentTupleMiss: state.tupleMiss,
    parentSocketDenied: state.socketDenied,
    parentDeniedByApi: state.blockedApi,
    stubCallsDuringProbes: stub.tuples().length,
  };
  exitCode = 1;
} finally {
  await stub.close();
}
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = exitCode;
