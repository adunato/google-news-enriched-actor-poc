import { parentPort } from "node:worker_threads";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { marker, state } from "./guard-preload.mjs";

const attempted = [];
function probe(name, operation) {
  try { operation(); attempted.push({ name, blocked: false }); }
  catch (error) { attempted.push({ name, blocked: error?.code === "H14_NETWORK_DENIED" }); }
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
for (const name of ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"]) {
  if (typeof dns[name] === "function") probe(`dns.${name}`, () => dns[name]("news.google.com", () => {}));
  if (typeof dnsPromises[name] === "function") probe(`dns.promises.${name}`, () => dnsPromises[name]("news.google.com"));
}
parentPort.postMessage({ marker: globalThis.__ISSUE22_H14_GUARD__ === marker, attempted: attempted.length, allDenied: attempted.length === 42 && attempted.every((item) => item.blocked), failedNames: attempted.filter((item) => !item.blocked).map((item) => item.name), deniedByApi: state.applicationDeniedByApi });
