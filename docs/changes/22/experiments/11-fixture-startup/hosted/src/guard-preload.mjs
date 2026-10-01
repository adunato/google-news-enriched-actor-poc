import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { normalizedPath } from "./tuples.mjs";
import { assertNoProxyOverride, resolveRuntimeOrigin } from "./runtime-origin.mjs";

assertNoProxyOverride(process.env);
const localMode = process.env.H15B_LOCAL_PREFLIGHT === "1";
const runtimeOrigin = resolveRuntimeOrigin({
  apiBaseUrl: process.env.APIFY_API_BASE_URL,
  isAtHome: process.env.APIFY_IS_AT_HOME,
  localMode,
});
const { origin, hostname: approvedHost, port: approvedPort } = runtimeOrigin;

const marker = "issue22-h15b-hosted-guard-v1";
globalThis.__ISSUE22_H15B_GUARD__ = marker;
process.env.H15B_GUARD_MARKER = marker;
globalThis.__ISSUE22_H12_GUARD__ = "issue22-h12-deny-external-v1";
process.env.H12_GUARD_MARKER = "issue22-h12-deny-external-v1";
process.env.H12_REQUIRE_GUARD = "1";
process.env.ACTORS_DISABLE_OUTDATED_WARNING = "1";
process.env.ACTOR_EVENTS_WEBSOCKET_URL = "";
process.env.APIFY_ACTOR_EVENTS_WS_URL = "";

const state = {
  sdkAllowedByPhase: { sdk_init: 0, input_read: 0, run_gate: 0, aggregate_write: 0, readback: 0, exit: 0 },
  applicationDeniedByApi: { fetch: 0, httpRequest: 0, httpGet: 0, httpsRequest: 0, httpsGet: 0, net: 0, dns: 0 },
  tupleMiss: 0,
  socketDenied: 0,
  dnsDenied: 0,
  tuples: [],
  localRejectedSdkRoute: null,
};
globalThis.__ISSUE22_H15B_COUNTERS__ = state;
const sdkPhase = new AsyncLocalStorage();
const requestTuple = new AsyncLocalStorage();
const tupleKey = (value) => JSON.stringify(value);
const localOrigin = "http://127.0.0.1:43822";

