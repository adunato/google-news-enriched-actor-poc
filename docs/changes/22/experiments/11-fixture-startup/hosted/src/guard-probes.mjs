import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { Worker } from "node:worker_threads";
import { marker, state } from "./guard-preload.mjs";

if (process.env.H14_LOCAL_PREFLIGHT !== "1") throw new Error("guard_probe_not_local");
const parent = [];
function probe(name, operation) {
  try { operation(); parent.push({ name, blocked: false }); }
  catch (error) { parent.push({ name, blocked: error?.code === "H14_NETWORK_DENIED" }); }
}
probe("fetch", () => fetch("https://news.google.com/"));
probe("http.request", () => http.request("http://news.google.com/"));
probe("http.get", () => http.get("http://news.google.com/"));
probe("https.request", () => https.request("https://news.google.com/"));
probe("https.get", () => https.get("https://news.google.com/"));
probe("http.request.loopback-unlisted", () => http.request("http://127.0.0.1:43822/unlisted"));
probe("net.connect", () => net.connect(443, "api.apify.com"));
probe("net.connect.loopback", () => net.connect(43822, "127.0.0.1"));
probe("net.createConnection", () => net.createConnection(443, "news.google.com"));
probe("net.Socket.connect", () => new net.Socket().connect(443, "news.google.com"));
probe("dns.lookup", () => dns.lookup("news.google.com", () => {}));
probe("dns.lookupService", () => dns.lookupService("127.0.0.1", 80, () => {}));
probe("dns.resolve", () => dns.resolve("news.google.com", () => {}));
probe("dns.promises.lookup", () => dnsPromises.lookup("news.google.com"));
probe("dns.promises.resolve", () => dnsPromises.resolve("news.google.com"));
const worker = await new Promise((resolve, reject) => {
  const child = new Worker(new URL("./guard-probe-worker.mjs", import.meta.url), {
    type: "module",
    execArgv: ["--import", new URL("./guard-preload.mjs", import.meta.url).href],
  });
  const timer = setTimeout(() => { void child.terminate(); reject(new Error("probe_worker_timeout")); }, 5000);
  child.once("message", (message) => { clearTimeout(timer); resolve(message); });
  child.once("error", reject);
});
const parentDeniedCount = parent.filter((item) => item.blocked).length;
const passed = parent.length === 15 && parentDeniedCount === 15 && worker.marker && worker.attempted === 42 && worker.allDenied;
process.stdout.write(`${JSON.stringify({ schemaVersion: "issue22-h14-negative-result-v1", passed, parentAttemptCount: parent.length, parentDeniedCount, parentFailedNames: parent.filter((item) => !item.blocked).map((item) => item.name), parentDeniedByApi: state.applicationDeniedByApi, workerAttemptCount: worker.attempted, workerAllDenied: worker.allDenied, workerFailedNames: worker.failedNames, workerDeniedByApi: worker.deniedByApi })}\n`);
process.exitCode = passed ? 0 : 1;
