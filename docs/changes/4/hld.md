# High-Level Design: Publisher URL Resolution

## Addendum: Mandatory Representative Live Gate (2026-09-28)

Issue #4 now requires at least 95 valid publisher URL successes from exactly 100 retained rows: five broad queries, two English editions (GB and US), and ten rows per query/edition cell. This external gate is separate from mocked tests and `npm run validate`; an incomplete or sub-threshold sample keeps Issue #4 and PR #11 on hold/draft.

Use this fixed matrix for the first run and every rerun:

| Query        | GB edition | US edition |
| ------------ | ---------: | ---------: |
| `world news` |         10 |         10 |
| `politics`   |         10 |         10 |
| `business`   |         10 |         10 |
| `technology` |         10 |         10 |
| `health`     |         10 |         10 |

Run GB with `language=en-GB`, `country=GB`, and US with `language=en-US`, `country=US`. Set `maxItemsPerQuery=10`, `dedupe=false`, `resolvePublisherUrls=true`, and use the same collection date range/configuration for all cells in a run. Record the exact inputs and UTC collection time in a run manifest. Do not substitute rows between cells; fewer than ten retained rows in any cell makes the sample incomplete.

A row counts as a success only when it has `urlResolved=true`, success status, preserved `googleNewsUrl`, a parseable HTTP(S) `publisherUrl` on a non-Google publisher host, and `publisherDomain` equal to the parsed lowercased hostname. Reject Google-owned hosts, consent/captcha/interstitial destinations, malformed URLs, and ambiguous targets. Do not count a Google News redirect or an asset URL as a publisher URL. Report the total denominator and successes by cell; a run passes only with all 100 retained rows and at least 95 valid successes.

This matrix is the external capability gate, not an algorithm assumption. The three earlier BBC/Telegraph/Reuters failures are a small smoke observation and do not establish failure prevalence. No resolver strategy change is justified until the representative sample supplies a failure distribution.

## Summary

Issue #4 adds a bounded publisher URL resolution stage for retained Google News RSS records. The stage preserves the original Google News URL and discovery metadata, reports a per-row outcome, and allows one failed resolution to coexist with successful results for other rows.

## Current State

`retrieveGoogleNewsArticles` parses RSS, applies per-query limits and optional deduplication, and returns records containing `query`, `title`, `googleNewsUrl`, and optional source/date/snippet fields. `index.ts` currently logs the record count; it does not resolve publisher URLs or write dataset rows. `resolvePublisherUrls` already defaults to true.

Current `/rss/articles/{id}` links remain on a Google News HTML page when followed with ordinary redirects. A bounded sample page contained article-bound `data-n-a-id`, `data-n-a-ts`, and `data-n-a-sg` attributes, while the inspected canonical, Open Graph, anchor, and JSON-LD fields did not identify the publisher URL. The opaque ID did not decode directly to an HTTP URL.

## Requirements

### Functional Requirements

- Attempt resolution for each retained record when `resolvePublisherUrls` is true.
- Return every record in input order with its original `googleNewsUrl` and existing discovery fields.
- Add `urlResolved` and `urlResolutionStatus`, with status values `success`, `failure`, and `not_requested`.
- On success, add `publisherUrl` and `publisherDomain`; derive the latter from the lowercased URL hostname.
- On failure, preserve provenance and continue processing other rows and the Actor run.
- When resolution is disabled, make no publisher-resolution HTTP requests and emit `not_requested` for every row.

### Constraints and Important Conditions

- Use native HTTP Fetch and URL handling; no browser rendering, proxies, paid extraction APIs, paywall bypass, or new runtime service.
- Do not fetch publisher page bodies. Only fetch Google News resolution inputs and the decoder response.
- Bound each row by a 10 second overall deadline, five redirects, and a 2 MiB cap per response; cap concurrent rows at four.
- Only accept HTTP(S) Google News input URLs and HTTP(S) publisher result URLs. Do not infer publisher URLs from generic external page links or assets.
- Keep full-text extraction and dataset delivery outside Issue #4.

