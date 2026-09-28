# Learning Record

**Learning ID:** google-news-enriched-actor-poc--issue-18--pin-public-http-destinations

**Origin repository:** adunato/google-news-enriched-actor-poc

**Source:** GitHub Issue #18

**Lifecycle stage / skill:** Technical Discovery / `technical-discovery`

**Date:** 2026-09-28

**Category:** Methodology

**SideGig review:** Yes

**Disposition:** Captured

## Change context

Issue #18 tested whether publisher URLs discovered from Google News could be checked for accessibility and story identity using bounded HTTP requests. Publisher destinations and redirect locations came from external content and therefore could direct the probe to unintended network destinations. The investigation was restricted to HTTP(S), bounded requests, per-row failure isolation, and no browser rendering or proxy services.

## Observation

For HTTP probes that follow externally supplied URLs, checking DNS answers before a request is insufficient if the HTTP client performs a second lookup when opening the connection. Resolve and classify the complete A/AAAA answer set, reject non-public destinations, and pin the validated addresses to the connection. Follow redirects manually and repeat validation and pinning for every new target. This closes the DNS time-of-check/time-of-use gap exercised in this probe; it does not replace network-layer egress controls.

## Evidence

An earlier Issue #18 hosted run was superseded because it checked DNS before fetch but did not pin the validated answers to the socket. The final probe uses `ipaddr.js@2.2.0` to classify resolved addresses, a custom Node.js `http`/`https` lookup to reuse the validated set, and manual redirect handling that validates each next URL. Focused safety tests cover special/private IPv4 and IPv6 ranges, private DNS results, a redirect to loopback, and reuse of pinned answers. The final Apify Node 20 run completed the frozen 100-row sample with 76 strict confirmed publisher-article successes; this result concerns the discovery threshold and is independent of the address-pinning safety evidence.

## Impact

A preflight-only check can approve a hostname whose later DNS answer points to a private or special destination. The same gap can recur in crawlers, URL previewers, webhook testers, and other systems that fetch external URLs. Per-redirect checks are needed because a public page can redirect to a different host or address.

## Local action

Issue #18's discovery probe implements public-address validation, pinned Node.js lookups, and manual redirect validation in `docs/changes/18/probe-network.mjs`; focused coverage is in `docs/changes/18/probe-safety.test.mjs`. This is discovery tooling, not a production resolver change.

## Cross-project relevance

This pattern may apply to shared HTTP-probing skills, templates, or tooling used across SideGig projects that fetch externally supplied URLs. SideGig review can assess whether canonical guidance should require connection-pinned DNS validation and per-redirect revalidation. The record makes no claim that every HTTP client or network policy is covered by these tests.

## Stable local references

- [GitHub Issue #18](https://github.com/adunato/google-news-enriched-actor-poc/issues/18)
- `docs/changes/18/technical-discovery.md`
- `docs/changes/18/probe-network.mjs`
- `docs/changes/18/probe-safety.test.mjs`
- `docs/changes/18/hosted-run-metadata.json`
- `docs/learnings/issue-14-publisher-url-validity.md` (related URL validity and identity lesson)
