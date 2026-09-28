/* global AbortSignal:readonly, Buffer:readonly, URL:readonly, TextDecoder:readonly, console:readonly, fetch:readonly */
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import {
  boundedNodePrefix,
  requestPinnedPublicHttp,
  resolveRedirectUrl,
} from "./probe-network.mjs";
import { classifyIdentity, cleanTitle } from "./probe-title.mjs";

const QUERIES = ["world news", "politics", "business", "technology", "climate change"];
const EDITIONS = [
  { country: "GB", language: "en-GB" },
  { country: "US", language: "en-US" },
];
const LIMIT = 10;
const CONFIG = {
  concurrency: 4,
  timeoutMs: 10000,
  maxRedirects: 5,
  googleMaxBytes: 2097152,
  publisherMaxBytes: 262144,
  feedMaxBytes: 2097152,
  retryStatuses: [408, 425, 429],
  retry5xx: true,
  retryNetworkErrors: true,
};
const OUT = new URL("./", import.meta.url);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});
const sha = (s) => createHash("sha256").update(s).digest("hex");
const shortHash = (s) => sha(s).slice(0, 16);
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
function rssTitle(title, source) {
  const t = val(title),
    s = val(source);
  if (!t || !s) return t;
  const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return t.replace(new RegExp(`\\s+[-–—|:]\\s+${escaped}\\s*$`, "i"), "").trim();
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
      "user-agent": "issue-18-bounded-discovery/1.0",
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
      title = val(it.title),
      sourceName = val(it.source),
      sourceHost = host(it.source?.["@url"] ?? "");
    if (!url || !title) return [];
    const cellId = `${cell}-${String(i + 1).padStart(2, "0")}`;
    const normalizedExpectedTitle = rssTitle(title, sourceName);
    return [
      {
        rowId: cellId,
        cell,
        query,
        country: edition.country,
        language: edition.language,
        position: i + 1,
        title,
        expectedTitle: normalizedExpectedTitle,
        sourceName: sourceName || null,
        sourceHost,
        googleNewsUrl: url,
        googleNewsUrlHash: sha(url),
        articleIdHash: shortHash(url),
        capturedAtUtc: new Date().toISOString(),
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
      const res = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 issue-18-bounded-discovery/1.0",
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
    const rr = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        accept: "*/*",
        "user-agent": "Mozilla/5.0 issue-18-bounded-discovery/1.0",
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
      candidateStatus: e.name === "TimeoutError" ? "timeout" : String(e.message || e),
      stages,
      elapsedMs: Date.now() - started,
    };
  }
}
function titleSignals(html) {
  const out = [];
  const add = (kind, raw) => {
    try {
      const title = cleanTitle(raw ?? "").slice(0, 512);
      if (title && !out.some((x) => x.kind === kind && x.value === title))
        out.push({ kind, value: title });
    } catch {
      // Ignore malformed JSON-LD blocks and retain any other title signals.
    }
  };
  for (const m of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)) add("h1", m[1]);
  for (const m of html.matchAll(/<meta\b[^>]*property\s*=\s*(["'])og:title\1[^>]*>/gi)) {
    const content = m[0].match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
    add("og:title", content);
  }
  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    try {
      const parsed = JSON.parse(m[2]);
      const scan = (x) => {
        if (Array.isArray(x)) x.forEach(scan);
        else if (x && typeof x === "object") {
          if (typeof x.headline === "string") add("jsonld:headline", x.headline);
          if (x["@graph"]) scan(x["@graph"]);
        }
      };
      scan(parsed);
    } catch {
      // Ignore non-JSON RPC lines and continue scanning the response.
    }
  }
  return out.filter((x) => x.value.length <= 512).slice(0, 12);
}
function sourceHostMatch(sourceHost, destHost) {
  if (!sourceHost || !destHost) return null;
  return (
    sourceHost === destHost ||
    sourceHost.endsWith(`.${destHost}`) ||
    destHost.endsWith(`.${sourceHost}`)
  );
}
const retryable = (status, error) =>
  CONFIG.retryStatuses.includes(status) ||
  (status >= 500 && status <= 599) ||
  (!!error &&
    CONFIG.retryNetworkErrors &&
    (error.name === "TimeoutError" || error.name === "TypeError"));
async function getDestination(row, candidate) {
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
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const opened = await requestPinnedPublicHttp(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
          "user-agent": "Mozilla/5.0 issue-18-bounded-discovery/1.0",
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
          publisherUrlHash: sha(candidate),
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
          if (redirects >= CONFIG.maxRedirects)
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
      error = e.name === "TimeoutError" ? "timeout" : String(e.message || e);
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
  const titles = html ? titleSignals(body) : [];
  const markersArticle =
    html &&
    (/<article\b/i.test(body) ||
      /itemtype\s*=\s*["'][^"']*schema\.org\/(?:NewsArticle|Article)/i.test(body) ||
      /<meta\b[^>]*property\s*=\s*["']og:type["'][^>]*content\s*=\s*["']article["']/i.test(body));
  const identity = classifyIdentity(row.expectedTitle, row.sourceName, titles, bodyCapped);
  const retryUsed = retryPerformed;
  return {
    accessStatus:
      error && !status
        ? error
        : !response
          ? "no_response"
          : status === 200 && html
            ? "http_200_html"
            : `http_${status ?? "unknown"}`,
    httpStatus: status,
    contentType: contentType.slice(0, 100) || null,
    responseBytes: body ? Buffer.byteLength(body) : 0,
    responsePrefixCapped: bodyCapped,
    articleLike: !!markersArticle,
    sourceHostMatch: sourceHostMatch(row.sourceHost, host(url)),
    publisherHost: host(url),
    publisherUrlHash: sha(candidate),
    pageTitleSignals: titles.map((t) => ({ kind: t.kind, value: t.value })),
    identityStatus: identity.status,
    identityReason: identity.reason,
    identityMatchedSignals: identity.matchedSignals,
    retryUsed,
    retryReason: retryUsed
      ? stages[0]?.status
        ? `http_${stages[0].status}`
        : (stages[0]?.error ?? null)
      : null,
    stages,
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
        out[i] = await fn(rows[i]);
      }
    }),
  );
  return out;
}
function countBy(rows, selector) {
  const out = {};
  for (const r of rows) {
    const k = selector(r) ?? "null";
    out[k] = (out[k] ?? 0) + 1;
  }
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
    issue: 18,
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
    complete: rows.length === 100,
    matrixCells: feeds.length,
    totalRows: rows.length,
    rows,
  };
  const hash = sha(JSON.stringify(rows));
  manifest.rowsSha256 = hash;
  await writeFile(new URL("input-manifest.json", OUT), JSON.stringify(manifest, null, 2) + "\n");
  if (rows.length !== 100)
    throw Error(
      `Fresh matrix contained ${rows.length}/100 rows; manifest retained but probe stopped.`,
    );
  return manifest;
}
async function run() {
  await mkdir(OUT, { recursive: true });
  let manifest;
  try {
    if (process.argv.includes("--refresh")) throw Error("refresh_requested");
    manifest = JSON.parse(await readFile(new URL("input-manifest.json", OUT), "utf8"));
  } catch {
    manifest = await freshMatrix();
  }
  const runStartedAtUtc = new Date().toISOString();
  const resolved = await parallelMap(manifest.rows, resolve);
  const outcomes = manifest.rows.map((row, i) => {
    const { candidateUrl, ...evidence } = resolved[i];
    return {
      rowId: row.rowId,
      cell: row.cell,
      query: row.query,
      country: row.country,
      language: row.language,
      position: row.position,
      articleIdHash: row.articleIdHash,
      googleNewsUrlHash: row.googleNewsUrlHash,
      sourceName: row.sourceName,
      sourceHost: row.sourceHost,
      expectedTitle: row.expectedTitle,
      ...evidence,
      ...(candidateUrl
        ? { candidateUrlHash: sha(candidateUrl), publisherHost: host(candidateUrl) }
        : {}),
    };
  });
  const withCandidate = outcomes.filter((_, i) => resolved[i].candidateUrl);
  const checked = await parallelMap(withCandidate, async (r) => {
    try {
      return {
        rowId: r.rowId,
        ...(await getDestination(
          r,
          resolved[manifest.rows.findIndex((x) => x.rowId === r.rowId)].candidateUrl,
        )),
      };
    } catch (e) {
      return {
        rowId: r.rowId,
        accessStatus: "row_probe_error",
        identityStatus: "unverifiable",
        identityReason: e.name === "RangeError" ? "invalid_title_scalar" : "row_probe_error",
        retryUsed: false,
        retryReason: null,
        stages: [],
      };
    }
  });
  const checkById = new Map(checked.map((x) => [x.rowId, x]));
  for (const row of outcomes) {
    const c = checkById.get(row.rowId);
    if (c) Object.assign(row, c);
  }
  const perCell = {};
  for (const cell of manifest.feedDiagnostics.map((x) => x.cell)) {
    const rs = outcomes.filter((x) => x.cell === cell);
    perCell[cell] = {
      rows: rs.length,
      candidateOutcomes: countBy(rs, (x) => x.candidateStatus),
      access: countBy(rs, (x) => x.accessStatus),
      articleLike: rs.filter((x) => x.articleLike).length,
      identity: countBy(rs, (x) => x.identityStatus),
      confirmedValid: rs.filter(
        (x) =>
          x.identityStatus === "confirmed_match" &&
          x.articleLike &&
          x.accessStatus === "http_200_html",
      ).length,
    };
  }
  const result = {
    evidenceType: "issue18_local_http_identity_probe",
    startedAtUtc: runStartedAtUtc,
    completedAtUtc: new Date().toISOString(),
    manifestCapturedAtUtc: manifest.completedAtUtc,
    manifestSha256: sha(JSON.stringify(manifest)),
    environment: {
      ...manifest.environment,
      probeRuntime: process.version,
      probePlatform: process.platform,
      probeArch: process.arch,
    },
    configuration: {
      ...CONFIG,
      identityRule:
        "exact NFKC/case/punctuation/space normalized title equality on h1, og:title, or JSON-LD headline; mismatch requires two independent signals agreeing; conflicting or single nonmatching signals are unverifiable",
      destinationPolicy:
        "each publisher URL and redirect is resolved and its full A/AAAA set classified as globally routable; the validated addresses are pinned to the HTTP(S) connection; redirects are manual",
    },
    totalRows: outcomes.length,
    complete: outcomes.length === 100,
    candidateCounts: countBy(outcomes, (x) => x.candidateStatus),
    accessCounts: countBy(outcomes, (x) => x.accessStatus),
    identityCounts: countBy(outcomes, (x) => x.identityStatus ?? "no_candidate"),
    articleLikeCount: outcomes.filter((x) => x.articleLike).length,
    strictConfirmedSuccesses: outcomes.filter(
      (x) =>
        x.identityStatus === "confirmed_match" &&
        x.articleLike &&
        x.accessStatus === "http_200_html",
    ).length,
    threshold: 95,
    retryCount: outcomes.filter((x) => x.retryUsed).length,
    noRetryBaselineAccessCounts: countBy(outcomes, (x) => x.accessStatus),
    perCell,
    rows: outcomes,
  };
  await writeFile(new URL("local-results.json", OUT), JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      startedAtUtc: result.startedAtUtc,
      completedAtUtc: result.completedAtUtc,
      totalRows: result.totalRows,
      candidateCounts: result.candidateCounts,
      accessCounts: result.accessCounts,
      identityCounts: result.identityCounts,
      articleLikeCount: result.articleLikeCount,
      strictConfirmedSuccesses: result.strictConfirmedSuccesses,
      perCell: result.perCell,
      manifestSha256: result.manifestSha256,
    }),
  );
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
