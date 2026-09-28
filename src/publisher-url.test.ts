import { describe, expect, it, vi } from "vitest";

import type { GoogleNewsArticleRecord } from "./google-news.js";
import type { PublisherResolutionDiagnostic } from "./publisher-url.js";
import { resolvePublisherUrls } from "./publisher-url.js";

const record: GoogleNewsArticleRecord = {
  query: "climate",
  title: "A story",
  sourceName: "Example News",
  publishedAt: "2026-09-27T12:00:00.000Z",
  googleNewsUrl: "https://news.google.com/rss/articles/opaque-id?hl=en-GB&gl=GB&ceid=GB:en",
  snippet: "Summary",
};

function response(body: string, init?: ResponseInit): Response {
  return new Response(body, init);
}

describe("resolvePublisherUrls", () => {
  it("resolves a direct publisher redirect and preserves the discovery record", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response("", {
        status: 302,
        headers: { location: "https://WWW.Example.com/story/sorry/captcha" },
      }),
    );

    const [result] = await resolvePublisherUrls([record], true, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ...record,
      urlResolved: true,
      urlResolutionStatus: "success",
      publisherUrl: "https://www.example.com/story/sorry/captcha",
      publisherDomain: "www.example.com",
    });
  });

  it("does not report a Google consent redirect as a publisher", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("", { status: 302, headers: { location: "https://consent.google.com/m" } }),
      );

    const diagnostics: PublisherResolutionDiagnostic[] = [];
    const [result] = await resolvePublisherUrls([record], true, fetchImpl, (_index, diagnostic) => {
      diagnostics.push(diagnostic);
    });

    expect(result).toMatchObject({
      googleNewsUrl: record.googleNewsUrl,
      urlResolved: false,
      urlResolutionStatus: "failure",
    });
    expect(result?.publisherUrl).toBeUndefined();
    expect(diagnostics[0]).toMatchObject({
      failureCategory: "consent_or_interstitial",
      resultHostClass: "interstitial",
      requests: [{ stage: "google_page", status: 302 }],
    });
  });

  it("rejects the Google short host g.co as a publisher URL", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("", { status: 302, headers: { location: "https://g.co/story" } }),
      );
    const diagnostics: PublisherResolutionDiagnostic[] = [];

    const [result] = await resolvePublisherUrls([record], true, fetchImpl, (_index, diagnostic) => {
      diagnostics.push(diagnostic);
    });

    expect(result).toMatchObject({ urlResolved: false, urlResolutionStatus: "failure" });
    expect(diagnostics[0]).toMatchObject({
      failureCategory: "google_host",
      resultHostClass: "google",
    });
  });

  it("rejects publisher URLs on regional Google domains and their subdomains", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("", { status: 302, headers: { location: "https://www.google.co.uk/search" } }),
      );

    const [result] = await resolvePublisherUrls([record], true, fetchImpl);

    expect(result).toMatchObject({ urlResolved: false, urlResolutionStatus: "failure" });
    expect(result?.publisherUrl).toBeUndefined();
  });

  it("sends the literal f.req form key and parses a framed decoder response", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(
          '<c-wiz><div data-n-a-id="opaque-id" data-n-a-ts="123456" data-n-a-sg="signature"></div></c-wiz>',
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const body = String(init?.body);
        expect(init?.redirect).toBe("manual");
        expect(body.startsWith("f.req=")).toBe(true);
        const request = JSON.parse(
          decodeURIComponent(body.slice("f.req=".length)),
        ) as unknown[][][];
        expect(JSON.stringify(request)).toContain("garturlreq");
        expect(JSON.stringify(request)).toContain("opaque-id");
        return response(
          ')]}\'\n["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://Publisher.Example/article\\"]",null,null,null,"generic"]\n',
          {
            headers: { "content-type": "application/json" },
          },
        );
      });

    const [result] = await resolvePublisherUrls([record], true, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result?.urlResolved).toBe(true);
    expect(result?.urlResolutionStatus).toBe("success");
    expect(result?.publisherUrl).toBe("https://publisher.example/article");
    expect(result?.publisherDomain).toBe("publisher.example");
    expect(result?.googleNewsUrl).toBe(record.googleNewsUrl);
  });

  it("keeps failures row-local and returns rows in input order", async () => {
    const successRecord = {
      ...record,
      googleNewsUrl: "https://news.google.com/rss/articles/second",
    };
    const failureRecord = {
      ...record,
      title: "Failure",
      googleNewsUrl: "https://news.google.com/rss/articles/first",
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce(
        response("", { status: 302, headers: { location: "https://example.com/story" } }),
      );

    const results = await resolvePublisherUrls([failureRecord, successRecord], true, fetchImpl);

    expect(results.map((result) => result.title)).toEqual(["Failure", "A story"]);
    expect(results[0]).toMatchObject({
      googleNewsUrl: failureRecord.googleNewsUrl,
      urlResolved: false,
      urlResolutionStatus: "failure",
    });
    expect(results[1]?.urlResolutionStatus).toBe("success");
  });

  it("marks disabled rows not requested without making requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const results = await resolvePublisherUrls([record], false, fetchImpl);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(results[0]).toEqual({
      ...record,
      urlResolved: false,
      urlResolutionStatus: "not_requested",
    });
  });

  it("fails safely for mismatched page metadata and invalid decoder URLs", async () => {
    const mismatch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response('<div data-n-a-id="another-id" data-n-a-ts="123" data-n-a-sg="signature"></div>'),
      );
    const [mismatchResult] = await resolvePublisherUrls([record], true, mismatch);
    expect(mismatchResult?.urlResolutionStatus).toBe("failure");
    expect(mismatch).toHaveBeenCalledTimes(1);

    const invalidUrl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response('<div data-n-a-id="opaque-id" data-n-a-ts="123" data-n-a-sg="signature"></div>'),
      )
      .mockResolvedValueOnce(response('["garturlres","javascript:alert(1)"]'));
    const [invalidResult] = await resolvePublisherUrls([record], true, invalidUrl);
    expect(invalidResult?.urlResolutionStatus).toBe("failure");
  });

  it("fails safely when a response exceeds the 2 MiB limit", async () => {
    const oversized = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
          controller.close();
        },
      }),
    );
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(oversized);

    const [result] = await resolvePublisherUrls([record], true, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      googleNewsUrl: record.googleNewsUrl,
      urlResolved: false,
      urlResolutionStatus: "failure",
    });
  });

  it("stops after five Google News redirects", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("", { status: 302, headers: { location: record.googleNewsUrl } }),
      );

    const [result] = await resolvePublisherUrls([record], true, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(result).toMatchObject({ urlResolved: false, urlResolutionStatus: "failure" });
  });

  it("keeps a row-local failure when its overall deadline aborts", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation((delay) => {
      expect(delay).toBe(10_000);
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 0);
      return controller.signal;
    });
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("Missing row deadline signal."));
            return;
          }
          if (signal.aborted) {
            reject(new Error("Request aborted."));
            return;
          }
          signal.addEventListener("abort", () => reject(new Error("Request aborted.")), {
            once: true,
          });
        }),
    );

    try {
      const [result] = await resolvePublisherUrls([record], true, fetchImpl);
      expect(result).toMatchObject({
        googleNewsUrl: record.googleNewsUrl,
        urlResolved: false,
        urlResolutionStatus: "failure",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
