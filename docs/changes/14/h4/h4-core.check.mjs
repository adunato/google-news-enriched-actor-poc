import assert from "node:assert/strict";
import test from "node:test";
import {
  decideCalibration,
  classifyCandidate,
  googleNewsUrlHashMatches,
  h4Verdict,
  makeNegativeControls,
  normalizeHost,
  pathCorrespondence,
  registrableDomain,
  sha256,
  sourceDomainMatches,
  summarizePositiveControlFailure,
} from "./h4-core.mjs";

test("input URL identity hashes the full exact Google News URL and rejects URL mutation", () => {
  const url = "https://news.google.com/rss/articles/article-123?oc=5&hl=en-GB&gl=GB";
  const fullUrlHash = sha256(url).slice(0, 16);
  const pathIdHash = sha256("article-123").slice(0, 16);
  assert.equal(googleNewsUrlHashMatches(url, fullUrlHash), true);
  assert.equal(googleNewsUrlHashMatches(url, pathIdHash), false);
  assert.equal(googleNewsUrlHashMatches(`${url}&changed=1`, fullUrlHash), false);
});

test("host normalization applies www and IDNA normalization before registrable-domain matching", () => {
  assert.equal(normalizeHost("https://WWW.Example.COM./news"), "example.com");
  assert.equal(registrableDomain("www.bbc.co.uk"), "bbc.co.uk");
  assert.equal(registrableDomain("https://xn--bcher-kva.example/story"), "xn--bcher-kva.example");
});

test("path correspondence uses normalized title tokens and leaves opaque paths indeterminate", () => {
  assert.deepEqual(
    pathCorrespondence("Café News: A Big Story", "https://example.com/cafe-news-big-story"),
    {
      determinate: true,
      matched: 2,
      titleTokenCount: 4,
      score: 0.5,
    },
  );
  assert.equal(
    pathCorrespondence("A useful title", "https://example.com/article/123456").determinate,
    false,
  );
});

test("registrable source domain and explicit aliases are required", () => {
  assert.equal(sourceDomainMatches("www.example.co.uk", "https://example.co.uk/story"), true);
  assert.equal(sourceDomainMatches("example.co.uk", "https://example.com/story"), false);
  assert.equal(
    sourceDomainMatches("example.co.uk", "https://example.com/story", {
      "example.co.uk": ["example.com"],
    }),
    true,
  );
});

test("controlled negatives preserve the destination publisher and introduce a wrong title", () => {
  const rows = [
    {
      rowId: "a",
      title: "alpha climate report",
      sourceHost: "news.example.com",
      candidateUrl: "https://news.example.com/alpha-climate-report",
      binding: true,
      hashStable: true,
    },
    {
      rowId: "b",
      title: "beta energy report",
      sourceHost: "news.example.com",
      candidateUrl: "https://news.example.com/beta-energy-report",
      binding: true,
      hashStable: true,
    },
  ];
  const negatives = makeNegativeControls(rows);
  assert.equal(negatives.length, 2);
  assert.equal(negatives[0].type, "same_publisher_title_swap");
  assert.notEqual(negatives[0].title, rows[0].title);
  assert.equal(negatives[0].aliasMatch, true);
});

test("calibration freezes a threshold only with at least 76 positive passes and zero negative passes", () => {
  const rows = Array.from({ length: 79 }, (_, i) => ({
    rowId: `p-${i}`,
    title: `distinct topic headline alpha${i}`,
    sourceHost: "news.example.com",
    candidateUrl: `https://news.example.com/distinct-topic-headline-alpha${i}`,
    binding: true,
    hashStable: true,
  }));
  const result = decideCalibration(rows);
  assert.equal(result.ok, true);
  assert.ok(result.metrics.positiveAccepted >= 76);
  assert.equal(result.metrics.negativeAccepted, 0);
  assert.equal(result.metrics.positiveControls, 79);
});

test("historical labels are excluded when the replayed candidate hash is not stable", () => {
  const rows = Array.from({ length: 79 }, (_, i) => ({
    rowId: `p-${i}`,
    title: `distinct topic headline alpha${i}`,
    sourceHost: "news.example.com",
    candidateUrl: `https://news.example.com/distinct-topic-headline-alpha${i}`,
    binding: true,
    hashStable: i < 75,
  }));
  const result = decideCalibration(rows);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "fewer_than_76_eligible_positive_controls");
  assert.equal(result.eligiblePositiveControls, 75);
});

test("fallback negatives use deterministic real positive-corpus titles", () => {
  const rows = [
    {
      rowId: "a",
      title: "alpha climate report",
      sourceHost: "news.alpha.example",
      candidateUrl: "https://news.alpha.example/alpha-climate-report",
      binding: true,
      hashStable: true,
    },
    {
      rowId: "b",
      title: "beta energy report",
      sourceHost: "news.beta.example",
      candidateUrl: "https://news.beta.example/beta-energy-report",
      binding: true,
      hashStable: true,
    },
  ];
  const first = makeNegativeControls(rows);
  const second = makeNegativeControls([...rows].reverse());
  assert.deepEqual(first, second);
  assert.equal(first[0].type, "known_positive_corpus_title_swap");
  assert.equal(first[0].title, rows[1].title);
  assert.equal(first[0].sourceHost, rows[0].sourceHost);
  assert.notEqual(first[0].title, rows[0].title);
  assert.equal(JSON.stringify(first).includes("unrelated controlled mismatch"), false);
});

