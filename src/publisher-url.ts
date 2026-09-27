import type { FetchLike, GoogleNewsArticleRecord } from "./google-news.js";

const GOOGLE_NEWS_HOST = "news.google.com";
const BATCHEXECUTE_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
const ROW_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_CONCURRENCY = 4;

export type UrlResolutionStatus = "success" | "failure" | "not_requested";

export interface PublisherResolvedArticle extends GoogleNewsArticleRecord {
  urlResolved: boolean;
  urlResolutionStatus: UrlResolutionStatus;
  publisherUrl?: string;
  publisherDomain?: string;
}

interface Markers {
  articleId: string;
  timestamp: string;
  signature: string;
}

function failed(record: GoogleNewsArticleRecord): PublisherResolvedArticle {
  return { ...record, urlResolved: false, urlResolutionStatus: "failure" };
}

function validHttpUrl(value: string, rejectGoogleNews = true): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    const googleOwned =
      /(?:^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host) ||
      host === "googleusercontent.com" ||
      host.endsWith(".googleusercontent.com") ||
      host === "gstatic.com" ||
      host.endsWith(".gstatic.com");
    if (rejectGoogleNews && (host === GOOGLE_NEWS_HOST || googleOwned)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function googleArticleId(value: string): { id: string; url: URL } | undefined {
  const url = validHttpUrl(value, false);
  if (!url || url.hostname.toLowerCase() !== GOOGLE_NEWS_HOST) return undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  const markerIndex = parts.findIndex((part) => part === "articles" || part === "read");
  const id = markerIndex >= 0 ? parts[markerIndex + 1] : undefined;
  return id ? { id, url } : undefined;
}

function extractMarkers(html: string, expectedId: string): Markers | undefined {
  const element = /<[^>]*\bdata-n-a-id\s*=\s*(["'])(.*?)\1[^>]*>/gis;
  for (const match of html.matchAll(element)) {
    const tag = match[0];
    const articleId = match[2];
    const timestamp = tag.match(/\bdata-n-a-ts\s*=\s*(["'])(.*?)\1/i)?.[2];
    const signature = tag.match(/\bdata-n-a-sg\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (articleId === expectedId && timestamp && signature) {
      return { articleId, timestamp, signature };
    }
  }
  return undefined;
}

async function readBounded(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("Response exceeded the 2 MiB limit.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Response exceeded the 2 MiB limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function successful(
  record: GoogleNewsArticleRecord,
  publisherUrl: string,
): PublisherResolvedArticle | undefined {
  const url = validHttpUrl(publisherUrl);
  if (!url) return undefined;
  return {
    ...record,
    urlResolved: true,
    urlResolutionStatus: "success",
    publisherUrl: url.toString(),
    publisherDomain: url.hostname.toLowerCase(),
  };
}

async function fetchGooglePage(
  initialUrl: URL,
  fetchImpl: FetchLike,
  signal: AbortSignal,
): Promise<{ response?: Response; destination?: string }> {
  let current = initialUrl;
  for (let redirects = 0; ; redirects += 1) {
    const response = await fetchImpl(current, { redirect: "manual", signal });
    if (response.status < 300 || response.status >= 400) return { response };
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || redirects >= MAX_REDIRECTS)
      throw new Error("Redirect limit or location failure.");
    const next = new URL(location, current);
    if (next.protocol !== "http:" && next.protocol !== "https:")
      throw new Error("Unsupported redirect scheme.");
    if (next.hostname.toLowerCase() !== GOOGLE_NEWS_HOST) return { destination: next.toString() };
    current = next;
  }
}

function buildRpcBody(markers: Markers): string {
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
  const request = [
    "garturlreq",
    context,
    markers.articleId,
    /^\d+$/.test(markers.timestamp) ? Number(markers.timestamp) : markers.timestamp,
    markers.signature,
  ];
  const envelopes = [["Fbv4je", JSON.stringify(request), null, "0"]];
  const payload = JSON.stringify([envelopes]);
  return `f.req=${encodeURIComponent(payload)}`;
}

function findGarturlres(value: unknown): string | undefined {
  if (typeof value === "string") {
    try {
      return findGarturlres(JSON.parse(value) as unknown);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value)) return undefined;
  if (value[0] === "garturlres" && typeof value[1] === "string") return value[1];
  for (const child of value) {
    const result = findGarturlres(child);
    if (result) return result;
  }
  return undefined;
}

function parseRpcResponse(body: string): string | undefined {
  const candidates = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!candidates.length) candidates.push(body.trim());
  for (let candidate of candidates) {
    if (/^\d+$/.test(candidate)) continue;
    if (candidate.startsWith(")]}'")) candidate = candidate.slice(4).trim();
    try {
      const result = findGarturlres(JSON.parse(candidate) as unknown);
      if (result) return result;
    } catch {
      // batchexecute can frame a JSON payload with a byte count; try the next frame.
    }
  }
  const framedStart = body.indexOf("\n\n");
  if (framedStart >= 0) return parseRpcResponse(body.slice(framedStart + 2));
  return undefined;
}

/** Resolve one Google News record. All network and parsing errors become row-local failure outcomes. */
export async function resolvePublisherUrl(
  record: GoogleNewsArticleRecord,
  fetchImpl: FetchLike = fetch,
): Promise<PublisherResolvedArticle> {
  try {
    const article = googleArticleId(record.googleNewsUrl);
    if (!article) return failed(record);
    const signal = AbortSignal.timeout(ROW_TIMEOUT_MS);
    const page = await fetchGooglePage(article.url, fetchImpl, signal);
    if (page.destination) return successful(record, page.destination) ?? failed(record);
    if (!page.response?.ok) {
      await page.response?.body?.cancel();
      return failed(record);
    }
    const html = await readBounded(page.response);
    const markers = extractMarkers(html, article.id);
    if (!markers) return failed(record);

    const rpcResponse = await fetchImpl(BATCHEXECUTE_URL, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: buildRpcBody(markers),
      signal,
    });
    if (!rpcResponse.ok) {
      await rpcResponse.body?.cancel();
      return failed(record);
    }
    const publisherUrl = parseRpcResponse(await readBounded(rpcResponse));
    return (publisherUrl && successful(record, publisherUrl)) || failed(record);
  } catch {
    return failed(record);
  }
}

/** Resolve rows concurrently while preserving their input order and fail-soft behavior. */
export async function resolvePublisherUrls(
  records: GoogleNewsArticleRecord[],
  enabled: boolean,
  fetchImpl: FetchLike = fetch,
): Promise<PublisherResolvedArticle[]> {
  if (!enabled) {
    return records.map((record) => ({
      ...record,
      urlResolved: false,
      urlResolutionStatus: "not_requested",
    }));
  }
  const results = new Array<PublisherResolvedArticle>(records.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= records.length) return;
      results[index] = await resolvePublisherUrl(records[index]!, fetchImpl);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, records.length) }, worker));
  return results;
}
