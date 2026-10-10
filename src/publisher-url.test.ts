import { describe, expect, it, vi } from "vitest";

import type { GoogleNewsArticleCandidate, GoogleNewsArticleRecord } from "./google-news.js";
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
const candidate = {
  record,
  edition: { hl: "en-GB", gl: "GB", ceid: "GB:en-GB" },
};

function response(body: string, init?: ResponseInit): Response {
  return new Response(body, init);
}

describe("resolvePublisherUrls", () => {
  it("does not treat a redirect destination as a resolved URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response("", {
        status: 302,
        headers: { location: "https://WWW.Example.com/story/sorry/captcha" },
      }),
    );

    const [result] = await resolvePublisherUrls([candidate], true, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ...record, urlResolved: false, urlResolutionStatus: "failure" });
    expect(result).not.toHaveProperty("edition");
  });

  it("does not report a Google consent redirect as a publisher", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("", { status: 302, headers: { location: "https://consent.google.com/m" } }),
      );

    const diagnostics: PublisherResolutionDiagnostic[] = [];
    const [result] = await resolvePublisherUrls(
      [candidate],
      true,
      fetchImpl,
      (_index, diagnostic) => {
        diagnostics.push(diagnostic);
      },
    );

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

    const [result] = await resolvePublisherUrls(
      [candidate],
      true,
      fetchImpl,
      (_index, diagnostic) => {
        diagnostics.push(diagnostic);
      },
    );

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

    const [result] = await resolvePublisherUrls([candidate], true, fetchImpl);

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
        expect(JSON.stringify(request)).toContain("US:en");
        return response(
          ')]}\'\n["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://Publisher.Example/article\\"]",null,null,null,"generic"]\n',
          {
            headers: { "content-type": "application/json" },
          },
        );
      });

    const diagnostics: PublisherResolutionDiagnostic[] = [];
    const [result] = await resolvePublisherUrls(
      [candidate],
      true,
      fetchImpl,
      (_index, diagnostic) => {
        diagnostics.push(diagnostic);
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const pageUrl = new URL(fetchImpl.mock.calls[0]![0] as string);
    expect(pageUrl.pathname).toBe("/articles/opaque-id");
    expect(pageUrl.searchParams.get("hl")).toBe("en-GB");
    expect(pageUrl.searchParams.get("gl")).toBe("GB");
    expect(pageUrl.searchParams.get("ceid")).toBe("GB:en-GB");
    expect(result?.urlResolved).toBe(true);
    expect(result?.urlResolutionStatus).toBe("success");
    expect(result?.publisherUrl).toBe("https://publisher.example/article");
    expect(result?.publisherDomain).toBe("publisher.example");
    expect(result?.googleNewsUrl).toBe(record.googleNewsUrl);
    expect(result).not.toHaveProperty("edition");
    expect(result).not.toHaveProperty("record");
    expect(diagnostics[0]).toMatchObject({
      rpcContext: "US:en",
      outsideTestedGbUsEnglish: false,
    });
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
        response('<div data-n-a-id="second" data-n-a-ts="123" data-n-a-sg="sig"></div>'),
      )
      .mockResolvedValueOnce(response('["garturlres","https://example.com/story"]'));

    const results = await resolvePublisherUrls(
      [
        { record: failureRecord, edition: candidate.edition },
        { record: successRecord, edition: candidate.edition },
      ],
      true,
      fetchImpl,
    );

    expect(results.map((result) => result.title)).toEqual(["Failure", "A story"]);
    expect(results[0]).toMatchObject({
      googleNewsUrl: failureRecord.googleNewsUrl,
      urlResolved: false,
      urlResolutionStatus: "failure",
    });
    expect(results[1]?.urlResolutionStatus).toBe("success");
    expect(results[1]).not.toHaveProperty("edition");
  });

  it("marks disabled rows not requested without making requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const results = await resolvePublisherUrls([candidate], false, fetchImpl);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(results[0]).toEqual({
      ...record,
      urlResolved: false,
      urlResolutionStatus: "not_requested",
    });
    expect(results[0]).not.toHaveProperty("edition");
    expect(results[0]).not.toHaveProperty("record");
  });

  it("fails safely for mismatched page metadata and invalid decoder URLs", async () => {
    const mismatch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response('<div data-n-a-id="another-id" data-n-a-ts="123" data-n-a-sg="signature"></div>'),
      );
    const [mismatchResult] = await resolvePublisherUrls([candidate], true, mismatch);
    expect(mismatchResult?.urlResolutionStatus).toBe("failure");
    expect(mismatch).toHaveBeenCalledTimes(1);

    const invalidUrl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response('<div data-n-a-id="opaque-id" data-n-a-ts="123" data-n-a-sg="signature"></div>'),
      )
      .mockResolvedValueOnce(response('["garturlres","javascript:alert(1)"]'));
    const [invalidResult] = await resolvePublisherUrls([candidate], true, invalidUrl);
    expect(invalidResult?.urlResolutionStatus).toBe("failure");
    expect(invalidResult).not.toHaveProperty("edition");
  });

  it.each(["not json", '["garturlres","https://www.google.com/story"]'])(
    "rejects malformed or Google-owned RPC result %s",
    async (rpcBody) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response('<div data-n-a-id="opaque-id" data-n-a-ts="123" data-n-a-sg="signature"></div>'),
        )
        .mockResolvedValueOnce(response(rpcBody));

      const [result] = await resolvePublisherUrls([candidate], true, fetchImpl);

      expect(result).toMatchObject({
        googleNewsUrl: record.googleNewsUrl,
        urlResolved: false,
        urlResolutionStatus: "failure",
      });
      expect(result).not.toHaveProperty("edition");
    },
  );

  it("uses the US candidate edition for the page and fixed RPC context", async () => {
    const usCandidate = {
      ...candidate,
      edition: { hl: "en-US", gl: "US", ceid: "US:en-US" },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response('<div data-n-a-id="opaque-id" data-n-a-ts="123" data-n-a-sg="signature"></div>'),
      )
      .mockImplementationOnce(async (_input, init) => {
        const body = String(init?.body);
        const request = JSON.parse(decodeURIComponent(body.slice("f.req=".length))) as unknown;
        expect(JSON.stringify(request)).toContain("US:en");
        return response('["garturlres","https://publisher.example/story"]');
      });

    const diagnostics: PublisherResolutionDiagnostic[] = [];
    const [result] = await resolvePublisherUrls(
      [usCandidate],
      true,
      fetchImpl,
      (_index, diagnostic) => diagnostics.push(diagnostic),
    );
    const pageUrl = new URL(fetchImpl.mock.calls[0]![0] as string);

    expect(pageUrl.searchParams.get("hl")).toBe("en-US");
    expect(pageUrl.searchParams.get("gl")).toBe("US");
    expect(pageUrl.searchParams.get("ceid")).toBe("US:en-US");
    expect(result).toMatchObject({ urlResolved: true, publisherDomain: "publisher.example" });
    expect(diagnostics[0]).toMatchObject({
      rpcContext: "US:en",
      outsideTestedGbUsEnglish: false,
    });
  });

  it("rejects malformed internal edition context without making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const malformed = { record, edition: { hl: "", gl: "GB", ceid: "GB:en-GB" } };

    const diagnostics: PublisherResolutionDiagnostic[] = [];
    const [result] = await resolvePublisherUrls(
      [malformed],
      true,
      fetchImpl,
      (_index, diagnostic) => diagnostics.push(diagnostic),
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      googleNewsUrl: record.googleNewsUrl,
      urlResolved: false,
      urlResolutionStatus: "failure",
    });
    expect(result).not.toHaveProperty("edition");
    expect(diagnostics[0]).toMatchObject({
      rpcContext: "US:en",
      outsideTestedGbUsEnglish: true,
    });
  });

  it("flags editions outside tested GB/US English while retaining the fixed RPC context", async () => {
    const otherLocale = {
      record,
      edition: { hl: "fr-CA", gl: "CA", ceid: "CA:fr-CA" },
    };
    const diagnostics: PublisherResolutionDiagnostic[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response("<html></html>"));

    await resolvePublisherUrls([otherLocale], true, fetchImpl, (_index, diagnostic) => {
      diagnostics.push(diagnostic);
    });

    expect(diagnostics[0]).toMatchObject({
      rpcContext: "US:en",
      outsideTestedGbUsEnglish: true,
    });

    const missingEdition = { record, edition: undefined } as unknown as GoogleNewsArticleCandidate;
    const [missingResult] = await resolvePublisherUrls(
      [missingEdition],
      true,
      vi.fn<typeof fetch>(),
      (_index, diagnostic) => diagnostics.push(diagnostic),
    );
    expect(missingResult).toMatchObject({ urlResolutionStatus: "failure" });
    expect(diagnostics[1]).toMatchObject({
      rpcContext: "US:en",
      outsideTestedGbUsEnglish: true,
    });
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

    const [result] = await resolvePublisherUrls([candidate], true, fetchImpl);

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

    const [result] = await resolvePublisherUrls([candidate], true, fetchImpl);

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
      const [result] = await resolvePublisherUrls([candidate], true, fetchImpl);
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