test("calibration counts unique valid candidate/title pairs, not repeated controls", () => {
  const rows = Array.from({ length: 79 }, (_, i) => {
    const climate = i < 40;
    return {
      rowId: `p-${String(i).padStart(2, "0")}`,
      title: climate ? "climate report headline" : "energy market outlook",
      sourceHost: "news.example.com",
      candidateUrl: climate
        ? "https://news.example.com/climate-report-headline"
        : "https://news.example.com/energy-market-outlook",
      binding: true,
      hashStable: true,
    };
  });

  const controls = makeNegativeControls(rows);
  const result = decideCalibration(rows);
  assert.equal(rows.length, 79);
  assert.equal(controls.length, 2);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "fewer_than_76_unique_negative_control_pairs");
  assert.equal(result.uniqueNegativeControlPairs, 2);
});

test("deterministic alternate title swaps fill a duplicate-heavy set to 76 unique pairs", () => {
  const rows = [];
  for (let i = 0; i < 75; i++) {
    const group = String(i).padStart(2, "0");
    const row = {
      title: `climate news brief alpha${group}`,
      sourceHost: "news.example.com",
      candidateUrl: `https://news.example.com/climate-news-brief-alpha${group}`,
      binding: true,
      hashStable: true,
    };
    rows.push({ ...row, rowId: `p-${group}-a` });
    if (i === 0) {
      for (const suffix of ["b", "c", "d", "e"]) {
        rows.push({ ...row, rowId: `p-${group}-${suffix}` });
      }
    }
  }

  const controls = makeNegativeControls(rows);
  assert.equal(rows.length, 79);
  assert.equal(controls.length, 76);
  assert.equal(controls.filter((control) => control.candidateUrl.endsWith("alpha00")).length, 2);
  assert.ok(controls.every((control) => control.type === "same_publisher_title_swap"));
});

test("only affirmative article-ID mismatch is contradicted; missing evidence stays unverifiable", () => {
  const rule = { minimumMatchedTokens: 2, minimumTitleTokenCoverage: 0.5 };
  const base = {
    articleIdHash: "a",
    markerArticleIdHash: null,
    markerRpcBound: false,
    bindingStatus: "missing",
    candidateUrl: null,
  };
  assert.equal(classifyCandidate(base, rule).status, "unverifiable");
  assert.equal(
    classifyCandidate({ ...base, bindingStatus: "mismatched" }, rule).status,
    "contradicted",
  );
});

test("H4 verdict enforces both the 16 new and 95 total gates plus no binding contradiction", () => {
  assert.equal(h4Verdict(79, 15, 0).status, "not_supported");
  assert.deepEqual(h4Verdict(79, 16, 0), {
    status: "supported",
    priorConfirmed: 79,
    newlyVerified: 16,
    totalSupported: 95,
    contradicted: 0,
    requiredNew: 16,
    requiredTotal: 95,
    reasons: [],
  });
  assert.equal(h4Verdict(79, 16, 1).status, "not_supported");
});

test("failure diagnostics aggregate known positive controls only and retain no URLs or row IDs", () => {
  const unresolved = {
    knownPositive: false,
    get candidateUrl() {
      throw new Error("unresolved candidate was read");
    },
    get title() {
      throw new Error("unresolved title was read");
    },
    get sourceHost() {
      throw new Error("unresolved source was read");
    },
    rowId: "unresolved-secret-row-id",
  };
  const positives = [
    {
      knownPositive: true,
      rowId: "positive-row-id",
      title: "alpha climate report",
      sourceHost: "news.example.com",
      candidateUrl: "https://news.example.com/alpha-climate-report?private=value",
      bindingStatus: "matched",
      markerRpcBound: true,
      failure: null,
      historicalCandidateHashStable: true,
    },
    {
      knownPositive: true,
      rowId: "positive-timeout-row-id",
      title: "a timeout example",
      sourceHost: "news.example.com",
      candidateUrl: null,
      bindingStatus: "missing",
      markerRpcBound: false,
      failure: "timeout",
      historicalCandidateHashStable: false,
    },
    unresolved,
  ];
  const diagnostics = summarizePositiveControlFailure(positives);
  const serialized = JSON.stringify(diagnostics);
  assert.equal(diagnostics.positiveControlsExpected, 2);
  assert.equal(diagnostics.eligiblePositiveControls, 1);
  assert.equal(diagnostics.historicalCandidateHashStable, 1);
  assert.equal(diagnostics.requestErrors, 1);
  assert.equal(diagnostics.failureReasonCounts.timeout, 1);
  assert.equal(serialized.includes("private=value"), false);
  assert.equal(serialized.includes("row-id"), false);
  assert.equal(serialized.includes("unresolved-secret"), false);
});
