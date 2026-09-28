/* global AbortSignal:readonly, URL:readonly, TextDecoder:readonly, console:readonly, fetch:readonly, process:readonly */
import { Actor } from "apify";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const MAX_REDIRECTS = 5,
  MAX_BYTES = 262144,
  TIMEOUT_MS = 10000,
  CONCURRENCY = 4;
async function check(row) {
  const started = Date.now(),
    stages = [],
    signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = row.publisherUrlForCheck;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "issue-14-bounded-publisher-check/1.0",
        },
      });
      const loc = res.headers.get("location");
      stages.push({
        status: res.status,
        host: host(url),
        locationHost: loc ? host(new URL(loc, url).href) : null,
      });
      if (loc && [301, 302, 303, 307, 308].includes(res.status)) {
        await res.body?.cancel();
        if (hop === MAX_REDIRECTS)
          return {
            destinationHash: row.publisherUrlHash,
            outcome: "redirect_limit",
            stages,
            elapsedMs: Date.now() - started,
          };
        url = new URL(loc, url).href;
        continue;
      }
      const ct = res.headers.get("content-type") ?? "",
        len = Number(res.headers.get("content-length") || 0);
      let body = "",
        capped = len > MAX_BYTES;
      if (!capped && res.body && /text\/html|application\/xhtml\+xml/i.test(ct)) {
        const rd = res.body.getReader(),
          chunks = [];
        let size = 0;
        try {
          while (size < MAX_BYTES) {
            const { done, value } = await rd.read();
            if (done) break;
            const v = value.subarray(0, Math.min(value.length, MAX_BYTES - size));
            chunks.push(v);
            size += v.length;
            if (v.length < value.length) {
              capped = true;
              await rd.cancel();
              break;
            }
          }
          if (size === MAX_BYTES) {
            capped = true;
            await rd.cancel();
          }
        } finally {
          rd.releaseLock();
        }
        const b = new Uint8Array(size);
        let off = 0;
        for (const c of chunks) {
          b.set(c, off);
          off += c.length;
        }
        body = new TextDecoder().decode(b);
      } else await res.body?.cancel();
      const articleLike =
          /<article\b|itemtype=["'][^"']*schema\.org\/(?:News)?Article|["']og:type["']\s+content=["']article/i.test(
            body,
          ),
        finalHost = host(url),
        ok = res.status >= 200 && res.status < 300,
        html = /text\/html|application\/xhtml\+xml/i.test(ct),
        publisher = !!finalHost && !isGoogle(url);
      const outcome =
        ok && html && publisher && articleLike
          ? "http_article_like"
          : ok && html && publisher
            ? "http_html_no_article_marker"
            : !publisher
              ? "google_or_invalid_final_host"
              : !ok
                ? "http_error"
                : "non_html";
      return {
        destinationHash: row.publisherUrlHash,
        outcome,
        status: res.status,
        finalHost,
        finalUrlHash: hash(url),
        contentType: ct.split(";")[0],
        articleLikeMetadata: articleLike,
        bodyCapped: capped,
        stages,
        elapsedMs: Date.now() - started,
      };
    }
  } catch (e) {
    return {
      destinationHash: row.publisherUrlHash,
      outcome: e.name === "TimeoutError" ? "timeout" : "request_error",
      error: e.name === "TimeoutError" ? "timeout" : String(e.message).slice(0, 80),
      stages,
      elapsedMs: Date.now() - started,
    };
  }
  return {
    destinationHash: row.publisherUrlHash,
    outcome: "no_response",
    stages,
    elapsedMs: Date.now() - started,
  };
}
const counts = (xs) => xs.reduce((a, x) => ((a[x.outcome] = (a[x.outcome] || 0) + 1), a), {});
await Actor.init();
try {
  await import("./rpc-probe.mjs");
  const summary = JSON.parse(await readFile("./probe-results.json", "utf8"));
  const rows = summary.rpcProbe.rows;
  const verified = Array(rows.length);
  const checkStartedAtUtc = new Date().toISOString();
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const i = next++;
        if (i >= rows.length) return;
        verified[i] = rows[i].publisherUrlValid
          ? await check(rows[i])
          : {
              destinationHash: rows[i].publisherUrlHash ?? null,
              outcome: "skipped_invalid_rpc_destination",
            };
      }
    }),
  );
  summary.publisherHttpCheck = {
    startedAtUtc: checkStartedAtUtc,
    configuration: {
      method: "GET",
      maxRedirects: MAX_REDIRECTS,
      timeoutMs: TIMEOUT_MS,
      maxResponseBytes: MAX_BYTES,
      concurrency: CONCURRENCY,
      articleLikeHeuristic:
        "<article>, schema.org Article/NewsArticle itemtype, or og:type=article in first 256 KiB of HTML",
    },
    totalRows: verified.length,
    articleLikeMetadataRows: verified.filter((x) => x.outcome === "http_article_like").length,
    counts: counts(verified),
    rows: verified,
    completedAtUtc: new Date().toISOString(),
  };
  summary.publisherHttpCheck.completedAtUtc = new Date().toISOString();
  for (const r of rows) delete r.publisherUrlForCheck;
  await writeFile("./probe-results.json", JSON.stringify(summary, null, 2) + "\n");
  await Actor.pushData({ evidenceType: "issue14_hosted_rpc_and_publisher_check", ...summary });
  console.log(
    "ISSUE14_HOSTED_PROBE " +
      JSON.stringify({
        runtime: process.version,
        inputRows: summary.rows.length,
        rpcSuccesses: summary.rpcProbe.successes,
        rpcCounts: summary.rpcProbe.counts,
        publisherHttpCounts: summary.publisherHttpCheck.counts,
        articleLikeMetadataRows: summary.publisherHttpCheck.articleLikeMetadataRows,
        startedAt: summary.publisherHttpCheck.startedAtUtc,
        completedAt: summary.publisherHttpCheck.completedAtUtc,
      }),
  );
} finally {
  await Actor.exit();
}
