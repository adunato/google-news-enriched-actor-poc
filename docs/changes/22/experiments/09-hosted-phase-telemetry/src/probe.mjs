/* global AbortSignal:readonly, Buffer:readonly, URL:readonly, TextDecoder:readonly, console:readonly, fetch:readonly, setTimeout:readonly */
import { Actor } from "apify";
import { XMLParser } from "fast-xml-parser";
import { parseHTML } from "linkedom";
import process from "node:process";
import {
  boundedNodePrefix,
  requestPinnedPublicHttp,
  resolveRedirectUrl,
} from "./probe-network.mjs";
import { extractSerially } from "./worker-extraction.mjs";
import { observationsFromProbe, persistAggregateOnly } from "./run-core.mjs";
import { configureHtmlParser } from "./readability-proxy.mjs";

configureHtmlParser(parseHTML);

const QUERIES = ["world news", "politics", "business", "technology", "climate change"];
const EDITIONS = [
  { country: "GB", language: "en-GB" },
  { country: "US", language: "en-US" },
];
const LIMIT = 10;
const EXPECTED_ROWS = QUERIES.length * EDITIONS.length * LIMIT;
export const CONFIG = {
  concurrency: 4,
  timeoutMs: 10000,
  maxRedirects: 5,
  googleMaxBytes: 2097152,
  publisherMaxBytes: 262144,
  feedMaxBytes: 2097152,
  retryStatuses: [408, 425, 429],
  retry5xx: true,
  retryNetworkErrors: true,
  perHostDelayMs: 250,
};
export function mayFollowPublisherRedirect(redirects) {
  return Number.isSafeInteger(redirects) && redirects >= 0 && redirects < CONFIG.maxRedirects;
}
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});
const ua = "GoogleNewsAccessSpike/0.1 (+https://github.com/adunato/google-news-enriched-actor-poc)";
const hostNextRequestAt = new Map();
const hostQueues = new Map();
const host = (s) => {
  try {
    return new URL(s).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
};
const isGoogle = (s) => {
  const h = host(s) ?? "";
  const roots = [
    "googleusercontent.com",
    "gstatic.com",
    "googleapis.com",
    "googlevideo.com",
    "googleweblight.com",
    "g.co",
    "goo.gl",
    "1e100.net",
  ];
  return (
    /(^|\.)google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(h) ||
    roots.some((r) => h === r || h.endsWith(`.${r}`))
  );
};
const publisherUrl = (s) => {
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) && !isGoogle(u.href) ? u.href : null;
  } catch {
    return null;
  }
};
async function boundedText(res, maxBytes) {
  const len = Number(res.headers.get("content-length") || 0);
  if (len > maxBytes) {
    await res.body?.cancel();
    throw Error("body_limit");
  }
  if (!res.body) return "";
  const rd = res.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await rd.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await rd.cancel();
        throw Error("body_limit");
      }
      chunks.push(value);
    }
  } finally {
    rd.releaseLock();
  }
  const b = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    b.set(c, o);
    o += c.length;
  }
  return new TextDecoder().decode(b);
}
function val(x) {
  return typeof x === "string"
    ? x.trim()
    : typeof x === "object" && x
      ? String(x["#text"] ?? "").trim()
      : "";
}
function itemList(x) {
  return x == null ? [] : Array.isArray(x) ? x : [x];
}
async function fetchFeed(query, edition, cell) {
  const u = new URL("https://news.google.com/rss/search");
  u.searchParams.set("q", `${query} when:7d`);
  u.searchParams.set("hl", edition.language);
  u.searchParams.set("gl", edition.country);
  u.searchParams.set("ceid", `${edition.country}:${edition.language}`);
  const started = Date.now();
  const res = await fetch(u, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml",
      "user-agent": ua,
    },
    signal: AbortSignal.timeout(CONFIG.timeoutMs),
    redirect: "follow",
  });
  const xml = await boundedText(res, CONFIG.feedMaxBytes);
  if (!res.ok) throw Error(`feed_http_${res.status}`);
  const doc = parser.parse(xml),
    items = itemList(doc?.rss?.channel?.item);
  const rows = items.slice(0, LIMIT).flatMap((it, i) => {
    const url = val(it.link),
      title = val(it.title);
    if (!url || !title) return [];
    const cellId = `${cell}-${String(i + 1).padStart(2, "0")}`;
    return [
      {
        rowId: cellId,
        cell,
        googleNewsUrl: url,
      },
    ];
  });
  return {
    rows,
    diagnostic: {
      cell,
      status: res.status,
      finalHost: host(res.url),
      elapsedMs: Date.now() - started,
      itemCount: items.length,
      retainedCount: rows.length,
      feedBytes: Buffer.byteLength(xml),
    },
  };
}
function articleId(value) {
  try {
    const u = new URL(value),
      p = u.pathname.split("/").filter(Boolean),
      i = p.findIndex((x) => x === "articles" || x === "read");
    return u.hostname === "news.google.com" && i >= 0 ? p[i + 1] : null;
  } catch {
    return null;
  }
}
function markers(html, id) {
  const re = /<[^>]*\bdata-n-a-id\s*=\s*(["'])(.*?)\1[^>]*>/gis;
  for (const m of html.matchAll(re)) {
    const tag = m[0],
      got = m[2],
      ts = tag.match(/\bdata-n-a-ts\s*=\s*(["'])(.*?)\1/i)?.[2],
      sg = tag.match(/\bdata-n-a-sg\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (got === id && ts && sg) return { id: got, ts, sg };
  }
  return null;
}
function rpcBody(m) {
  const c = [
    ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
    "X",
    "X",
    1,
    [1, 1, 1],
    1,
    1,
    null,
    0,
    0,
    null,
    0,
  ];
  const req = ["garturlreq", c, m.id, /^\d+$/.test(m.ts) ? Number(m.ts) : m.ts, m.sg];
  return `f.req=${encodeURIComponent(JSON.stringify([[["Fbv4je", JSON.stringify(req), null, "0"]]]))}`;
}
function findResult(v) {
  if (typeof v === "string") {
    try {
      return findResult(JSON.parse(v));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(v)) return null;
  if (v[0] === "garturlres" && typeof v[1] === "string") return v[1];
  for (const x of v) {
    const r = findResult(x);
    if (r) return r;
  }
  return null;
}
function parseRpc(body) {
  for (let x of body
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (/^\d+$/.test(x)) continue;
    if (x.startsWith(")]}'")) x = x.slice(4).trim();
    try {
      const r = findResult(JSON.parse(x));
      if (r) return r;
    } catch {
      // Ignore title values that cannot be normalized.
    }
  }
  const i = body.indexOf("\n\n");
  return i >= 0 ? parseRpc(body.slice(i + 2)) : null;
}
async function resolve(row) {
  const started = Date.now(),
    stages = [];
  let url = row.googleNewsUrl;
  try {
    let pageRes = null;
    for (let i = 0; i <= CONFIG.maxRedirects; i++) {
      await paceHost(url);
      const res = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": ua,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(CONFIG.timeoutMs),
      });
      const loc = res.headers.get("location");
      stages.push({
        stage: "google_page",
        status: res.status,
        host: host(url),
        locationHost: loc ? host(new URL(loc, url).href) : null,
      });
      if (loc && [301, 302, 303, 307, 308].includes(res.status)) {
        await res.body?.cancel();
        url = new URL(loc, url).href;
        if (i === CONFIG.maxRedirects)
          return { candidateStatus: "redirect_limit", stages, elapsedMs: Date.now() - started };
        if (!isGoogle(url))
          return {
            candidateStatus: publisherUrl(url) ? "direct_redirect_candidate" : "invalid_candidate",
            candidateUrl: publisherUrl(url),
            stages,
            elapsedMs: Date.now() - started,
          };
        continue;
      }
      pageRes = res;
      break;
    }
    if (!pageRes) throw Error("google_page_missing");
    const html = await boundedText(pageRes, CONFIG.googleMaxBytes),
      id = articleId(row.googleNewsUrl),
      m = id ? markers(html, id) : null;
    stages.at(-1).bytes = Buffer.byteLength(html);
    stages.at(-1).articleIdMatched = !!m;
    if (!m)
      return {
        candidateStatus: "markers_missing_or_mismatch",
        stages,
        elapsedMs: Date.now() - started,
      };
    const rpcUrl = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
    await paceHost(rpcUrl);
    const rr = await fetch(rpcUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        accept: "*/*",
        "user-agent": ua,
      },
      body: rpcBody(m),
      signal: AbortSignal.timeout(CONFIG.timeoutMs),
    });
    const raw = await boundedText(rr, CONFIG.googleMaxBytes),
      candidate = parseRpc(raw);
    stages.push({
      stage: "decoder_rpc",
      status: rr.status,
      host: "news.google.com",
      bytes: Buffer.byteLength(raw),
    });
    const checked = publisherUrl(candidate ?? "");
    return {
      candidateStatus: checked
        ? "success_rpc"
        : candidate
          ? "invalid_candidate"
          : rr.ok
            ? "rpc_result_missing"
            : "rpc_http_error",
      candidateUrl: checked,
      stages,
      elapsedMs: Date.now() - started,
    };
  } catch (e) {
    return {
      candidateStatus: e.name === "TimeoutError" ? "timeout" : "resolver_error",
      stages,
      elapsedMs: Date.now() - started,
    };
  }
}
const retryable = (status, error) =>
  CONFIG.retryStatuses.includes(status) ||
  (status >= 500 && status <= 599) ||
  (!!error &&
    CONFIG.retryNetworkErrors &&
    (error.name === "TimeoutError" || error.name === "TypeError"));
async function paceHost(value) {
  const key = host(value);
  const prior = hostQueues.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  hostQueues.set(key, current);
  await prior.catch(() => {});
  const delay = (hostNextRequestAt.get(key) ?? 0) - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  hostNextRequestAt.set(key, Date.now() + CONFIG.perHostDelayMs);
  release();
}
export function robotsAllows(text, pathname) {
  const groups = [];
  let agents = [],
    rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const sep = line.indexOf(":");
    if (!line || sep < 0) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (key === "user-agent") {
      if (rules.length) {
        groups.push({ agents, rules });
        agents = [];
        rules = [];
      }
      agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && agents.length && value) {
      rules.push({ allow: key === "allow", path: value });
    }
  }
  if (agents.length) groups.push({ agents, rules });
  const applicable = groups.filter(
    (g) =>
      g.agents.includes("*") || g.agents.some((a) => a !== "*" && ua.toLowerCase().includes(a)),
  );
  const matching = applicable
    .flatMap((g) => g.rules)
    .filter((r) => pathname.startsWith(r.path))
    .sort((a, b) => b.path.length - a.path.length);
  return !matching.length || matching[0].allow;
}
const CHALLENGE_PATTERN = /captcha|verify (?:that )?you are human|are you a human|cf-chl-|cloudflare.{0,30}challenge|access denied|automated requests/i;
export async function inspectHtmlForIteration9(html, url) {
  const challengeLike = CHALLENGE_PATTERN.test(html);
  let extraction;
  try {
    extraction = await extractSerially(html, url);
  } catch {
    extraction = { status: "worker_error", terminalPhase: "startup", proxyStatus: "error", timing: { startupMs: null, importMs: null, extractMs: null, resultDeliveryMs: null, workerExitMs: null } };
  }
  return { challengeLike, extraction };
}
const robotsCache = new Map();
async function robotsSignal(value) {
  const u = new URL(value),
    key = u.origin;
  if (!robotsCache.has(key))
    robotsCache.set(
      key,
      (async () => {
        const robotsUrl = `${u.origin}/robots.txt`;
        await paceHost(robotsUrl);
        const opened = await requestPinnedPublicHttp(robotsUrl, {
          headers: { accept: "text/plain", "accept-encoding": "identity", "user-agent": ua },
          timeoutMs: CONFIG.timeoutMs,
        });
        if (!opened.ok) return { signal: "unavailable", status: null };
        try {
          const res = opened.response;
          if (res.statusCode === 404) return { signal: "not_found", status: 404 };
          if (res.statusCode < 200 || res.statusCode >= 300)
            return { signal: "unavailable", status: res.statusCode };
          const prefix = await boundedNodePrefix(res, CONFIG.publisherMaxBytes);
          if (prefix.truncated) return { signal: "truncated_unknown", status: res.statusCode };
          return { text: prefix.text, signal: "readable", status: res.statusCode };
        } finally {
          opened.close();
        }
      })(),
    );
  const cached = await robotsCache.get(key);
  if (cached.signal !== "readable") return cached;
  return {
    signal: robotsAllows(cached.text, u.pathname) ? "allowed" : "disallowed",
    status: cached.status,
  };
}
async function getDestination(row, candidate) {
  const publisherStartedAt = Date.now();
  const stages = [];
  let url = candidate,
    redirects = 0,
    response = null,
    body = "",
    bodyCapped = false,
    error = null,
    retryPerformed = false;
  let status = null,
    contentType = "";
  let lastRobots = { signal: "unknown", status: null };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const robots = await robotsSignal(url);
      lastRobots = robots;
      if (["disallowed", "unavailable", "truncated_unknown"].includes(robots.signal))
        return {
          accessStatus: `skipped_robots_${robots.signal}`,
          httpStatus: null,
          contentType: null,
          responseBytes: 0,
          responsePrefixCapped: false,
          articleLike: false,
          challengeLike: false,
          sourceHostMatch: null,
          publisherHost: host(url),
          pageTitleSignals: [],
          identityStatus: "unverifiable",
          identityReason: `robots_${robots.signal}`,
          identityMatchedSignals: [],
          retryUsed: false,
          retryReason: null,
          stages: [],
          robotsSignal: robots.signal,
          robotsStatus: robots.status,
          publisherElapsedMs: Date.now() - publisherStartedAt,
        };
      await paceHost(url);
      const opened = await requestPinnedPublicHttp(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
          "user-agent": ua,
        },
        timeoutMs: CONFIG.timeoutMs,
      });
      if (!opened.ok)
        return {
          accessStatus: "unsafe_destination",
          httpStatus: null,
          contentType: null,
          responseBytes: 0,
          responsePrefixCapped: false,
          articleLike: false,
          sourceHostMatch: null,
          publisherHost: host(url),
          pageTitleSignals: [],
          identityStatus: "unverifiable",
          identityReason: opened.reason,
          identityMatchedSignals: [],
          retryUsed: false,
          retryReason: null,
          stages,
        };
      const res = opened.response;
      try {
        const loc = res.headers.location;
        stages.push({
          attempt: retryPerformed ? 2 : 1,
          status: res.statusCode,
          host: opened.target.hostname,
          locationHost: loc ? host(resolveRedirectUrl(loc, url)) : null,
        });
        status = res.statusCode;
        contentType = String(res.headers["content-type"] ?? "");
        if (loc && [301, 302, 303, 307, 308].includes(status)) {
          if (!mayFollowPublisherRedirect(redirects))
            return { accessStatus: "redirect_limit", httpStatus: status, stages };
          const next = resolveRedirectUrl(loc, url);
          if (!next)
            return {
              accessStatus: "unsafe_destination",
              httpStatus: null,
              identityStatus: "unverifiable",
              identityReason: "invalid_redirect_url",
              retryUsed: false,
              retryReason: null,
              stages,
            };
          redirects++;
          url = next;
          attempt--;
          continue;
        }
        response = res;
        if (
          status >= 200 &&
          status < 300 &&
          /text\/html|application\/xhtml\+xml/i.test(contentType)
        ) {
          const prefix = await boundedNodePrefix(res, CONFIG.publisherMaxBytes);
          body = prefix.text;
          bodyCapped = prefix.truncated;
        }
        if (!retryPerformed && retryable(status, null)) {
          response = null;
          retryPerformed = true;
          continue;
        }
        break;
      } finally {
        opened.close();
      }
    } catch (e) {
      error = e.name === "TimeoutError" ? "timeout" : "network_error";
      stages.push({ attempt: retryPerformed ? 2 : 1, error });
      if (!retryPerformed && retryable(null, e)) {
        retryPerformed = true;
        continue;
      }
      break;
    }
  }
  const html =
    !!response &&
    status >= 200 &&
    status < 300 &&
    /text\/html|application\/xhtml\+xml/i.test(contentType);
  const inspectedHtml = html
    ? await inspectHtmlForIteration9(body, url)
    : { challengeLike: false, extraction: { status: "not_attempted", wordCount: 0, segmentCount: 0, fivegramUniqueness: null, extractMs: null } };
  const challengeLike = inspectedHtml.challengeLike;
  const extraction = inspectedHtml.extraction;
  const retryUsed = retryPerformed;
  return {
    accessStatus:
      error && !status
        ? error
        : !response
          ? "no_response"
          : status >= 200 && status < 300 && html
            ? "http_2xx_html"
            : `http_${status ?? "unknown"}`,
    httpStatus: status,
    contentType: contentType.slice(0, 100) || null,
    responseBytes: body ? Buffer.byteLength(body) : 0,
    responsePrefixCapped: bodyCapped,
    challengeLike,
    extraction,
    retryUsed,
    retryReason: retryUsed
      ? stages[0]?.status
        ? `http_${stages[0].status}`
        : (stages[0]?.error ?? null)
      : null,
    stages,
    robotsSignal: lastRobots.signal,
    robotsStatus: lastRobots.status,
    publisherElapsedMs: Date.now() - publisherStartedAt,
  };
}
async function parallelMap(rows, fn) {
  const out = Array(rows.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONFIG.concurrency }, async () => {
      while (true) {
        const i = next++;
        if (i >= rows.length) return;
        out[i] = await fn(rows[i], i);
      }
    }),
  );
  return out;
}
async function freshMatrix() {
  const startedAtUtc = new Date().toISOString(),
    rows = [],
    feeds = [];
  for (let qi = 0; qi < QUERIES.length; qi++)
    for (let ei = 0; ei < EDITIONS.length; ei++) {
      const cell = `q${qi + 1}-${EDITIONS[ei].country.toLowerCase()}`;
      const r = await fetchFeed(QUERIES[qi], EDITIONS[ei], cell);
      rows.push(...r.rows);
      feeds.push(r.diagnostic);
    }
  const completedAtUtc = new Date().toISOString();
  const manifest = {
    issue: 22,
    startedAtUtc,
    completedAtUtc,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    configuration: {
      queries: QUERIES,
      editions: EDITIONS,
      dateRange: "7d",
      perCellLimit: LIMIT,
      dedupe: false,
      firstFeedItems: true,
      feedTimeoutMs: CONFIG.timeoutMs,
      feedResponseLimitBytes: CONFIG.feedMaxBytes,
    },
    feedDiagnostics: feeds,
    complete: rows.length === EXPECTED_ROWS,
    matrixCells: feeds.length,
    totalRows: rows.length,
    rows,
  };
  if (rows.length !== EXPECTED_ROWS)
    throw Error("incomplete_fresh_matrix");
  return manifest;
}
export async function executeIteration9({
  actor = Actor,
  acquireMatrix = freshMatrix,
  resolveRow = resolve,
  probeDestination = getDestination,
} = {}) {
  const manifest = await acquireMatrix();
  if (!manifest || manifest.rows?.length !== EXPECTED_ROWS || manifest.feedDiagnostics?.length !== 10)
    throw new Error("incomplete_100_row_matrix");
  const resolutions = await parallelMap(manifest.rows, resolveRow);
  if (resolutions.length !== EXPECTED_ROWS) throw new Error("incomplete_resolution_stage");
  const checkedRows = await parallelMap(
    manifest.rows.flatMap((row, index) => resolutions[index]?.candidateUrl ? [{ row, candidateUrl: resolutions[index].candidateUrl }] : []),
    async ({ row, candidateUrl }) => {
      try {
        return { rowId: row.rowId, ...(await probeDestination(row, candidateUrl)) };
      } catch {
        return {
          rowId: row.rowId,
          accessStatus: "row_probe_error",
          robotsSignal: "unavailable",
          httpStatus: null,
          responseBytes: 0,
          challengeLike: null,
          extraction: { status: "worker_error", terminalPhase: "startup", proxyStatus: "error", timing: { startupMs: null, importMs: null, extractMs: null, resultDeliveryMs: null, workerExitMs: null } },
        };
      }
    },
  );
  const observations = observationsFromProbe(manifest.rows, resolutions, checkedRows);
  return persistAggregateOnly(observations, (aggregate) => actor.pushData(aggregate));
}

