import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { normalizedPath } from "./tuples.mjs";

const marker = "issue22-h12-deny-external-v1";
globalThis.__ISSUE22_H12_GUARD__ = marker;
process.env.H12_GUARD_MARKER = marker;
const state = {
  allowedSdkByPhase: { sdk_init: 0, input_read: 0, aggregate_write: 0, other: 0 },
  deniedApplication: 0,
  tupleMiss: 0,
  socketDenied: 0,
  socketHostClass: { missing: 0, loopback: 0, other: 0 },
  socketCallShape: { objectStubPort: 0, objectOtherPort: 0, objectNoPort: 0, numberStubPort: 0, numberOtherPort: 0, string: 0, function: 0, undefined: 0, other: 0 },
  socketOptionKeySet: {},
  tuples: [],
  blockedApi: { fetch: 0, httpRequest: 0, httpGet: 0, httpsRequest: 0, httpsGet: 0, netConnect: 0, dns: 0, other: 0 },
};
globalThis.__ISSUE22_H12_COUNTERS__ = state;
const phase = () => process.env.H12_PHASE ?? "unclassified";
const normalize = (method, input, options) => {
  let url;
  try {
    if (input instanceof URL) url = new URL(input.href);
    else if (typeof input === "string") url = new URL(input);
    else if (input && typeof input === "object" && "href" in input) url = new URL(input.href);
    else {
      const opts = typeof input === "object" && input ? input : options ?? {};
      const proto = opts.protocol ?? "http:";
      const host = opts.hostname ?? opts.host ?? "";
      const port = opts.port ? `:${opts.port}` : "";
      url = new URL(`${proto}//${host}${port}${opts.path ?? "/"}`);
    }
  } catch { return null; }
  url.hash = "";
  const path = normalizedPath(`${url.pathname || "/"}${url.search}`);
  return { origin: url.origin, method: String(method ?? "GET").toUpperCase(), path, phase: phase() };
};
const manifestPath = process.env.H12_TUPLE_MANIFEST;
let tuples = [];
if (manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== "issue22-h12-local-tuples-v1" || !Array.isArray(manifest.tuples)) throw new Error("h12_tuple_manifest_invalid");
  if (process.env.H12_DISCOVER_TUPLES !== "1" && manifest.state !== "frozen") throw new Error("h12_tuple_manifest_not_frozen");
  tuples = manifest.tuples;
}
const discovery = process.env.H12_DISCOVER_TUPLES === "1";
const stubPort = Number(process.env.H12_LOCAL_PORT ?? 43821);
const requestContext = new AsyncLocalStorage();
const tupleKey = (tuple) => JSON.stringify(tuple);
const loopback = (hostname) => {
  const value = String(hostname ?? "").toLowerCase();
  return value === "127.0.0.1" || value === "::1" || value === "localhost" || value === "::ffff:127.0.0.1" || /^127\.0\.0\.1:\d+$/.test(value);
};
const blocked = (api) => {
  state.deniedApplication++;
  const key = api.startsWith("http.request") ? "httpRequest" : api.startsWith("http.get") ? "httpGet" : api.startsWith("https.request") ? "httpsRequest" : api.startsWith("https.get") ? "httpsGet" : api.startsWith("net.") ? "netConnect" : api.startsWith("dns") ? "dns" : api === "fetch" ? "fetch" : "other";
  state.blockedApi[key]++;
  const error = new Error("h12_network_denied");
  error.code = "H12_NETWORK_DENIED";
  error.api = api;
  throw error;
};

function guardRequest(original, api, protocol) {
  return function guardedRequest(input, options, callback) {
    const tuple = normalize(options?.method ?? input?.method, input, options);
    if (!tuple || !tuple.origin.startsWith("http://127.0.0.1:")) return blocked(api);
    if (!discovery && !tuples.some((item) => tupleKey(item) === tupleKey(tuple))) {
      state.tupleMiss++;
      return blocked(`${api}_tuple`);
    }
    if (protocol === "https:") return blocked(`${api}_https`);
    const slot = ["sdk_init", "input_read", "aggregate_write"].includes(tuple.phase) ? tuple.phase : "other";
    state.allowedSdkByPhase[slot]++;
    if (!state.tuples.some((item) => tupleKey(item) === tupleKey(tuple))) state.tuples.push(tuple);
    return requestContext.run(tuple, () => original.call(this, input, options, callback));
  };
}

function guardedSocket(original, receiver, options, args, api) {
  let host = typeof options === "object" && options ? (options.host ?? options.hostname) : args[0];
  let port = typeof options === "number" ? options : Number(options?.port ?? options?.localPort);
  const context = requestContext.getStore();
  const contextAllowed = context?.origin === `http://127.0.0.1:${stubPort}` && (discovery || tuples.some((item) => tupleKey(item) === tupleKey(context)));
  const type = options === undefined ? "undefined" : typeof options;
  const shape = type === "object" ? (port === stubPort ? "objectStubPort" : Number.isFinite(port) ? "objectOtherPort" : "objectNoPort") : type === "number" ? (port === stubPort ? "numberStubPort" : "numberOtherPort") : ["string", "function"].includes(type) ? type : "other";
  state.socketCallShape[shape]++;
  if (type === "object" && options) {
    const keySet = Object.keys(options).filter((key) => ["host", "hostname", "port", "path", "socketPath", "localAddress", "family", "lookup", "protocol", "serverName", "servername"].includes(key)).sort().join("|") || "none";
    state.socketOptionKeySet[keySet] = (state.socketOptionKeySet[keySet] ?? 0) + 1;
  }
  if (!host && port === stubPort) {
    host = "127.0.0.1";
    if (typeof options === "object" && options) options = { ...options, host };
    else args[0] = host;
  }
  if (!host && !Number.isFinite(port) && contextAllowed) {
    host = "127.0.0.1";
    port = stubPort;
    if (typeof options === "object" && options) options = { ...options, host, port: stubPort };
    else { options = stubPort; args[0] = host; }
  }
  state.socketHostClass[!host ? "missing" : loopback(host) ? "loopback" : "other"]++;
  if (!loopback(host) || port !== stubPort || !contextAllowed) { state.socketDenied++; return blocked(api); }
  return original.call(receiver, options, ...args);
}

globalThis.fetch = (...args) => blocked("fetch");
http.request = guardRequest(http.request, "http.request", "http:");
http.get = guardRequest(http.get, "http.get", "http:");
https.request = guardRequest(https.request, "https.request", "https:");
https.get = guardRequest(https.get, "https.get", "https:");
for (const method of ["connect", "createConnection"]) {
  const original = net[method];
  net[method] = function guardedSocketConnect(options, ...args) {
    return guardedSocket(original, this, options, args, `net.${method}`);
  };
}
const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedSocketConnect(options, ...args) {
  return guardedSocket(originalSocketConnect, this, options, args, "net.Socket.connect");
};
const originalLookup = dns.lookup;
const originalLookupService = dns.lookupService;
const denyDns = () => blocked("dns");
for (const method of ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"]) {
  if (method === "lookup") dns[method] = function localLoopbackLookup(hostname, options, callback) {
    if (loopback(String(hostname))) return originalLookup.call(this, hostname, options, callback);
    return blocked("dns.lookup");
  };
  else if (method === "lookupService") dns[method] = denyDns;
  else if (method in dns) dns[method] = denyDns;
  if (dns.promises && method in dns.promises) dns.promises[method] = denyDns;
  if (method in dnsPromises) dnsPromises[method] = denyDns;
}

export { marker, state, normalize };
