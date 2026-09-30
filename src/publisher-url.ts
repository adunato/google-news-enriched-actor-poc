import type {
  FetchLike,
  GoogleNewsArticleCandidate,
  GoogleNewsArticleRecord,
  GoogleNewsEdition,
} from "./google-news.js";

const GOOGLE_NEWS_HOST = "news.google.com";
const BATCHEXECUTE_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
const ROW_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_CONCURRENCY = 4;
const RPC_CONTEXT = "US:en";

export type UrlResolutionStatus = "success" | "failure" | "not_requested";
export type ResolutionFailureCategory =
  | "consent_or_interstitial"
  | "invalid_publisher_url"
  | "google_host"
  | "metadata_missing_or_mismatch"
  | "rpc_http_error"
  | "rpc_parse_or_result_error"
  | "timeout"
  | "network"
  | "redirect_limit"
  | "other";

export interface ResolutionRequestObservation {
  stage: "google_page" | "decoder_rpc";
  hostClass: "google" | "interstitial" | "publisher" | "unknown";
  status?: number;
  responseBytes?: number;
  declaredBytes?: number;
  error?: "timeout" | "network" | "other";
}

export interface PublisherResolutionDiagnostic {
  elapsedMs: number;
  rpcContext: typeof RPC_CONTEXT;
  outsideTestedGbUsEnglish: boolean;
  failureCategory?: ResolutionFailureCategory;
  resultHostClass?: ResolutionRequestObservation["hostClass"];
  requests: ResolutionRequestObservation[];
}

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

function classifyHost(host: string): ResolutionRequestObservation["hostClass"] {
  const normalized = host.toLowerCase();
  if (/(^|[.-])(consent|captcha|recaptcha|interstitial|sorry)([.-]|$)/i.test(normalized))
    return "interstitial";
  if (
    normalized === "g.co" ||
    normalized.endsWith(".g.co") ||
    /(?:^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(normalized) ||
    normalized === "googleusercontent.com" ||
    normalized.endsWith(".googleusercontent.com") ||
    normalized === "gstatic.com" ||
    normalized.endsWith(".gstatic.com")
  )
    return "google";
  return "publisher";
}

function validHttpUrl(value: string, rejectGoogleNews = true): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    const hostClass = classifyHost(host);
    if (
      rejectGoogleNews &&
      (host === GOOGLE_NEWS_HOST || hostClass === "google" || hostClass === "interstitial")
    )
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function googleArticleId(value: string): string | undefined {
  const url = validHttpUrl(value, false);
  if (!url || url.hostname.toLowerCase() !== GOOGLE_NEWS_HOST) return undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  const markerIndex = parts.findIndex((part) => part === "articles" || part === "read");
  const encodedId = markerIndex >= 0 ? parts[markerIndex + 1] : undefined;
  if (!encodedId) return undefined;
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return undefined;
  }
}

