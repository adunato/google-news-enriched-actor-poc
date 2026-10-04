/* global AbortSignal:readonly, Buffer:readonly, URL:readonly, TextDecoder:readonly, console:readonly, fetch:readonly */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const MAX_BYTES = 2 * 1024 * 1024,
  MAX_REDIRECTS = 5,
  CONCURRENCY = 4,
  TIMEOUT_MS = 10000;
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const host = (s) => {
  try {
    return new URL(s).hostname.toLowerCase();
  } catch {
    return null;
  }
};
const isGoogle = (s) => {
  const h = host(s) ?? "";
  const serviceRoots = [
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
    serviceRoots.some((root) => h === root || h.endsWith(`.${root}`))
  );
};
const validPublisher = (s) => {
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) && !isGoogle(u.href);
  } catch {
    return false;
  }
};
async function readBounded(res) {
  const n = Number(res.headers.get("content-length") || 0);
  if (n > MAX_BYTES) {
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
      if (size > MAX_BYTES) {
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
function articleId(value) {
  try {
    const u = new URL(value);
    const ps = u.pathname.split("/").filter(Boolean),
      i = ps.findIndex((p) => p === "articles" || p === "read");
    return u.hostname === "news.google.com" && i >= 0 ? ps[i + 1] : null;
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
  const context = [
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
  const req = ["garturlreq", context, m.id, /^\d+$/.test(m.ts) ? Number(m.ts) : m.ts, m.sg];
  const env = [["Fbv4je", JSON.stringify(req), null, "0"]];
  return `f.req=${encodeURIComponent(JSON.stringify([env]))}`;
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
  const lines = body
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!lines.length) lines.push(body.trim());
  for (let x of lines) {
    if (/^\d+$/.test(x)) continue;
    if (x.startsWith(")]}'")) x = x.slice(4).trim();
    try {
      const r = findResult(JSON.parse(x));
      if (r) return r;
    } catch {
      // Ignore non-JSON RPC framing lines.
    }
  }
  const i = body.indexOf("\n\n");
  return i >= 0 ? parseRpc(body.slice(i + 2)) : null;
}
async function one(record) {
  const started = Date.now(),
    signal = AbortSignal.timeout(TIMEOUT_MS),
    stages = [];
  let url = record.googleNewsUrl;
  try {
    let pageRes = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const r = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 issue-14-bounded-discovery/1.0",
        },
        redirect: "manual",
        signal,
      });
      const loc = r.headers.get("location");
      stages.push({
        stage: "google_page",
        status: r.status,
        host: host(url),
        locationHost: loc ? host(new URL(loc, url).href) : null,
      });
      if (loc && [301, 302, 303, 307, 308].includes(r.status)) {
        await r.body?.cancel();
        url = new URL(loc, url).href;
        if (i === MAX_REDIRECTS)
          return {
            articleIdHash: record.articleIdHash,
            outcome: "redirect_limit",
            stages,
            elapsedMs: Date.now() - started,
          };
        if (!isGoogle(url)) {
          return {
            articleIdHash: record.articleIdHash,
            outcome: validPublisher(url) ? "success_direct_redirect" : "invalid_publisher_url",
            validPublisherUrl: validPublisher(url) ? url : null,
            stages,
            elapsedMs: Date.now() - started,
          };
        }
        continue;
      }
      pageRes = r;
      break;
    }
    if (!pageRes) throw Error("page_missing");
    const html = await readBounded(pageRes);
    stages.at(-1).bytes = Buffer.byteLength(html);
    const id = articleId(record.googleNewsUrl);
    const m = id ? markers(html, id) : null;
    stages.at(-1).markerSet = {
      articleIdMatched: !!m,
      articleIdMarker: /data-n-a-id\s*=/.test(html),
      timestampMarker: /data-n-a-ts\s*=/.test(html),
      signatureMarker: /data-n-a-sg\s*=/.test(html),
    };
    if (!m)
      return {
        articleIdHash: record.articleIdHash,
        outcome: "markers_missing_or_mismatch",
        stages,
        elapsedMs: Date.now() - started,
      };
    const rr = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        accept: "*/*",
        "user-agent": "Mozilla/5.0 issue-14-bounded-discovery/1.0",
      },
      body: rpcBody(m),
      signal,
    });
    const raw = await readBounded(rr);
    stages.push({
      stage: "decoder_rpc",
      status: rr.status,
      host: "news.google.com",
      contentType: rr.headers.get("content-type"),
      bytes: Buffer.byteLength(raw),
    });
    const publisher = parseRpc(raw);
    return {
      articleIdHash: record.articleIdHash,
      outcome: publisher
        ? validPublisher(publisher)
          ? "success_rpc"
          : "invalid_publisher_url"
        : rr.ok
          ? "rpc_result_missing"
          : "rpc_http_error",
      validPublisherUrl: publisher && validPublisher(publisher) ? publisher : null,
      publisherHost: publisher ? host(publisher) : null,
      stages,
      elapsedMs: Date.now() - started,
    };
  } catch (e) {
    const msg = e.name === "TimeoutError" ? "timeout" : String(e.message);
    return {
      articleIdHash: record.articleIdHash,
      outcome: msg,
      stages,
      elapsedMs: Date.now() - started,
    };
  }
}
const startedAtUtc = new Date().toISOString();
const file = new URL("./probe-results.json", import.meta.url),
  summary = JSON.parse(await readFile(file, "utf8"));
const rows = summary.rows;
const result = Array(rows.length);
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = next++;
      if (i >= rows.length) return;
      result[i] = await one(rows[i]);
    }
  }),
);
const counts = {};
for (const x of result) counts[x.outcome] = (counts[x.outcome] || 0) + 1;
summary.rpcProbe = {
  startedAtUtc,
  configuration: {
    timeoutMs: TIMEOUT_MS,
    responseLimitBytes: MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
    concurrency: CONCURRENCY,
  },
  totalRows: result.length,
  successes: result.filter((x) => x.validPublisherUrl).length,
  counts,
  rows: result.map(({ validPublisherUrl, ...x }) => ({
    ...x,
    publisherUrlValid: !!validPublisherUrl,
    ...(validPublisherUrl
      ? { publisherUrlHash: hash(validPublisherUrl), publisherUrl: validPublisherUrl }
      : {}),
  })),
};
summary.rpcProbe.completedAtUtc = new Date().toISOString();
await writeFile(file, JSON.stringify(summary, null, 2) + "\n");
console.log(
  JSON.stringify({
    startedAtUtc: summary.rpcProbe.startedAtUtc,
    completedAtUtc: summary.rpcProbe.completedAtUtc,
    totalRows: result.length,
    successes: summary.rpcProbe.successes,
    counts,
    byStageStatus: result
      .flatMap((x) => x.stages)
      .reduce((a, s) => {
        const k = `${s.stage}:${s.status}`;
        a[k] = (a[k] || 0) + 1;
        return a;
      }, {}),
  }),
);
