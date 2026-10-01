import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { TextDecoder } from "node:util";
import { URL } from "node:url";
import ipaddr from "ipaddr.js";

export const LIMITS = Object.freeze({
  timeoutMs: 10000, maxRedirects: 5, prefixBytes: 512 * 1024,
  structuredBytes: 64 * 1024, maxDomElements: 10000,
  maxOutputChars: 100000, concurrency: 4, perHostDelayMs: 250,
  workerDeadlineMs: 5000, softStopMs: 780000, maxRows: 100,
});
export const NETWORK_RETRIES = 0;
export const mayFollowRedirect = (followed) => Number.isSafeInteger(followed) && followed >= 0 && followed < LIMITS.maxRedirects;

export function addressIsPublic(address) {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) parsed = parsed.toIPv4Address();
    return parsed.range() === "unicast";
  } catch { return false; }
}

export async function resolvePublicTarget(value, resolver = lookup) {
  let url;
  try { url = new URL(value); } catch { return { ok: false, reason: "invalid_url" }; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    return { ok: false, reason: "invalid_http_target" };
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || ["localhost", "local", "internal", "test", "invalid", "example"].some((x) => hostname === x || hostname.endsWith(`.${x}`)))
    return { ok: false, reason: "non_public_hostname" };
  let addresses;
  try { addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolver(hostname, { all: true, verbatim: true }); }
  catch { return { ok: false, reason: "dns_lookup_failed" }; }
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((x) => !addressIsPublic(x.address)))
    return { ok: false, reason: "non_public_dns_address" };
  return { ok: true, url: url.href, hostname, addresses: addresses.map((x) => ({ address: x.address, family: x.family || isIP(x.address) })) };
}

export function pinnedLookup(target) {
  const addresses = target.addresses.map((x) => ({ ...x }));
  return (hostname, options, callback) => {
    if (hostname.toLowerCase() !== target.hostname.toLowerCase()) return callback(new Error("pinned_hostname_mismatch"));
    if (options?.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  };
}

export function redirectUrl(location, current) {
  try { return new URL(location, current).href; } catch { return null; }
}

export async function requestPinned(value, { resolver = lookup, timeoutMs = LIMITS.timeoutMs, headers = {}, method = "GET", body } = {}) {
  const target = await resolvePublicTarget(value, resolver);
  if (!target.ok) return target;
  const url = new URL(target.url), transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request({
      hostname: target.hostname, port: url.port ? Number(url.port) : undefined,
      path: `${url.pathname}${url.search}`, method, headers,
      lookup: pinnedLookup(target), agent: false,
      ...(url.protocol === "https:" && !isIP(target.hostname) ? { servername: target.hostname } : {}),
    }, (response) => resolve({ ok: true, target, response, close: () => { response.destroy(); request.destroy(); } }));
    const timer = setTimeout(() => { const error = new Error("request_timeout"); error.name = "TimeoutError"; request.destroy(error); }, timeoutMs);
    timer.unref?.();
    request.once("close", () => clearTimeout(timer));
    request.once("error", (error) => { clearTimeout(timer); reject(error); });
    request.end(body);
  });
}

export async function boundedPrefix(response, cap = LIMITS.prefixBytes) {
  const encoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
  if (encoding !== "identity") { response.destroy(); throw new Error("compressed_response_rejected"); }
  const declared = Number(response.headers["content-length"] ?? 0);
  const chunks = []; let size = 0, capped = declared > cap;
  return await new Promise((resolve, reject) => {
    const done = () => resolve({ html: new TextDecoder().decode(Buffer.concat(chunks, size)), bytes: size, capped });
    response.on("data", (chunk) => {
      const left = cap - size, take = chunk.subarray(0, Math.max(0, left));
      if (take.length) chunks.push(take);
      size += take.length;
      if (take.length < chunk.length || size === cap) { capped = true; response.destroy(); done(); }
    });
    response.once("end", done);
    response.once("error", (error) => { if (!capped) reject(error); });
  });
}

export function robotsAllows(text, pathname) {
  let groups = [], agents = [], rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(), i = line.indexOf(":");
    if (!line || i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase(), value = line.slice(i + 1).trim();
    if (key === "user-agent") { if (rules.length) { groups.push({ agents, rules }); agents = []; rules = []; } agents.push(value.toLowerCase()); }
    else if ((key === "allow" || key === "disallow") && agents.length && value) rules.push({ allow: key === "allow", path: value });
  }
  if (agents.length) groups.push({ agents, rules });
  const rulesForAgent = groups.filter((g) => g.agents.includes("*")).flatMap((g) => g.rules);
  const matching = rulesForAgent.filter((r) => pathname.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length);
  return !matching.length || matching[0].allow;
}

const nextAt = new Map();
const queues = new Map();
export async function paceHost(host, now = Date.now(), delay = LIMITS.perHostDelayMs, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const key = String(host).toLowerCase();
  const previous = queues.get(key) ?? Promise.resolve(); let release;
  const current = new Promise((resolve) => { release = resolve; }); queues.set(key, current);
  await previous;
  const waitMs = Math.max(0, (nextAt.get(key) ?? now) - now);
  if (waitMs) await sleep(waitMs);
  nextAt.set(key, Math.max(now, nextAt.get(key) ?? now) + delay);
  release();
  return waitMs;
}

export function dedupeFirst(rows) {
  const seen = new Set(), unique = [];
  for (const row of rows) {
    const key = String(row.googleNewsUrl);
    if (seen.has(key)) continue;
    seen.add(key); unique.push(row);
  }
  return { requested: rows.length, returned: rows.length, duplicateCount: rows.length - unique.length, unique };
}
