import { XMLParser, XMLValidator } from "fast-xml-parser";

import type { ActorInput, DateRange } from "./input.js";

const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;

/** Discovery-stage metadata. Enrichment and final dataset fields are added by downstream stages. */
export interface GoogleNewsArticleRecord {
  query: string;
  title: string;
  sourceName?: string;
  publishedAt?: string;
  googleNewsUrl: string;
  snippet?: string;
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

function buildSearchQuery(query: string, dateRange: DateRange): string {
  return dateRange === "any" ? query : `${query} when:${dateRange}`;
}

export function buildGoogleNewsRssUrl(
  input: Pick<ActorInput, "language" | "country" | "dateRange"> & { query: string },
): string {
  const url = new URL(GOOGLE_NEWS_RSS_URL);
  url.searchParams.set("q", buildSearchQuery(input.query, input.dateRange));
  url.searchParams.set("hl", input.language);
  url.searchParams.set("gl", input.country);
  url.searchParams.set("ceid", `${input.country}:${input.language}`);
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (isRecord(value)) {
    const text = value["#text"] ?? value["#cdata"];
    return typeof text === "string" ? text.trim() || undefined : undefined;
  }
  return undefined;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, name: string) => {
      const normalized = name.toLowerCase();
      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return Number.isFinite(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }
      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return Number.isFinite(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }
      return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[normalized] ?? entity;
    },
  );
}

function normalizeSnippet(value: unknown): string | undefined {
  const rawText = textValue(value);
  if (!rawText) return undefined;
  const plainText = decodeHtmlEntities(rawText.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return plainText || undefined;
}

function normalizePublishedAt(value: unknown): string | undefined | null {
  const rawDate = textValue(value);
  if (!rawDate) return undefined;
  const timestamp = Date.parse(rawDate);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeItem(item: unknown, query: string): GoogleNewsArticleRecord | undefined {
  if (!isRecord(item)) return undefined;

  const title = textValue(item.title);
  const googleNewsUrl = textValue(item.link);
  if (!title || !googleNewsUrl) return undefined;

  try {
    const parsedUrl = new URL(googleNewsUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }

  const publishedAt = normalizePublishedAt(item.pubDate);
  if (publishedAt === null) return undefined;

  const sourceName = textValue(item.source);
  const snippet = normalizeSnippet(item.description);
  return {
    query,
    title,
    ...(sourceName ? { sourceName } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    googleNewsUrl,
    ...(snippet ? { snippet } : {}),
  };
}

export function parseGoogleNewsRss(xml: string, query: string): GoogleNewsArticleRecord[] {
  if (XMLValidator.validate(xml) !== true)
    throw new Error("Google News returned malformed RSS XML.");

  const parsed: unknown = parser.parse(xml);
  if (!isRecord(parsed) || !isRecord(parsed.rss) || !isRecord(parsed.rss.channel)) return [];

  const items = parsed.rss.channel.item;
  if (items === undefined) return [];
  const list = Array.isArray(items) ? items : [items];
  return list.flatMap((item) => {
    const record = normalizeItem(item, query);
    return record ? [record] : [];
  });
}

async function readBoundedBody(response: Response): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_FEED_BYTES) {
    throw new Error("Google News RSS response exceeded the 2 MiB limit.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new Error("Google News RSS response exceeded the 2 MiB limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export type FetchLike = typeof fetch;

export async function retrieveGoogleNewsArticles(
  input: ActorInput,
  fetchImpl: FetchLike = fetch,
): Promise<GoogleNewsArticleRecord[]> {
  const records: GoogleNewsArticleRecord[] = [];
  for (const query of input.queries) {
    const response = await fetchImpl(
      buildGoogleNewsRssUrl({
        query,
        language: input.language,
        country: input.country,
        dateRange: input.dateRange,
      }),
      {
        headers: { accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok)
      throw new Error(`Google News RSS request failed with HTTP ${response.status}.`);

    const xml = await readBoundedBody(response);
    records.push(...parseGoogleNewsRss(xml, query).slice(0, input.maxItemsPerQuery));
  }
  if (!input.dedupe) return records;

  const seenGoogleNewsUrls = new Set<string>();
  return records.filter((record) => {
    if (seenGoogleNewsUrls.has(record.googleNewsUrl)) return false;
    seenGoogleNewsUrls.add(record.googleNewsUrl);
    return true;
  });
}
