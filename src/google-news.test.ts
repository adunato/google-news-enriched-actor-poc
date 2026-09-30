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

function feedWithLinks(...links: string[]): string {
  const items = links
    .map(
      (link) =>
        `<item><title>Same title</title><link>${link}</link><source>Same source</source></item>`,
    )
    .join("");
  return `<rss><channel>${items}</channel></rss>`;
}

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
    expect(records[0]).toEqual({
      record: expect.objectContaining({
        googleNewsUrl: "https://news.google.com/rss/articles/example-id?oc=5",
      }),
      edition: { hl: "en-GB", gl: "GB", ceid: "GB:en-GB" },
    });
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
    const input = validateActorInput({
      queries: ["first", "second"],
      maxItemsPerQuery: 1,
      dedupe: false,
    });

    const records = await retrieveGoogleNewsArticles(input, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(records.map(({ record }) => record.query)).toEqual(["first", "second"]);
  });

  it("deduplicates exact Google News URLs across and within queries, keeping the first record", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(feedWithLinks("https://news.google.com/a", "https://news.google.com/a")),
      )
      .mockResolvedValueOnce(
        new Response(feedWithLinks("https://news.google.com/a", "https://news.google.com/b")),
      );
    const input = validateActorInput({ queries: ["first", "second"] });

    const records = await retrieveGoogleNewsArticles(input, fetchMock);

    expect(records.map(({ record: { query, googleNewsUrl } }) => [query, googleNewsUrl])).toEqual([
      ["first", "https://news.google.com/a"],
      ["second", "https://news.google.com/b"],
    ]);
  });

  it("keeps separate URLs even when their metadata matches", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(feedWithLinks("https://news.google.com/a", "https://news.google.com/b")),
      );

    const records = await retrieveGoogleNewsArticles(
      validateActorInput({ queries: ["one"] }),
      fetchMock,
    );

    expect(records).toHaveLength(2);
    expect(records[0]?.record).toMatchObject({ title: "Same title", sourceName: "Same source" });
    expect(records[1]?.record).toMatchObject({ title: "Same title", sourceName: "Same source" });
  });

  it("deduplicates by URL when optional metadata is missing", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          `<rss><channel><item><title>Story</title><link>https://news.google.com/a</link></item><item><title>Story</title><link>https://news.google.com/a</link><source>Publisher</source></item></channel></rss>`,
        ),
      );

    const records = await retrieveGoogleNewsArticles(
      validateActorInput({ queries: ["one"] }),
      fetchMock,
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      record: { query: "one", title: "Story", googleNewsUrl: "https://news.google.com/a" },
      edition: { hl: "en-GB", gl: "GB", ceid: "GB:en-GB" },
    });
  });

  it("does not refill a query after its cap is applied before deduplication", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          feedWithLinks(
            "https://news.google.com/a",
            "https://news.google.com/a",
            "https://news.google.com/b",
          ),
        ),
      )
      .mockResolvedValueOnce(new Response(feedWithLinks("https://news.google.com/a")));

    const records = await retrieveGoogleNewsArticles(
      validateActorInput({ queries: ["first", "second"], maxItemsPerQuery: 2 }),
      fetchMock,
    );

    expect(records.map(({ record }) => [record.query, record.googleNewsUrl])).toEqual([
      ["first", "https://news.google.com/a"],
    ]);
  });

  it("retains all per-query occurrences when deduplication is disabled", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(feedWithLinks("https://news.google.com/a", "https://news.google.com/a")),
      );

    const records = await retrieveGoogleNewsArticles(
      validateActorInput({ queries: ["first", "second"], dedupe: false }),
      fetchMock,
    );

    expect(records.map(({ record }) => [record.query, record.googleNewsUrl])).toEqual([
      ["first", "https://news.google.com/a"],
      ["first", "https://news.google.com/a"],
      ["second", "https://news.google.com/a"],
      ["second", "https://news.google.com/a"],
    ]);
  });

  it("rejects malformed feeds and failed HTTP responses", async () => {
    expect(() => parseGoogleNewsRss("<rss><channel>", "query")).toThrow("malformed RSS XML");

    const failedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 503 }));
    await expect(
      retrieveGoogleNewsArticles(validateActorInput({ queries: ["query"] }), failedFetch),
    ).rejects.toThrow("HTTP 503");
  });

  it.each([
    ["en-GB", "GB", "GB:en-GB"],
    ["en-US", "US", "US:en-US"],
  ])(
    "attaches the exact %s edition from the finalized RSS request",
    async (language, country, ceid) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(sampleFeed));
      const candidates = await retrieveGoogleNewsArticles(
        validateActorInput({ queries: ["news"], language, country }),
        fetchMock,
      );
      const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);

      expect(candidates[0]?.edition).toEqual({
        hl: requestedUrl.searchParams.get("hl"),
        gl: requestedUrl.searchParams.get("gl"),
        ceid: requestedUrl.searchParams.get("ceid"),
      });
      expect(candidates[0]?.edition).toEqual({ hl: language, gl: country, ceid });
    },
  );

  it("rejects an oversized feed before parsing it", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { headers: { "content-length": "2097153" } }));
    await expect(
      retrieveGoogleNewsArticles(validateActorInput({ queries: ["query"] }), fetchMock),
    ).rejects.toThrow("exceeded the 2 MiB limit");
  });
});
