/* global AbortSignal:readonly, URL:readonly, TextDecoder:readonly, console:readonly, fetch:readonly, process:readonly, setTimeout:readonly */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Actor } from "apify";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const PAUSE_MS = 350;
const USER_AGENT = "Mozilla/5.0 issue-14-bounded-discovery/1.0";
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const host = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

function articleId(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.findIndex((part) => part === "articles" || part === "read");
    return url.hostname === "news.google.com" && index >= 0 ? parts[index + 1] : null;
  } catch {
    return null;
  }
}

function matchingMarkers(html, expectedId) {
  const marker = /<[^>]*\bdata-n-a-id\s*=\s*(["'])(.*?)\1[^>]*>/gis;
  for (const match of html.matchAll(marker)) {
    const tag = match[0];
    const id = match[2];
    const timestamp = tag.match(/\bdata-n-a-ts\s*=\s*(["'])(.*?)\1/i)?.[2];
    const signature = tag.match(/\bdata-n-a-sg\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (id === expectedId && timestamp && signature) {
      return { articleIdMatched: true, timestampMarker: true, signatureMarker: true };
    }
  }
  return {
    articleIdMatched: false,
    timestampMarker: /\bdata-n-a-ts\s*=/.test(html),
    signatureMarker: /\bdata-n-a-sg\s*=/.test(html),
  };
}

function cookieNames(response) {
  if (typeof response.headers.getSetCookie !== "function") return [];
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split("=", 1)[0].trim())
    .filter(Boolean);
}

async function readBoundedHtml(response) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) {
    await response.body?.cancel();
    return { body: "", bytes: 0, truncated: true };
  }
  if (!response.body) return { body: "", bytes: 0, truncated: false };

  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  try {
    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.byteLength, MAX_BYTES - bytes);
      chunks.push(value.subarray(0, take));
      bytes += take;
      if (take < value.byteLength) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
    if (bytes === MAX_BYTES) {
      truncated = true;
      await reader.cancel();
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(buffer), bytes, truncated };
}

async function check(control, sequencePosition, repeat, requestCounter) {
  const started = Date.now();
  const googleArticleId = articleId(control.googleNewsUrl);
  const redirects = [];
  const setCookieNames = new Set();
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let currentUrl = control.googleNewsUrl;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const fromHost = host(currentUrl);
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": USER_AGENT,
        },
      });
      requestCounter.count += 1;
      const cookieNamesOnResponse = cookieNames(response);
      for (const name of cookieNamesOnResponse) setCookieNames.add(name);
      const location = response.headers.get("location");
      const destination = location ? new URL(location, currentUrl) : null;
      const toHost = destination ? host(destination.href) : null;
      const sanitizedDestinationUrl = destination
        ? `${destination.origin}${destination.pathname}`
        : null;

      if (location && REDIRECTS.has(response.status)) {
        redirects.push({
          requestNumber: requestCounter.count,
          status: response.status,
          fromHost,
          toHost,
          sanitizedDestinationUrl,
          setCookieHeaderPresent: response.headers.has("set-cookie"),
          setCookieNames: cookieNamesOnResponse,
          cookieHeaderSent: false,
        });
        await response.body?.cancel();
        if (hop === MAX_REDIRECTS) {
          return {
            rowId: control.rowId,
            sequencePosition,
            repeat,
            outcome: "redirect_limit",
            redirects,
            finalStatus: null,
            finalHost: null,
            resolverReady: false,
            elapsedMs: Date.now() - started,
          };
        }
        const destination = new URL(location, currentUrl);
        if (destination.protocol !== "https:") {
          return {
            rowId: control.rowId,
            sequencePosition,
            repeat,
            outcome: "non_https_redirect",
            redirects,
            finalStatus: response.status,
            finalHost: toHost,
            resolverReady: false,
            elapsedMs: Date.now() - started,
          };
        }
        currentUrl = destination.href;
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType);
      const measured = isHtml
        ? await readBoundedHtml(response)
        : (await response.body?.cancel(), { body: "", bytes: 0, truncated: false });
      const markerState = matchingMarkers(measured.body, googleArticleId);
      const resolverReady =
        response.status >= 200 &&
        response.status < 300 &&
        isHtml &&
        host(currentUrl) === "news.google.com" &&
        markerState.articleIdMatched;

      return {
        rowId: control.rowId,
        sequencePosition,
        repeat,
        outcome:
          response.status >= 200 && response.status < 300 ? "response_received" : "http_error",
        redirects,
        finalStatus: response.status,
        finalHost: host(currentUrl),
        contentType: contentType.split(";", 1)[0],
        responseBytesRead: measured.bytes,
        responseTruncated: measured.truncated,
        googlePageMarkers: {
          articleIdMarkerPresent: /\bdata-n-a-id\s*=/.test(measured.body),
          timestampMarkerPresent: markerState.timestampMarker,
          signatureMarkerPresent: markerState.signatureMarker,
          articleIdMatched: markerState.articleIdMatched,
          afInitDataCallbackPresent: /AF_initDataCallback/.test(measured.body),
        },
        resolverReady,
        setCookieNames: [...setCookieNames],
        cookieHeaderSent: false,
        elapsedMs: Date.now() - started,
      };
    }
  } catch (error) {
    return {
      rowId: control.rowId,
      sequencePosition,
      repeat,
      outcome: error.name === "TimeoutError" ? "timeout" : "request_error",
      error: error.name === "TimeoutError" ? "timeout" : String(error.message).slice(0, 120),
      redirects,
      finalStatus: null,
      finalHost: host(currentUrl),
      resolverReady: false,
      setCookieNames: [...setCookieNames],
      cookieHeaderSent: false,
      elapsedMs: Date.now() - started,
    };
  }
}

