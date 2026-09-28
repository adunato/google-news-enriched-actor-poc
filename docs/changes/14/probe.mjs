/* global AbortSignal:readonly, Buffer:readonly, URL:readonly, TextDecoder:readonly, console:readonly, fetch:readonly, process:readonly, setTimeout:readonly */
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const QUERIES = ["world news", "politics", "business", "technology", "climate change"];
const EDITIONS = [
  { country: "GB", language: "en-GB" },
  { country: "US", language: "en-US" },
];
const LIMIT = 10;
const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const PAUSE_MS = 350;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const host = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};
const isGoogle = (value) => {
  const h = host(value);
  return (
    !!h &&
    (h === "google.com" ||
      h.endsWith(".google.com") ||
      h === "googleusercontent.com" ||
      h.endsWith(".googleusercontent.com"))
  );
};
const validPublisher = (value) => {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) && !isGoogle(u.href);
  } catch {
    return false;
  }
};
const urlHash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const parserHostFromSource = (x) => (typeof x === "object" && x ? host(x["@url"] ?? "") : null);

async function boundedText(response, maxBytes = MAX_BYTES) {
  const len = Number(response.headers.get("content-length") || 0);
  if (len > maxBytes) throw new Error("body_limit");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("body_limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function getFeed(query, edition) {
  const u = new URL("https://news.google.com/rss/search");
  u.searchParams.set("q", `${query} when:7d`);
  u.searchParams.set("hl", edition.language);
  u.searchParams.set("gl", edition.country);
  u.searchParams.set("ceid", `${edition.country}:${edition.language}`);
  const started = Date.now();
  const response = await fetch(u, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml",
      "user-agent": "issue-14-bounded-discovery/1.0",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
  const text = await boundedText(response, 2 * 1024 * 1024);
  if (!response.ok) throw new Error(`feed_http_${response.status}`);
  const doc = parser.parse(text);
  const items = doc?.rss?.channel?.item ?? [];
  return {
    records: (Array.isArray(items) ? items : [items]).slice(0, LIMIT).flatMap((item) => {
      const googleNewsUrl = typeof item?.link === "string" ? item.link.trim() : "";
      if (!googleNewsUrl) return [];
      return [
        {
          query,
          country: edition.country,
          language: edition.language,
          googleNewsUrl,
          articleIdHash: urlHash(googleNewsUrl),
          sourceName:
            typeof item.source === "string" ? item.source : (item.source?.["#text"] ?? null),
          sourceUrlHost: parserHostFromSource(item.source),
        },
      ];
    }),
    diagnostic: {
      status: response.status,
      finalHost: host(response.url),
      bytes: Buffer.byteLength(text),
      elapsedMs: Date.now() - started,
      itemCount: Array.isArray(items) ? items.length : items ? 1 : 0,
    },
  };
}

function decodeCandidates(raw) {
  const results = [];
  let current = raw;
  for (let depth = 0; depth < 5; depth++) {
    const m = current.match(/\/articles\/([^/?#]+)/);
    if (!m) break;
    let token = m[1];
    if (token.startsWith("CBMi")) token = token.slice(4);
    try {
      current = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    } catch {
      break;
    }
    for (const match of current.matchAll(/https?:\/\/[^\s"'<>\\]+/g)) {
      try {
        results.push(new URL(match[0].replace(/[),.]+$/, "")).href);
      } catch {
        // Ignore malformed candidate URLs.
      }
    }
  }
  return [...new Set(results)];
}

async function redirectProbe(record) {
  let url = record.googleNewsUrl;
  let status = null;
  const hops = [];
  let bytes = 0;
  let markerSet = [];
  const started = Date.now();
  try {
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 issue-14-bounded-discovery/1.0",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "manual",
      });
      status = response.status;
      bytes += Number(response.headers.get("content-length") || 0);
      const location = response.headers.get("location");
      hops.push({
        status,
        host: host(url),
        locationHost: location ? host(new URL(location, url).href) : null,
      });
      if (location && [301, 302, 303, 307, 308].includes(status)) {
        url = new URL(location, url).href;
        await response.body?.cancel();
        continue;
      }
      let body = "";
      if (response.body && status >= 200 && status < 400) {
        try {
          body = await boundedText(response);
          bytes += Buffer.byteLength(body);
        } catch (e) {
          markerSet.push(String(e.message));
        }
      }
      const markers = [
        "consent.google.com",
        "Before you continue to Google",
        "garturlres",
        "AF_initDataCallback",
        "<title>Google News</title>",
      ];
      markerSet.push(...markers.filter((m) => body.toLowerCase().includes(m.toLowerCase())));
      return {
        method: "http_get_redirect",
        articleIdHash: record.articleIdHash,
        status,
        hops,
        finalUrlHost: host(url),
        finalUrlHash: urlHash(url),
        validPublisherUrl: validPublisher(url),
        markers: [...new Set(markerSet)],
        bytes,
        elapsedMs: Date.now() - started,
      };
    }
    return {
      method: "http_get_redirect",
      articleIdHash: record.articleIdHash,
      status,
      hops,
      error: "redirect_limit",
      validPublisherUrl: false,
      bytes,
      elapsedMs: Date.now() - started,
    };
  } catch (e) {
    return {
      method: "http_get_redirect",
      articleIdHash: record.articleIdHash,
      status,
      hops,
      error: e.name === "TimeoutError" ? "timeout" : String(e.message),
      validPublisherUrl: false,
      bytes,
      elapsedMs: Date.now() - started,
    };
  }
}

const start = new Date().toISOString();
const records = [];
const feedDiagnostics = [];
for (const query of QUERIES)
  for (const edition of EDITIONS) {
    try {
      const result = await getFeed(query, edition);
      records.push(...result.records);
      feedDiagnostics.push({ query, country: edition.country, ...result.diagnostic });
    } catch (e) {
      feedDiagnostics.push({ query, country: edition.country, error: String(e.message) });
    }
    await sleep(PAUSE_MS);
  }
const redirects = [];
for (const record of records) {
  redirects.push(await redirectProbe(record));
  await sleep(PAUSE_MS);
}
const matrixCells = QUERIES.flatMap((query) =>
  EDITIONS.map((edition) => {
    const cell = records.filter((r) => r.query === query && r.country === edition.country);
    const probes = redirects.filter((p) => cell.some((r) => r.articleIdHash === p.articleIdHash));
    return {
      query,
      country: edition.country,
      rows: cell.length,
      httpGetPublisherSuccess: probes.filter((p) => p.validPublisherUrl).length,
      consentMarkerRows: probes.filter((p) => p.markers?.some((m) => /consent/i.test(m))).length,
      timeoutRows: probes.filter((p) => p.error === "timeout").length,
      errors: probes.filter((p) => p.error).length,
    };
  }),
);
const decode = records.map((r) => {
  const urls = decodeCandidates(r.googleNewsUrl);
  const valid = urls.filter(validPublisher);
  return {
    articleIdHash: r.articleIdHash,
    decodedCandidateCount: urls.length,
    validPublisherUrl: valid[0] ?? null,
    validCount: valid.length,
  };
});
const completed =
  matrixCells.length === QUERIES.length * EDITIONS.length &&
  matrixCells.every((c) => c.rows === LIMIT);
const rpcEvidence = {
  method: "marker_plus_rpc",
  executed: false,
  reason:
    "Prior Issue #4 evidence reports marker+RPC 0/100 after consent/interstitial; this probe did not replay an undocumented RPC request without a reproducible request contract or credentials. Page marker observations are included per HTTP row.",
};
const summary = {
  startedAtUtc: start,
  completedAtUtc: new Date().toISOString(),
  environment: {
    runtime: process.version,
    platform: process.platform,
    hostedApifyTested: false,
    hostedApifyReason:
      "Apify CLI unavailable/unauthenticated in supplied execution context; no hosted run credentials used.",
  },
  configuration: {
    queries: QUERIES,
    editions: EDITIONS,
    dateRange: "7d",
    perQueryLimit: LIMIT,
    dedupe: false,
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: 2 * 1024 * 1024,
    maxArticleResponseBytes: MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
    pauseBetweenRequestsMs: PAUSE_MS,
    userAgent: "issue-14-bounded-discovery/1.0",
  },
  complete: completed,
  totalRows: records.length,
  matrixCells,
  candidateCounts: {
    rssMetadataRows: records.filter((r) => r.sourceUrlHost).length,
    tokenDecodeValidPublisherRows: decode.filter((r) => r.validPublisherUrl).length,
    httpGetRedirectValidPublisherRows: redirects.filter((r) => r.validPublisherUrl).length,
    markerPlusRpc: rpcEvidence,
  },
  feedDiagnostics,
  redirectProbes: redirects,
  tokenDecodeProbes: decode,
  rows: records,
};
await mkdir(new URL("./", import.meta.url), { recursive: true });
await writeFile(
  new URL("./probe-results.json", import.meta.url),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    completed: summary.complete,
    totalRows: summary.totalRows,
    matrixCells,
    candidateCounts: summary.candidateCounts,
    startedAtUtc: start,
    completedAtUtc: summary.completedAtUtc,
  }),
);