export async function runActorSafely({
  init = () => Actor.init(),
  execute = () => executeIteration9(),
  exit = () => Actor.exit(),
  logError = (message) => console.error(message),
  logComplete = (aggregate) => Actor.log.info(`iteration9_complete ${JSON.stringify({
    denominator: aggregate.denominator,
    eligibleRows: aggregate.eligibleRows,
    completedRows: aggregate.cells.reduce((total, cell) => total + cell.outcome.accepted_proxy + cell.outcome.quality_rejected + cell.outcome.empty + cell.outcome.oversize + cell.outcome.too_short, 0),
    timeoutRows: aggregate.cells.reduce((total, cell) => total + cell.outcome.timeout + cell.outcome.worker_exit_timeout, 0),
  })}`),
} = {}) {
  let initialized = false;
  let succeeded = false;
  try {
    await init();
    initialized = true;
    const aggregate = await execute();
    succeeded = true;
    try { logComplete(aggregate); } catch { /* the aggregate is already persisted; logging cannot make it retryable */ }
  } catch {
    logError("iteration9_failed");
  } finally {
    if (initialized) {
      try {
        await exit();
      } catch {
        logError("iteration9_exit_failed");
      }
    }
  }
  return succeeded;
}

if (process.env.APIFY_IS_AT_HOME === "1" && !(await runActorSafely())) {
  process.exitCode = 1;
}
