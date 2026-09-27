import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { validateActorInput } from "./input.js";
import {
  buildGoogleNewsRssUrl,
  parseGoogleNewsRss,
  retrieveGoogleNewsArticles,
} from "./google-news.js";

const sampleFeed = readFileSync(
  new URL("./fixtures/google-news-sample.xml", import.meta.url),
  "utf8",
);

describe("Google News RSS retrieval and normalization", () => {
  it("normalizes valid entries, preserves the source URL, and skips unusable entries", () => {
    expect(parseGoogleNewsRss(sampleFeed, "climate policy")).toEqual([
      {
        query: "climate policy",
        title: "Example story",
        sourceName: "Example & Co",
        publishedAt: "2026-09-27T10:15:00.000Z",
        googleNewsUrl: "https://news.google.com/rss/articles/example-id?oc=5",
        snippet: "Read more - a & b",
      },
      {
        query: "climate policy",
        title: "Metadata without optional fields",
        googleNewsUrl: "https://news.google.com/rss/articles/second-id",
      },
    ]);
  });

  it.each([
    ["any", "climate policy"],
    ["1h", "climate policy when:1h"],
    ["6h", "climate policy when:6h"],
    ["1d", "climate policy when:1d"],
    ["7d", "climate policy when:7d"],
    ["30d", "climate policy when:30d"],
  ] as const)("encodes the %s range and locale controls", (dateRange, expectedQuery) => {
    const url = new URL(
      buildGoogleNewsRssUrl({
        query: "climate policy",
        dateRange,
        language: "fr-CA",
        country: "CA",
      }),
    );
    expect(url.searchParams.get("q")).toBe(expectedQuery);
    expect(url.searchParams.get("hl")).toBe("fr-CA");
    expect(url.searchParams.get("gl")).toBe("CA");
    expect(url.searchParams.get("ceid")).toBe("CA:fr-CA");
  });

  it("applies the per-query result bound and requests the Google News RSS feed", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(sampleFeed));
    const input = validateActorInput({
      queries: ["climate policy"],
      maxItemsPerQuery: 1,
      language: "en-GB",
      country: "GB",
      dateRange: "7d",
    });

    const records = await retrieveGoogleNewsArticles(input, fetchMock);

    expect(records).toHaveLength(1);
    expect(new URL(fetchMock.mock.calls[0]![0] as string).searchParams.get("q")).toBe(
      "climate policy when:7d",
    );
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
  });

  it("retrieves each requested query independently", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(sampleFeed));
    const input = validateActorInput({ queries: ["first", "second"], maxItemsPerQuery: 1 });

    const records = await retrieveGoogleNewsArticles(input, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(records.map((record) => record.query)).toEqual(["first", "second"]);
  });

  it("rejects malformed feeds and failed HTTP responses", async () => {
    expect(() => parseGoogleNewsRss("<rss><channel>", "query")).toThrow("malformed RSS XML");

    const failedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 503 }));
    await expect(
      retrieveGoogleNewsArticles(validateActorInput({ queries: ["query"] }), failedFetch),
    ).rejects.toThrow("HTTP 503");
  });

  it("rejects an oversized feed before parsing it", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { headers: { "content-length": "2097153" } }));
    await expect(
      retrieveGoogleNewsArticles(validateActorInput({ queries: ["query"] }), fetchMock),
    ).rejects.toThrow("exceeded the 2 MiB limit");
  });
});