await Actor.init();
try {
  const controlsText = await readFile(new URL("./controls.json", import.meta.url), "utf8");
  const controls = JSON.parse(controlsText);
  const scriptText = await readFile(new URL("./main.mjs", import.meta.url), "utf8");
  const sequence = [...controls.controls, { ...controls.controls[0], repeat: true }];
  const requestCounter = { count: 0 };
  const rows = [];
  const startedAtUtc = new Date().toISOString();

  for (let i = 0; i < sequence.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    rows.push(await check(sequence[i], i + 1, Boolean(sequence[i].repeat), requestCounter));
  }

  const evidence = {
    evidenceType: "issue41_a1_google_news_access_characterization",
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
    environment: {
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      actorId: process.env.APIFY_ACTOR_ID || null,
      buildId: process.env.APIFY_ACTOR_BUILD_ID || null,
      buildNumber: process.env.APIFY_ACTOR_BUILD_NUMBER || null,
    },
    configuration: {
      method: "GET",
      controlCount: controls.controls.length,
      sequence: [
        ...controls.controls.map((control) => control.rowId),
        `${controls.controls[0].rowId} (repeat)`,
      ],
      maxRedirects: MAX_REDIRECTS,
      timeoutMsPerControlIncludingRedirects: TIMEOUT_MS,
      maxResponseBytes: MAX_BYTES,
      pauseBetweenControlRequestsMs: PAUSE_MS,
      userAgent: USER_AGENT,
      cookieHandling:
        "No cookie jar; Set-Cookie names observed only; no Cookie header sent; cookie values not retained.",
      outboundIdentity: "Not inspected; runtime exposes no safe identity value to this probe.",
    },
    controlsEvidenceBasis: controls.evidenceBasis,
    controlsSha256: sha256(controlsText),
    probeSha256: sha256(scriptText),
    requestCount: requestCounter.count,
    resolverReadyCount: rows.filter((row) => row.resolverReady).length,
    sequenceStable: rows.filter((row) => row.resolverReady).length === rows.length,
    rows,
  };

  await Actor.pushData(evidence);
  console.log(
    `ISSUE41_A1 ${JSON.stringify({
      requestCount: evidence.requestCount,
      resolverReadyCount: evidence.resolverReadyCount,
      sequenceStable: evidence.sequenceStable,
      outcomeCounts: rows.reduce((counts, row) => {
        counts[row.outcome] = (counts[row.outcome] || 0) + 1;
        return counts;
      }, {}),
    })}`,
  );
} finally {
  await Actor.exit();
}
