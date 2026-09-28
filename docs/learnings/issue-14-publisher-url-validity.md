# Learning Record

**Learning ID:** google-news-enriched-actor-poc--issue-14--publisher-url-validity

**Origin repository:** adunato/google-news-enriched-actor-poc

**Source:** GitHub Issue #14

**Lifecycle stage / skill:** Technical Discovery / `technical-discovery`

**Date:** 2026-09-28

**Category:** Product

**SideGig review:** No

**Disposition:** Captured

## Change context

Issue #14 investigated whether Google News RSS links could be resolved to publisher article URLs using bounded HTTP requests in local Node.js and the intended Apify Node.js runtime. The discovery needed to establish whether the downstream publisher URL resolution work could rely on a target of at least 95 valid publisher articles per 100 rows. The probe retained the original Google News article ID for marker matching, but did not compare publisher page content with the originating story.

## Observation

A decoded destination that passes an HTTP(S), non-Google host check is only a syntactic candidate. Publisher access and article identity are separate outcomes and need their own evidence. In this sample, all 100 hosted rows produced candidate destinations, while only 77 returned HTTP 200 HTML with an article-like marker, and none were checked against the originating story. Product acceptance for publisher URL resolution should distinguish these stages instead of treating a decoded URL as a valid publisher article.

## Evidence

The fixed 100-row matrix was replayed in an Apify Linux Node.js 20 runtime. Marker plus RPC produced 100/100 syntactic non-Google destinations. A bounded GET to each destination returned 77 HTTP 200 HTML responses with an article-like marker, 20 HTTP errors (13 HTTP 403, 5 HTTP 401 and 2 HTTP 405), and 3 HTTP 200 HTML responses without that marker. The article-like marker was a shallow heuristic, and no publisher page was compared with its source Google News story. The discovery therefore concluded `Inconclusive` against the 95/100 valid publisher article target.

## Impact

If downstream product decisions count decoded destinations as resolved articles, they can overstate the reliability of the feature and unblock dependent work without evidence that pages are accessible or correspond to the intended stories. Keeping syntax, accessibility and identity evidence distinct makes the acceptance threshold meaningful.

## Local action

None. The discovery recommends keeping Issue #4 blocked until publisher article identity is verified under the approved HTTP-only limits. No Product or Architecture definition change was justified by this evidence.

## Cross-project relevance

None. This lesson concerns the Google News publisher URL resolution capability and its product acceptance evidence.

## Stable local references

- [GitHub Issue #14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14)
- `docs/changes/14/technical-discovery.md`
- `docs/changes/14/hosted-probe-results.json`
- `docs/changes/14/hosted-probe-handoff.md`
