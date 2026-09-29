/* global URL:readonly */
import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";
import { getDomain } from "tldts";

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function googleNewsUrlHashMatches(googleNewsUrl, articleIdHash) {
  return (
    typeof googleNewsUrl === "string" &&
    typeof articleIdHash === "string" &&
    sha256(googleNewsUrl).slice(0, 16) === articleIdHash
  );
}

export function h4Verdict(priorConfirmed, newlyVerified, contradicted) {
  const totalSupported = priorConfirmed + newlyVerified;
  const supported = newlyVerified >= 16 && totalSupported >= 95 && contradicted === 0;
  return {
    status: supported ? "supported" : "not_supported",
    priorConfirmed,
    newlyVerified,
    totalSupported,
    contradicted,
    requiredNew: 16,
    requiredTotal: 95,
    reasons: [
      ...(newlyVerified < 16 ? ["fewer_than_16_newly_verified"] : []),
      ...(totalSupported < 95 ? ["fewer_than_95_total_supported"] : []),
      ...(contradicted > 0 ? ["article_id_binding_contradiction"] : []),
    ],
  };
}

export function normalizeHost(value) {
  try {
    const raw = value.includes("://") ? new URL(value).hostname : value;
    const ascii = domainToASCII(raw.toLowerCase().replace(/\.$/, ""));
    return ascii.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function registrableDomain(value) {
  const host = normalizeHost(value);
  if (!host) return null;
  return getDomain(host, { allowPrivateDomains: false }) ?? null;
}

export function titleTokens(value) {
  return new Set(
    String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [],
  );
}

export function pathTokens(value) {
  try {
    const path = decodeURIComponent(new URL(value).pathname);
    return new Set(
      [...titleTokens(path.replace(/[._~/-]+/g, " "))].filter(
        (token) => /\p{L}/u.test(token) && !["article", "news", "story", "read"].includes(token),
      ),
    );
  } catch {
    return new Set();
  }
}

export function pathCorrespondence(title, candidateUrl) {
  const titleSet = titleTokens(title);
  const urlSet = pathTokens(candidateUrl);
  if (titleSet.size < 2 || urlSet.size < 2) {
    return { determinate: false, matched: 0, titleTokenCount: titleSet.size, score: 0 };
  }
  const matched = [...titleSet].filter((token) => urlSet.has(token)).length;
  return {
    determinate: true,
    matched,
    titleTokenCount: titleSet.size,
    score: matched / titleSet.size,
  };
}

export function sourceDomainMatches(sourceHost, candidateUrl, aliases = {}) {
  const source = registrableDomain(sourceHost);
  const target = registrableDomain(candidateUrl);
  if (!source || !target) return false;
  const allowed = new Set([source, ...(aliases[source] ?? [])]);
  return allowed.has(target);
}

function normalizedControlTitle(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function makeNegativeControls(positiveRows, aliases = {}) {
  const usableRows = positiveRows.filter(
    (row) =>
      row.hashStable === true &&
      row.candidateUrl &&
      row.title &&
      sourceDomainMatches(row.sourceHost, row.candidateUrl, aliases),
  );
  const byDomain = new Map();
  const orderedRows = [...usableRows].sort((a, b) => a.rowId.localeCompare(b.rowId));
  for (const row of orderedRows) {
    const domain = registrableDomain(row.sourceHost);
    if (!domain) continue;
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push(row);
  }
  const controlsByPair = new Map();
  const addControl = (row, selected, samePublisher) => {
    const title = selected.title;
    const normalizedTitle = normalizedControlTitle(title);
    if (!normalizedTitle || normalizedTitle === normalizedControlTitle(row.title)) return;
    const control = {
      controlId: `negative-${sha256(`${row.rowId}\0${title}`).slice(0, 16)}`,
      type: samePublisher ? "same_publisher_title_swap" : "known_positive_corpus_title_swap",
      sourceHost: row.sourceHost,
      title,
      candidateUrl: row.candidateUrl,
      originalPositiveRowId: row.rowId,
      aliasMatch: true,
    };
    const pairKey = sha256(`${sha256(row.candidateUrl)}\0${normalizedTitle}`);
    const existing = controlsByPair.get(pairKey);
    if (!existing || (existing.type !== "same_publisher_title_swap" && samePublisher)) {
      controlsByPair.set(pairKey, control);
    }
  };
  const choicesFor = (row) => {
    const domain = registrableDomain(row.sourceHost);
    const samePublisherRows = (byDomain.get(domain) ?? []).filter(
      (other) =>
        other.rowId !== row.rowId &&
        normalizedControlTitle(other.title) !== normalizedControlTitle(row.title),
    );
    const samePublisherTitles = new Set(
      samePublisherRows.map((other) => normalizedControlTitle(other.title)),
    );
    const corpusRows = orderedRows.filter(
      (other) =>
        other.rowId !== row.rowId &&
        normalizedControlTitle(other.title) !== normalizedControlTitle(row.title) &&
        !samePublisherTitles.has(normalizedControlTitle(other.title)),
    );
    return [
      ...samePublisherRows.map((selected) => ({ selected, samePublisher: true })),
      ...corpusRows.map((selected) => ({ selected, samePublisher: false })),
    ];
  };

  for (const row of orderedRows) {
    const choice = choicesFor(row)[0];
    if (choice) addControl(row, choice.selected, choice.samePublisher);
  }

  // A fixed corpus may repeat the same candidate/title pairing across rows.
  // Add deterministic alternate real titles until the distinct-pair gate is met.
  if (controlsByPair.size < 76) {
    for (const row of orderedRows) {
      for (const choice of choicesFor(row)) {
        const before = controlsByPair.size;
        addControl(row, choice.selected, choice.samePublisher);
        if (controlsByPair.size >= 76) break;
        if (controlsByPair.size === before) continue;
      }
      if (controlsByPair.size >= 76) break;
    }
  }
  return [...controlsByPair.values()];
}

export function decideCalibration(positiveRows, aliases = {}) {
  const positives = positiveRows.map((row) => ({
    rowId: row.rowId,
    hashStable: row.hashStable === true,
    binding: row.binding,
    domainMatch: sourceDomainMatches(row.sourceHost, row.candidateUrl, aliases),
    correspondence: pathCorrespondence(row.title, row.candidateUrl),
  }));
  const controls = makeNegativeControls(positiveRows, aliases).map((control) => ({
    controlId: control.controlId,
    type: control.type,
    binding: true,
    domainMatch: control.aliasMatch,
    correspondence: pathCorrespondence(control.title, control.candidateUrl),
  }));
  const candidateScores = positives
    .filter(
      (x) =>
        x.hashStable &&
        x.binding &&
        x.domainMatch &&
        x.correspondence.determinate &&
        x.correspondence.matched >= 2,
    )
    .map((x) => x.correspondence.score)
    .sort((a, b) => b - a);
  if (candidateScores.length < 76) {
    return {
      ok: false,
      reason: "fewer_than_76_eligible_positive_controls",
      eligiblePositiveControls: candidateScores.length,
    };
  }
  if (controls.length < 76) {
    return {
      ok: false,
      reason: "fewer_than_76_unique_negative_control_pairs",
      uniqueNegativeControlPairs: controls.length,
    };
  }
  const threshold = candidateScores[75];
  const positiveAccepted = positives.filter(
    (x) =>
      x.binding &&
      x.hashStable &&
      x.domainMatch &&
      x.correspondence.determinate &&
      x.correspondence.matched >= 2 &&
      x.correspondence.score >= threshold,
  ).length;
  const negativeAccepted = controls.filter(
    (x) =>
      x.binding &&
      x.domainMatch &&
      x.correspondence.determinate &&
      x.correspondence.matched >= 2 &&
      x.correspondence.score >= threshold,
  ).length;
  if (positiveAccepted < 76 || negativeAccepted !== 0) {
    return {
      ok: false,
      reason: negativeAccepted
        ? "negative_control_false_positive"
        : "positive_sensitivity_below_threshold",
      eligiblePositiveControls: candidateScores.length,
      positiveAccepted,
      negativeAccepted,
    };
  }
  return {
    ok: true,
    rule: {
      version: 1,
      minimumPositiveControls: 76,
      minimumMatchedTokens: 2,
      minimumTitleTokenCoverage: threshold,
      requireMarkerArticleIdBinding: true,
      requireSourceRegistrableDomainOrAlias: true,
      pathOnly: true,
      opaquePath: "indeterminate",
    },
    metrics: {
      positiveControls: positives.length,
      hashStablePositiveControls: positives.filter((x) => x.hashStable).length,
      eligiblePositiveControls: candidateScores.length,
      positiveAccepted,
      positiveSensitivity: positiveAccepted / positives.length,
      negativeControls: controls.length,
      uniqueNegativeControlPairs: controls.length,
      negativeAccepted,
      samePublisherNegativeControls: controls.filter((x) => x.type === "same_publisher_title_swap")
        .length,
      knownPositiveCorpusTitleSwaps: controls.filter(
        (x) => x.type === "known_positive_corpus_title_swap",
      ).length,
      falsePositiveRate: negativeAccepted / controls.length,
    },
  };
}

export function summarizePositiveControlFailure(rows, aliases = {}) {
  const positives = rows.filter((row) => row.knownPositive === true);
  const failureCounts = {};
  const requestErrorKinds = new Set([
    "timeout",
    "request_error",
    "body_limit",
    "redirect_limit",
    "unexpected_redirect_destination",
    "rpc_http_error",
    "rpc_destination_missing_or_invalid",
  ]);
  let candidateAvailable = 0;
  let historicalCandidateHashStable = 0;
  let bindingMatched = 0;
  let sourceDomainMatched = 0;
  let titlePathEligible = 0;
  let eligiblePositiveControls = 0;
  let requestErrors = 0;

  for (const row of positives) {
    if (row.candidateUrl) candidateAvailable++;
    if (row.historicalCandidateHashStable === true) historicalCandidateHashStable++;
    const binding = row.bindingStatus === "matched" && row.markerRpcBound === true;
    if (binding) bindingMatched++;
    const domain = sourceDomainMatches(row.sourceHost, row.candidateUrl, aliases);
    if (domain) sourceDomainMatched++;
    const correspondence = pathCorrespondence(row.title, row.candidateUrl);
    const titleEligible = correspondence.determinate && correspondence.matched >= 2;
    if (titleEligible) titlePathEligible++;
    if (row.historicalCandidateHashStable === true && binding && domain && titleEligible) {
      eligiblePositiveControls++;
    }

    if (row.failure) {
      const bucket = /^rpc_http_\d+$/.test(row.failure)
        ? "rpc_http_error"
        : [
              "timeout",
              "request_error",
              "body_limit",
              "redirect_limit",
              "unexpected_redirect_destination",
              "rpc_destination_missing_or_invalid",
              "marker_missing",
              "marker_article_id_mismatch",
              "input_article_id_hash_mismatch",
            ].includes(row.failure)
          ? row.failure
          : "other";
      failureCounts[bucket] = (failureCounts[bucket] ?? 0) + 1;
      if (requestErrorKinds.has(bucket)) requestErrors++;
    }
  }

  return {
    positiveControlsExpected: positives.length,
    positiveControlsWithCandidate: candidateAvailable,
    historicalCandidateHashStable,
    markerBindingMatched: bindingMatched,
    sourceDomainMatched,
    titlePathEligible,
    eligiblePositiveControls,
    requestErrors,
    failureReasonCounts: failureCounts,
  };
}

export function classifyCandidate(row, rule, aliases = {}) {
  if (
    row.bindingStatus === "mismatched" ||
    (row.articleIdHash && row.markerArticleIdHash && row.articleIdHash !== row.markerArticleIdHash)
  ) {
    return { status: "contradicted", reason: "article_id_binding_mismatch" };
  }
  if (row.bindingStatus !== "matched" || !row.markerRpcBound || !row.candidateUrl) {
    return { status: "unverifiable", reason: "required_candidate_or_article_id_binding_missing" };
  }
  const domainMatch = sourceDomainMatches(row.sourceHost, row.candidateUrl, aliases);
  const correspondence = pathCorrespondence(row.title, row.candidateUrl);
  if (
    domainMatch &&
    correspondence.determinate &&
    correspondence.matched >= rule.minimumMatchedTokens &&
    correspondence.score >= rule.minimumTitleTokenCoverage
  ) {
    return { status: "verified", reason: "frozen_domain_and_title_path_rule" };
  }
  return {
    status: "unverifiable",
    reason: !domainMatch
      ? "source_domain_not_bound"
      : !correspondence.determinate
        ? "opaque_or_insufficient_path"
        : "title_path_below_frozen_threshold",
  };
}
