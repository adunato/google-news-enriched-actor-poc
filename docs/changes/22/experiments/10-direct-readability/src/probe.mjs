import { Actor } from "apify";
import { XMLParser } from "fast-xml-parser";
import { LIMITS, boundedPrefix, dedupeFirst, paceHost, redirectUrl, requestPinned, robotsAllows } from "./network.mjs";
import { extractBounded } from "./extract.mjs";
import { persistAggregateOnly } from "./aggregate.mjs";
import { assertHostedRunGate } from "./runtime-gate.mjs";
import process from "node:process";

const QUERIES = ["world news", "politics", "business", "technology", "climate change"];
const EDITIONS = [{ country: "GB", language: "en-GB" }, { country: "US", language: "en-US" }];
const USER_AGENT = "GoogleNewsAccessSpike/0.1 (+https://github.com/adunato/google-news-enriched-actor-poc)";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", parseTagValue: false, trimValues: true });
const now = () => Date.now();
const host = (value) => { try { return new URL(value).hostname.toLowerCase(); } catch { return ""; } };
const googleHost = (value) => /(^|\.)google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(host(value)) || host(value) === "news.google.com";
const publisher = (value) => { try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) && !googleHost(value) ? u.href : null; } catch { return null; } };
const text = (v) => typeof v === "string" ? v.trim() : v && typeof v === "object" ? String(v["#text"] ?? "").trim() : "";
const list = (v) => v == null ? [] : Array.isArray(v) ? v : [v];

async function getText(opened, cap) {
  const response = opened.response;
  const prefix = await boundedPrefix(response, cap);
  return prefix;
}

