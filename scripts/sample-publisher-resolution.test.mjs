import { describe, expect, it } from "vitest";
import { URL } from "node:url";

import {
  aggregateFailures,
  buildRowAudit,
  createMatrix,
  hostClass,
  isMatrixComplete,
  redirectDestinationClass,
  successPredicate,
} from "./sample-publisher-resolution.mjs";

describe("publisher resolution live sample harness", () => {
  it("builds exactly the ten fixed query and edition cells", () => {
    const matrix = createMatrix();

    expect(matrix).toHaveLength(10);
    expect(matrix.map(({ query, edition }) => `${query}|${edition.id}`)).toEqual([
      "world news|GB",
      "world news|US",
      "politics|GB",
      "politics|US",
      "business|GB",
      "business|US",
      "technology|GB",
      "technology|US",
      "health|GB",
      "health|US",
    ]);
    expect(matrix[0]?.edition).toEqual({ id: "GB", language: "en-GB", country: "GB" });
    expect(matrix[1]?.edition).toEqual({ id: "US", language: "en-US", country: "US" });
  });

  it("requires ten retained rows in each of the ten cells", () => {
    const complete = createMatrix().map((cell) => ({ ...cell, records: Array(10).fill({}) }));
    expect(isMatrixComplete(complete)).toBe(true);
    complete[4].records.pop();
    expect(isMatrixComplete(complete)).toBe(false);
    expect(isMatrixComplete(complete.slice(1))).toBe(false);
  });

  it("counts only publisher URLs with consistent provenance, status, and domain", () => {
    const original = { googleNewsUrl: "https://news.google.com/rss/articles/sample" };
    const valid = {
      ...original,
      urlResolved: true,
      urlResolutionStatus: "success",
      publisherUrl: "https://publisher.example/story/1",
      publisherDomain: "publisher.example",
    };

    expect(successPredicate(original, valid).valid).toBe(true);
    expect(
      successPredicate(original, { ...valid, publisherDomain: "wrong.example" }),
    ).toMatchObject({
      valid: false,
      category: "invalid_publisher_url",
    });
    expect(
      successPredicate(original, { ...valid, publisherUrl: "https://www.google.co.uk/story" }),
    ).toMatchObject({
      valid: false,
      category: "google_host",
    });
    expect(
      successPredicate(original, { ...valid, publisherUrl: "https://consent.google.com/m" }),
    ).toMatchObject({
      valid: false,
      category: "consent_or_interstitial",
    });
    expect(
      successPredicate(original, { ...valid, publisherUrl: "https://g.co/story" }),
    ).toMatchObject({ valid: false, category: "google_host" });
    expect(
      successPredicate(original, {
        ...valid,
        publisherUrl: "https://publisher.example/story/sorry/captcha",
      }).valid,
    ).toBe(true);
    expect(hostClass(new URL("https://captcha.publisher.example/story"))).toBe("interstitial");
    expect(
      successPredicate(original, { ...valid, googleNewsUrl: "https://news.google.com/changed" })
        .valid,
    ).toBe(false);
  });

  it("keeps row audit output free of source and publisher URLs", () => {
    const sourceUrl = "https://news.google.com/rss/articles/private-id";
    const publisherUrl = "https://publisher.example/private-story";
    const audit = buildRowAudit(
      {
        ordinal: 1,
        candidate: {
          record: {
            title: "Private title",
            snippet: "Private snippet",
            googleNewsUrl: sourceUrl,
          },
          edition: { hl: "en-GB", gl: "GB", ceid: "GB:en-GB" },
        },
      },
      {
        urlResolved: false,
        urlResolutionStatus: "failure",
        googleNewsUrl: sourceUrl,
        publisherUrl,
      },
      {
        elapsedMs: 12,
        rpcContext: "US:en",
        outsideTestedGbUsEnglish: false,
        failureCategory: "consent_or_interstitial",
        resultHostClass: "interstitial",
        requests: [{ stage: "google_page", status: 302, hostClass: "google" }],
      },
      true,
    );
    const serialized = JSON.stringify(audit);

    expect(audit.failureCategory).toBe("consent_or_interstitial");
    expect(audit).toMatchObject({ rpcContext: "US:en", outsideTestedGbUsEnglish: false });
    expect(audit.redirectDestinationClass).toBe("interstitial");
    expect(serialized).not.toContain(sourceUrl);
    expect(serialized).not.toContain(publisherUrl);
    expect(serialized).not.toContain("Private title");
    expect(serialized).not.toContain("Private snippet");
  });

  it("distinguishes redirect destination classes without retaining URLs", () => {
    expect(
      redirectDestinationClass({
        requests: [
          { stage: "google_page", status: 302, hostClass: "google" },
          { stage: "google_page", status: 200, hostClass: "google" },
        ],
      }),
    ).toBe("google_news");
    expect(
      redirectDestinationClass({
        resultHostClass: "interstitial",
        requests: [{ stage: "google_page", status: 302, hostClass: "google" }],
      }),
    ).toBe("interstitial");
    expect(
      redirectDestinationClass({
        resultHostClass: "google",
        requests: [{ stage: "google_page", status: 302, hostClass: "google" }],
      }),
    ).toBe("google");
    expect(
      redirectDestinationClass({
        resultHostClass: "publisher",
        requests: [{ stage: "google_page", status: 302, hostClass: "google" }],
      }),
    ).toBe("publisher");
    expect(
      redirectDestinationClass({
        resultHostClass: "publisher",
        requests: [{ stage: "decoder_rpc", status: 200, hostClass: "google" }],
      }),
    ).toBeUndefined();
  });

  it("adds failure categories only to failed complete rows", () => {
    const row = {
      ordinal: 1,
      candidate: {
        record: { googleNewsUrl: "https://news.google.com/rss/articles/sample" },
        edition: { hl: "en-GB", gl: "GB", ceid: "GB:en-GB" },
      },
    };
    const success = {
      googleNewsUrl: row.candidate.record.googleNewsUrl,
      urlResolved: true,
      urlResolutionStatus: "success",
      publisherUrl: "https://publisher.example/story",
      publisherDomain: "publisher.example",
    };

    const successAudit = buildRowAudit(
      row,
      success,
      { failureCategory: "other", requests: [] },
      true,
    );
    const failedAudit = buildRowAudit(
      row,
      {
        googleNewsUrl: row.candidate.record.googleNewsUrl,
        urlResolved: false,
        urlResolutionStatus: "failure",
      },
      { failureCategory: "network", requests: [] },
      true,
    );
    const incompleteAudit = buildRowAudit(row, undefined, undefined, false);

    expect(successAudit.validSuccess).toBe(true);
    expect(successAudit).not.toHaveProperty("failureCategory");
    expect(failedAudit.failureCategory).toBe("network");
    expect(incompleteAudit.outcome).toBe("not_run_incomplete_matrix");
    expect(incompleteAudit).not.toHaveProperty("failureCategory");
  });

  it("sums failure categories across cells", () => {
    expect(
      aggregateFailures([
        { failuresByCategory: { network: 2, timeout: 1 } },
        { failuresByCategory: { network: 3, other: 1 } },
      ]),
    ).toEqual({ network: 5, timeout: 1, other: 1 });
  });
});