const manifestPath = new URL("./tuple-manifest.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.schemaVersion !== "issue22-h15b-sdk-tuples-v1" || manifest.state !== "source-checked" || manifest.origin !== "runtime-validated-private-ipv4" || !Array.isArray(manifest.tuples) || manifest.tuples.length !== 7) throw new Error("h15b_tuple_manifest_invalid");
function runtimeTuplePath(template) {
  return template.replace(/\{([A-Z0-9_]+)\}/gu, (_match, name) => {
    const value = process.env[name];
    return value && /^[A-Za-z0-9_-]{1,100}$/u.test(value) ? value : `H15B_MISSING_${name}`;
  });
}
const tupleEntries = manifest.tuples.map((entry) => ({
  route: entry.path,
  tuple: { origin, method: entry.method, path: runtimeTuplePath(entry.path), phase: entry.phase },
}));
const tuples = tupleEntries.map((entry) => entry.tuple);
const allowedPhases = new Set(Object.keys(state.sdkAllowedByPhase));
function deny(api, { tupleMiss = false } = {}) {
  if (tupleMiss) state.tupleMiss++;
  const key = api.startsWith("http.request") ? "httpRequest" : api.startsWith("http.get") ? "httpGet" : api.startsWith("https.request") ? "httpsRequest" : api.startsWith("https.get") ? "httpsGet" : api.startsWith("net") ? "net" : api === "fetch" ? "fetch" : "dns";
  state.applicationDeniedByApi[key]++;
  const error = new Error("h15b_network_denied");
  error.code = "H15B_NETWORK_DENIED";
  throw error;
}
function normalize(method, input, options) {
  let url;
  try {
    if (input instanceof URL) url = new URL(input.href);
    else if (typeof input === "string") url = new URL(input, `${origin}/`);
    else if (input && typeof input === "object" && "href" in input) url = new URL(input.href);
    else {
      const opts = typeof input === "object" && input ? input : options ?? {};
      const protocol = opts.protocol ?? "https:";
      const host = opts.hostname ?? opts.host ?? "";
      const port = opts.port ? `:${opts.port}` : "";
      url = new URL(`${protocol}//${host}${port}${opts.path ?? "/"}`);
    }
  } catch { return null; }
  url.hash = "";
  const path = normalizedPath(`${url.pathname || "/"}${url.search}`);
  return { origin: url.origin, method: String(method ?? "GET").toUpperCase(), path, phase: sdkPhase.getStore() ?? "application" };
}
function expectedSdkTuple(tuple) {
  return tuple && tuple.origin === origin && allowedPhases.has(tuple.phase) && tuples.some((entry) => tupleKey(entry) === tupleKey(tuple));
}
function matchingSdkTuple(tuple) {
  return expectedSdkTuple(tuple) ? tupleEntries.find((entry) => tupleKey(entry.tuple) === tupleKey(tuple)) : null;
}
function guardedRequest(original, api) {
  return function requestGuard(input, options, callback) {
    const tuple = normalize(options?.method ?? input?.method, input, options);
    if (!expectedSdkTuple(tuple)) {
      if (localMode && tuple?.path?.startsWith(`/v2/datasets/${process.env.APIFY_DEFAULT_DATASET_ID}/items?`)) {
        const url = new URL(tuple.path, `${localOrigin}/`);
        state.localRejectedSdkRoute = { method: tuple.method, route: "/v2/datasets/{APIFY_DEFAULT_DATASET_ID}/items", queryKeys: [...url.searchParams.keys()].sort() };
      }
      return deny(api, { tupleMiss: true });
    }
    if (tuple.phase === "application") return deny(api);
    state.sdkAllowedByPhase[tuple.phase]++;
    const matchedEntry = matchingSdkTuple(tuple);
    if (!state.tuples.some((entry) => entry.method === tuple.method && entry.path === matchedEntry.route && entry.phase === tuple.phase)) {
      state.tuples.push({ method: tuple.method, path: matchedEntry.route, phase: tuple.phase, originClass: localMode ? "loopback_stub" : "runtime_validated_private_ipv4" });
    }
    return requestTuple.run(tuple, () => original.call(this, input, options, callback));
  };
}
function guardedSocket(original, receiver, options, args, api) {
  const context = requestTuple.getStore();
  let host = typeof options === "object" && options ? (options.host ?? options.hostname) : args[0];
  let port = typeof options === "number" ? options : Number(options?.port ?? options?.localPort);
  if (context && expectedSdkTuple(context) && !host && !Number.isFinite(port)) {
    host = approvedHost;
    port = approvedPort;
    if (typeof options === "object" && options) options = { ...options, host, port };
    else if (typeof options === "number") args[0] = host;
    else options = { host, port };
  }
  const hostOkay = localMode
    ? ["127.0.0.1", "localhost", "::1"].includes(String(host ?? "").toLowerCase()) && port === approvedPort
    : String(host ?? "") === approvedHost && port === approvedPort;
  if (!context || !expectedSdkTuple(context) || !hostOkay) {
    state.socketDenied++;
    return deny(api);
  }
  return original.call(receiver, options, ...args);
}

globalThis.fetch = () => deny("fetch");
http.request = guardedRequest(http.request, "http.request");
http.get = guardedRequest(http.get, "http.get");
https.request = guardedRequest(https.request, "https.request");
https.get = guardedRequest(https.get, "https.get");
for (const method of ["connect", "createConnection"]) {
  const original = net[method];
  net[method] = function netGuard(options, ...args) { return guardedSocket(original, this, options, args, `net.${method}`); };
}
const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function socketGuard(options, ...args) { return guardedSocket(originalSocketConnect, this, options, args, "net.Socket.connect"); };
const originalLookup = dns.lookup;
dns.lookup = function lookupGuard(hostname, options, callback) {
  const context = requestTuple.getStore();
  const allowedHost = localMode && ["127.0.0.1", "localhost", "::1"].includes(String(hostname).toLowerCase());
  if (!context || !expectedSdkTuple(context) || !allowedHost) { state.dnsDenied++; return deny("dns.lookup"); }
  return originalLookup.call(this, hostname, options, callback);
};
if (dns.promises) dns.promises.lookup = () => { state.dnsDenied++; return deny("dns.promises.lookup"); };
dnsPromises.lookup = () => { state.dnsDenied++; return deny("dns.promises.lookup"); };
for (const method of ["lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"]) {
  if (method in dns) dns[method] = () => { state.dnsDenied++; return deny(`dns.${method}`); };
  if (dns.promises && method in dns.promises) dns.promises[method] = () => { state.dnsDenied++; return deny(`dns.promises.${method}`); };
  if (method in dnsPromises) dnsPromises[method] = () => { state.dnsDenied++; return deny(`dns.promises.${method}`); };
}

export function withSdkPhase(phase, operation) {
  if (!allowedPhases.has(phase)) throw new Error("h15b_sdk_phase_rejected");
  return sdkPhase.run(phase, operation);
}
export { marker, state, tuples };