async function fetchFeed(query, edition) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:7d`); url.searchParams.set("hl", edition.language);
  url.searchParams.set("gl", edition.country); url.searchParams.set("ceid", `${edition.country}:${edition.language}`);
  await paceHost(url.hostname);
  const opened = await requestPinned(url.href, { headers: { accept: "application/rss+xml, application/xml, text/xml", "accept-encoding": "identity", "user-agent": USER_AGENT } });
  if (!opened.ok) return [];
  try {
    const response = opened.response;
    if (response.statusCode < 200 || response.statusCode >= 300 || !/xml|rss/i.test(String(response.headers["content-type"] ?? ""))) return [];
    const xml = await getText(opened, 2 * 1024 * 1024);
    if (xml.capped) return [];
    const items = list(parser.parse(xml.html)?.rss?.channel?.item);
    return items.slice(0, 10).map((item) => ({ googleNewsUrl: text(item.link) })).filter((row) => row.googleNewsUrl);
  } catch { return []; } finally { opened.close(); }
}

function articleId(url) {
  try { const u = new URL(url), parts = u.pathname.split("/").filter(Boolean), i = parts.indexOf("articles"); return u.hostname === "news.google.com" && i >= 0 ? parts[i + 1] : null; } catch { return null; }
}
function markers(html, id) {
  const re = /<[^>]*\bdata-n-a-id\s*=\s*(["'])(.*?)\1[^>]*>/gis;
  for (const match of html.matchAll(re)) {
    const tag = match[0], got = match[2], ts = tag.match(/\bdata-n-a-ts\s*=\s*(["'])(.*?)\1/i)?.[2], sg = tag.match(/\bdata-n-a-sg\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (got === id && ts && sg) return { id: got, ts, sg };
  }
  return null;
}
function rpcBody(m) {
  const context = [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0];
  const req = ["garturlreq", context, m.id, /^\d+$/.test(m.ts) ? Number(m.ts) : m.ts, m.sg];
  return `f.req=${encodeURIComponent(JSON.stringify([[["Fbv4je", JSON.stringify(req), null, "0"]]]))}`;
}
function findRpc(value) {
  if (typeof value === "string") { try { return findRpc(JSON.parse(value)); } catch { return null; } }
  if (!Array.isArray(value)) return null;
  if (value[0] === "garturlres" && typeof value[1] === "string") return value[1];
  for (const child of value) { const found = findRpc(child); if (found) return found; }
  return null;
}
function parseRpc(body) {
  for (let line of body.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
    if (/^\d+$/.test(line)) continue;
    if (line.startsWith(")]}'")) line = line.slice(4).trim();
    try { const candidate = findRpc(JSON.parse(line)); if (candidate) return candidate; } catch { /* fixed outcome: no candidate */ }
  }
  return null;
}

async function resolveCandidate(googleNewsUrl) {
  let current = googleNewsUrl;
  for (let redirects = 0; redirects <= LIMITS.maxRedirects; redirects++) {
    await paceHost(host(current));
    const opened = await requestPinned(current, { headers: { accept: "text/html,application/xhtml+xml", "accept-encoding": "identity", "user-agent": USER_AGENT } });
    if (!opened.ok) return null;
    try {
      const response = opened.response, location = response.headers.location;
      if (location && [301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (redirects === LIMITS.maxRedirects) return null;
        const next = redirectUrl(location, current); if (!next) return null;
        if (!googleHost(next)) return publisher(next);
        current = next; continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) return null;
      const page = await getText(opened, 2 * 1024 * 1024);
      if (page.capped) return null;
      const id = articleId(googleNewsUrl), meta = id ? markers(page.html, id) : null;
      if (!meta) return null;
      const rpcUrl = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
      await paceHost(host(rpcUrl));
      const rpc = await requestPinned(rpcUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", accept: "*/*", "user-agent": USER_AGENT, "accept-encoding": "identity" }, body: rpcBody(meta) });
      if (!rpc.ok) return null;
      try {
        if (rpc.response.statusCode < 200 || rpc.response.statusCode >= 300) return null;
        const payload = await getText(rpc, 2 * 1024 * 1024);
        return payload.capped ? null : publisher(parseRpc(payload.html) ?? "");
      } finally { rpc.close(); }
    } finally { opened.close(); }
  }
  return null;
}

export function robotsPolicy(textValue, pathname, status, userAgent = USER_AGENT) {
  if (status === 404) return "not_found";
  if (status < 200 || status >= 300 || typeof textValue !== "string") return "unavailable";
  return robotsAllows(textValue, pathname, userAgent) ? "allowed" : "disallowed";
}

export function readabilityOutcome(result) {
  if (result.status === "startup_error" || result.status === "worker_error") return "worker_error";
  if (result.status === "network_attempt") return "network_attempt";
  if (result.readabilityStatus === "success") return "success";
  if (["timeout", "dom_limit", "output_limit", "protocol_error"].includes(result.status)) return result.status;
  return "empty";
}

const robotsCache = new Map();
async function robotsFor(url) {
  const u = new URL(url), origin = u.origin;
  if (!robotsCache.has(origin)) robotsCache.set(origin, (async () => {
    await paceHost(u.hostname);
    const opened = await requestPinned(`${origin}/robots.txt`, { headers: { accept: "text/plain", "accept-encoding": "identity", "user-agent": USER_AGENT } });
    if (!opened.ok) return { status: null, signal: "unavailable" };
    try {
      const res = opened.response;
      if (res.statusCode === 404) return { status: 404, signal: "not_found" };
      if (res.statusCode < 200 || res.statusCode >= 300) return { status: res.statusCode, signal: "unavailable" };
      const prefix = await boundedPrefix(res, 64 * 1024);
      if (prefix.capped) return { status: res.statusCode, signal: "unavailable" };
      return { status: res.statusCode, text: prefix.html };
    } catch { return { status: null, signal: "unavailable" }; } finally { opened.close(); }
  })());
  const cached = await robotsCache.get(origin);
  if (cached.text !== undefined) return { status: cached.status, signal: robotsAllows(cached.text, u.pathname, USER_AGENT) ? "allowed" : "disallowed" };
  return cached;
}

async function inspectPublisher(candidateUrl) {
  const absent = { robots: "not_checked", fetch: "not_attempted", readability: "not_attempted", structured: "not_attempted", prefix: "unavailable", elapsed: "unavailable", dom: "unavailable", workerTime: "unavailable" };
  const started = now();
  try {
    let current = candidateUrl;
    for (let redirects = 0; redirects <= LIMITS.maxRedirects; redirects++) {
      const url = new URL(current), robots = await robotsFor(url.href);
      if (!["allowed", "not_found"].includes(robots.signal)) return { ...absent, robots: robots.signal, elapsed: elapsedBin(now() - started) };
      await paceHost(url.hostname);
      const opened = await requestPinned(url.href, { headers: { accept: "text/html,application/xhtml+xml", "accept-encoding": "identity", "user-agent": USER_AGENT } });
      if (!opened.ok) return { ...absent, robots: "unavailable", fetch: "transport_error", elapsed: elapsedBin(now() - started) };
      try {
        const res = opened.response, location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && location) {
          if (redirects === LIMITS.maxRedirects) return { ...absent, robots: robots.signal, fetch: "http_other", elapsed: elapsedBin(now() - started) };
          const next = redirectUrl(location, url.href);
          if (!next) return { ...absent, robots: robots.signal, fetch: "http_other", elapsed: elapsedBin(now() - started) };
          current = next;
          continue;
        }
        const type = String(res.headers["content-type"] ?? "");
        if (res.statusCode < 200 || res.statusCode >= 300 || !/text\/html|application\/xhtml\+xml/i.test(type)) return { ...absent, robots: robots.signal, fetch: "http_other", elapsed: elapsedBin(now() - started) };
        let prefix;
        try { prefix = await boundedPrefix(res, LIMITS.prefixBytes); } catch { return { ...absent, robots: robots.signal, fetch: "transport_error", elapsed: elapsedBin(now() - started) }; }
        const result = await extractBounded(prefix.html, url.href);
        const readability = readabilityOutcome(result);
        return { robots: robots.signal, fetch: "http_2xx_html", readability, structured: result.structuredStatus, prefix: prefix.capped ? "capped" : "not_capped", elapsed: elapsedBin(now() - started), dom: domBin(result.domElements), workerTime: workerTimeBin(result.elapsedMs) };
      } finally { opened.close(); }
    }
    return { ...absent, fetch: "http_other", elapsed: elapsedBin(now() - started) };
  } catch { return { ...absent, fetch: "transport_error", elapsed: elapsedBin(now() - started) }; }
}

function elapsedBin(ms) { return ms < 100 ? "lt_100ms" : ms < 500 ? "100_to_lt_500ms" : ms < 1000 ? "500ms_to_lt_1s" : ms < 2000 ? "1s_to_lt_2s" : ms < 5000 ? "2s_to_lt_5s" : ms < 10000 ? "5s_to_lt_10s" : ms < 30000 ? "10s_to_lt_30s" : "30s_or_more"; }
function workerTimeBin(ms) { return ms < 100 ? "lt_100ms" : ms < 500 ? "100_to_lt_500ms" : ms < 1000 ? "500ms_to_lt_1s" : ms < 2000 ? "1s_to_lt_2s" : ms < 5000 ? "2s_to_lt_5s" : "at_deadline"; }
function domBin(n) { return n < 1000 ? "lt_1k" : n < 5000 ? "1k_to_lt_5k" : n < 10000 ? "5k_to_lt_10k" : "10k_cap"; }
export async function mapLimit(items, limit, fn) {
  const results = Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => { while (true) { const i = next++; if (i >= items.length) return; results[i] = await fn(items[i], i); } }));
  return results;
}

export async function executeIteration10({ actor = Actor, feed = fetchFeed, resolve = resolveCandidate, inspect = inspectPublisher, clock = now } = {}) {
  const started = clock(), slots = [];
  for (let qi = 0; qi < QUERIES.length; qi++) for (let ei = 0; ei < EDITIONS.length; ei++) {
    const cellId = `q${qi + 1}-${EDITIONS[ei].country.toLowerCase()}`;
    const rows = clock() - started >= LIMITS.softStopMs ? [] : await feed(QUERIES[qi], EDITIONS[ei]);
    for (let slot = 1; slot <= 10; slot++) slots.push({ cellId, slot, googleNewsUrl: rows[slot - 1]?.googleNewsUrl ?? null });
  }
  const returned = slots.filter((x) => x.googleNewsUrl);
  const deduped = dedupeFirst(returned);
  const uniqueByUrl = new Map(deduped.unique.map((x) => [x.googleNewsUrl, x]));
  const uniqueCandidates = await mapLimit(deduped.unique, LIMITS.concurrency, async (row) => {
    if (clock() - started >= LIMITS.softStopMs) return { row, candidateUrl: null };
    try { return { row, candidateUrl: await resolve(row.googleNewsUrl) }; } catch { return { row, candidateUrl: null }; }
  });
  const candidateByUrl = new Map(uniqueCandidates.map((x) => [x.row.googleNewsUrl, x.candidateUrl]));
  const tasks = slots.map((slot) => { const duplicate = !!slot.googleNewsUrl && !uniqueByUrl.has(slot.googleNewsUrl); return { slot, duplicate, candidateUrl: slot.googleNewsUrl && !duplicate ? candidateByUrl.get(slot.googleNewsUrl) ?? null : null }; });
  const uniqueTasks = tasks.filter((x) => x.candidateUrl);
  const inspected = await mapLimit(uniqueTasks, LIMITS.concurrency, async (task) => {
    if (clock() - started >= LIMITS.softStopMs) return null;
    try { return await inspect(task.candidateUrl); } catch { return null; }
  });
  if (inspected.some((result) => result?.readability === "network_attempt")) throw new Error("network_attempt_detected");
  const inspectionBySlot = new Map(uniqueTasks.map((task, i) => [`${task.slot.cellId}:${task.slot.slot}`, inspected[i]]));
  const observations = tasks.map(({ slot, duplicate, candidateUrl }) => {
    const result = inspectionBySlot.get(`${slot.cellId}:${slot.slot}`);
    const returnedRow = !!slot.googleNewsUrl;
    return { cellId: slot.cellId, slot: slot.slot,
      candidate: !returnedRow ? "not_returned" : duplicate ? "duplicate" : candidateUrl ? "resolved" : "unresolved",
      robots: result?.robots ?? "not_checked", fetch: result?.fetch ?? "not_attempted",
      readability: result?.readability ?? "not_attempted", structured: result?.structured ?? "not_attempted",
      prefix: result?.prefix ?? "unavailable", elapsed: result?.elapsed ?? "unavailable", dom: result?.dom ?? "unavailable", workerTime: result?.workerTime ?? "unavailable" };
  });
  return persistAggregateOnly(observations, (aggregate) => actor.pushData(aggregate));
}

export async function runActorSafely({ init = () => Actor.init(), execute = () => executeIteration10(), exit = () => Actor.exit(), getEnv = () => Actor.getEnv(), env = process.env, log = (aggregate) => Actor.log.info(`iteration10_complete ${JSON.stringify({ plannedRows: aggregate.plannedRows, returnedRows: aggregate.returnedRows, uniqueRows: aggregate.uniqueRows, eligibleRows: aggregate.eligibleRows })}`) } = {}) {
  let initialized = false, persisted = false;
  try { assertHostedRunGate({ actorEnv: getEnv(), processEnv: env }); await init(); initialized = true; const aggregate = await execute(); persisted = true; try { log(aggregate); } catch { /* aggregate already persisted */ } }
  catch { try { Actor.log.error("iteration10_failed"); } catch { /* no untrusted error text */ } }
  finally { if (initialized) try { await exit(); } catch { try { Actor.log.error("iteration10_exit_failed"); } catch { /* no retry */ } } }
  return persisted;
}

if (process.env.APIFY_IS_AT_HOME === "1" && !(await runActorSafely())) process.exitCode = 1;