## Expected Outcome

### Before/After

Before, retained records contain only Google News discovery metadata. After, each retained record has a resolution outcome and, when successful, its publisher URL and domain. The original Google News URL remains available for provenance and fallback.

## Proposed Design

### High-Level Flow

`Actor input → validation → RSS retrieval, limiting and dedupe → ordered per-row publisher resolution → existing processing/logging`

When disabled, the resolver maps rows to `not_requested` without calling Fetch. When enabled, each row is handled independently. A validated off-Google-News redirect target can resolve directly. If the Google News response remains on Google News, parse the article ID, timestamp, and signature markers from the bounded HTML response and submit the source-backed `Fbv4je` / `garturlreq` request to Google News `batchexecute`. Parse the framed response for `garturlres`, validate the resulting publisher URL, and derive its hostname. Any missing, malformed, or unsuccessful step becomes a row-level failure.

## Backend Changes

Add a typed publisher URL resolver and ordered bounded batch mapper. Integrate it after RSS retrieval and before the current processing seam. Keep all resolver HTTP and parser failures inside the row result; expose detailed failure reasons to internal diagnostics without adding an unapproved public row field.

## UI and User Experience Changes

None. This Actor has no user interface. The dataset-facing row contract is described under Data and State.

## Data and State

The enriched row retains `query`, `title`, `sourceName`, `publishedAt`, `googleNewsUrl`, and `snippet` when present. It adds `urlResolved:boolean` and `urlResolutionStatus` with the values above. Successful rows also include `publisherUrl` and `publisherDomain`. Failed and not-requested rows omit publisher fields. `urlResolved` is true exactly when status is `success` and a validated publisher URL/domain are present.

## Interfaces and Integrations

The resolver accepts a discovery record and an injectable Fetch implementation and returns an enriched record. The batch mapper accepts the resolution flag, preserves ordering, bounds concurrency, and returns one enriched row per input row. Use native Fetch, `AbortSignal` deadlines, `URL`, and bounded response reading. No new package is required.

The modern Google News decoder flow is supported by the current public source implementation `SSujitX/google-news-url-decoder`, especially `new_decoderv3.py` (page parameter extraction and `Fbv4je` request construction). It is an undocumented Google endpoint, not an official API. The source specifies a form key `f.req` whose value is URL-encoded JSON; preserve the literal key during encoding.

## Error and Edge-Case Behaviour

- Invalid or non-Google-News input URL: failure, with original URL preserved.
- Redirect loop, invalid/missing location, unsupported scheme, excessive redirects, timeout, network failure, or Google-only completion: failure for that row.
- Missing/mismatched article metadata, non-success decoder response, malformed framed JSON, or invalid publisher result: failure for that row.
- A valid HTTP(S) publisher URL is successful without fetching its content. `publisherDomain` is its lowercased hostname; do not strip `www` or guess a canonical host.
- Always continue with the next row after a row-level failure.

## Validation Considerations

Cover direct redirect success and decoder RPC success, URL/domain/status consistency, original URL preservation, a failed row beside a successful row, disabled zero-call behavior, and malformed/oversized/timeout responses. A live current-link smoke check should verify the exact form encoding and successful `garturlres` parsing before the method is described as operationally proven.

## Open Questions

The live RPC success path remains to be verified. Earlier bounded POST probes returned 400 because they encoded the literal `f.req` form key incorrectly; they do not establish endpoint failure. Validation must confirm the corrected request against a current link. The endpoint and page marker format may change without notice.

## Design Summary

Use a new fail-soft resolver boundary between RSS retrieval and existing processing. Preserve provenance, status every row, use the bounded source-backed HTTP decoder for current opaque IDs, and never claim success unless a validated publisher URL is returned.

## Approval

Authorized for implementation by the user's request to proceed with Issue #4. The implementation must resolve the live RPC check as a validation risk and report any failure without weakening row-level fallback behavior.
