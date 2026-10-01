import { parentPort } from "node:worker_threads";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { marker, state } from "./guard-preload.mjs";

const attempts = [];
function blocked(name, call) {
  try { call(); attempts.push({ api: name, blocked: false }); }
  catch (error) { attempts.push({ api: name, blocked: error?.code === "H12_NETWORK_DENIED" }); }
}
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
for (const name of ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"]) {
  if (typeof dns[name] === "function") blocked(`dns.${name}`, () => dns[name]("news.google.com", () => {}));
  if (typeof dnsPromises[name] === "function") blocked(`dns.promises.${name}`, () => dnsPromises[name]("news.google.com"));
}
parentPort.postMessage({
  marker: globalThis.__ISSUE22_H12_GUARD__ === marker,
  attempted: attempts.length,
  allBlocked: attempts.length === 42 && attempts.every((item) => item.blocked),
  blockedApplication: state.deniedApplication,
  tupleMiss: state.tupleMiss,
  socketDenied: state.socketDenied,
  blockedApi: state.blockedApi,
});