function validEdition(edition: GoogleNewsEdition | undefined): edition is GoogleNewsEdition {
  if (typeof edition !== "object" || edition === null) return false;
  return [edition.hl, edition.gl, edition.ceid].every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function articleParameterPage(articleId: string, edition: GoogleNewsEdition): URL {
  const url = new URL(`/articles/${encodeURIComponent(articleId)}`, `https://${GOOGLE_NEWS_HOST}`);
  url.searchParams.set("hl", edition.hl);
  url.searchParams.set("gl", edition.gl);
  url.searchParams.set("ceid", edition.ceid);
  return url;
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

async function readBounded(
  response: Response,
  onBytesRead?: (bytes: number) => void,
): Promise<string> {
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
      onBytesRead?.(value.byteLength);
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
    if (!location) throw new Error("Missing redirect location.");
    if (redirects >= MAX_REDIRECTS) throw new Error("Redirect limit exceeded.");
    const next = new URL(location, current);
    if (next.protocol !== "http:" && next.protocol !== "https:")
      throw new Error("Unsupported redirect scheme.");
    if (next.hostname.toLowerCase() !== GOOGLE_NEWS_HOST) return { destination: next.toString() };
    current = next;
  }
}

function buildRpcBody(markers: Markers): string {
  const context = [
    [
      "X",
      "X",
      ["X", "X"],
      null,
      null,
      1,
      1,
      RPC_CONTEXT,
      null,
      1,
      null,
      null,
      null,
      null,
      null,
      0,
      1,
    ],
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
  candidate: GoogleNewsArticleCandidate,
  fetchImpl: FetchLike = fetch,
  onDiagnostic?: (diagnostic: PublisherResolutionDiagnostic) => void,
): Promise<PublisherResolvedArticle> {
  const { record, edition } = candidate;
  const startedAt = Date.now();
  const requests: ResolutionRequestObservation[] = [];
  let latestObservation: ResolutionRequestObservation | undefined;
  let currentStage: "google_page" | "decoder_rpc" = "google_page";
  let signal: AbortSignal | undefined;
  const report = (
    result: PublisherResolvedArticle,
    failureCategory?: ResolutionFailureCategory,
    resultHostClass?: ResolutionRequestObservation["hostClass"],
  ): PublisherResolvedArticle => {
    try {
      onDiagnostic?.({
        elapsedMs: Date.now() - startedAt,
        rpcContext: RPC_CONTEXT,
        outsideTestedGbUsEnglish:
          !edition ||
          !(
            (edition.hl === "en-GB" && edition.gl === "GB") ||
            (edition.hl === "en-US" && edition.gl === "US")
          ),
        ...(failureCategory ? { failureCategory } : {}),
        ...(resultHostClass ? { resultHostClass } : {}),
        requests,
      });
    } catch {
      // Measurement diagnostics must never change resolver behavior.
    }
    return result;
  };
  const observedFetch: FetchLike = async (input, init) => {
    currentStage = init?.method?.toUpperCase() === "POST" ? "decoder_rpc" : "google_page";
    let requestUrl: URL;
    try {
      const value = input instanceof Request ? input.url : String(input);
      requestUrl = new URL(value);
    } catch {
      requestUrl = new URL("https://unknown.invalid/");
    }
    const observation: ResolutionRequestObservation = {
      stage: currentStage,
      hostClass: classifyHost(requestUrl.hostname),
    };
    requests.push(observation);
    latestObservation = observation;
    try {
      const response = await fetchImpl(input, init);
      observation.status = response.status;
      const contentLength = response.headers.get("content-length");
      if (contentLength && Number.isFinite(Number(contentLength))) {
        observation.declaredBytes = Number(contentLength);
      }
      observation.responseBytes = 0;
      return response;
    } catch (error) {
      observation.error = signal?.aborted
        ? "timeout"
        : error instanceof TypeError
          ? "network"
          : "other";
      throw error;
    }
  };

  try {
    const articleId = googleArticleId(record.googleNewsUrl);
    if (!articleId || !validEdition(edition))
      return report(failed(record), "invalid_publisher_url");
    signal = AbortSignal.timeout(ROW_TIMEOUT_MS);
    const page = await fetchGooglePage(
      articleParameterPage(articleId, edition),
      observedFetch,
      signal,
    );
    if (page.destination) {
      const destination = new URL(page.destination);
      const hostClass = classifyHost(destination.hostname);
      const category =
        hostClass === "interstitial"
          ? "consent_or_interstitial"
          : hostClass === "google"
            ? "google_host"
            : "invalid_publisher_url";
      return report(failed(record), category, hostClass);
    }
    if (!page.response?.ok) {
      await page.response?.body?.cancel();
      return report(
        failed(record),
        latestObservation?.hostClass === "interstitial" ? "consent_or_interstitial" : "other",
        latestObservation?.hostClass,
      );
    }
    const html = await readBounded(page.response, (bytes) => {
      latestObservation!.responseBytes = (latestObservation!.responseBytes ?? 0) + bytes;
    });
    const markers = extractMarkers(html, articleId);
    if (!markers) return report(failed(record), "metadata_missing_or_mismatch");

    const rpcResponse = await observedFetch(BATCHEXECUTE_URL, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: buildRpcBody(markers),
      signal,
    });
    if (!rpcResponse.ok) {
      await rpcResponse.body?.cancel();
      return report(failed(record), "rpc_http_error", latestObservation?.hostClass);
    }
    const publisherUrl = parseRpcResponse(
      await readBounded(rpcResponse, (bytes) => {
        latestObservation!.responseBytes = (latestObservation!.responseBytes ?? 0) + bytes;
      }),
    );
    if (!publisherUrl) return report(failed(record), "rpc_parse_or_result_error");
    const resultUrl = validHttpUrl(publisherUrl, false);
    const hostClass = resultUrl ? classifyHost(resultUrl.hostname) : undefined;
    const resolved = successful(record, publisherUrl);
    if (resolved) return report(resolved, undefined, hostClass);
    const category =
      hostClass === "interstitial"
        ? "consent_or_interstitial"
        : hostClass === "google"
          ? "google_host"
          : "invalid_publisher_url";
    return report(failed(record), category, hostClass);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureCategory: ResolutionFailureCategory = signal?.aborted
      ? "timeout"
      : /redirect limit/i.test(message)
        ? "redirect_limit"
        : latestObservation?.error === "network"
          ? "network"
          : "other";
    return report(failed(record), failureCategory, latestObservation?.hostClass);
  }
}

/** Resolve rows concurrently while preserving their input order and fail-soft behavior. */
export async function resolvePublisherUrls(
  candidates: GoogleNewsArticleCandidate[],
  enabled: boolean,
  fetchImpl: FetchLike = fetch,
  onDiagnostic?: (index: number, diagnostic: PublisherResolutionDiagnostic) => void,
): Promise<PublisherResolvedArticle[]> {
  if (!enabled) {
    return candidates.map(({ record }) => ({
      ...record,
      urlResolved: false,
      urlResolutionStatus: "not_requested",
    }));
  }
  const results = new Array<PublisherResolvedArticle>(candidates.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= candidates.length) return;
      results[index] = await resolvePublisherUrl(candidates[index]!, fetchImpl, (diagnostic) => {
        onDiagnostic?.(index, diagnostic);
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, candidates.length) }, worker));
  return results;
}
