# Implementation Plan: Publisher URL Resolution

## Addendum: Early Feasibility Gate and Executable Sample (2026-09-28)

The Issue #4 acceptance criterion now requires **at least 95 valid publisher URLs from exactly 100 retained rows** across the fixed matrix below. This live gate is independent of mocked tests and CI. Do not treat the earlier three-link BBC/Telegraph/Reuters smoke as representative evidence.

| Query        | GB (`en-GB`, `GB`) | US (`en-US`, `US`) |
| ------------ | -----------------: | -----------------: |
| `world news` |                 10 |                 10 |
| `politics`   |                 10 |                 10 |
| `business`   |                 10 |                 10 |
| `technology` |                 10 |                 10 |
| `health`     |                 10 |                 10 |

### Procedure

1. Freeze the matrix above before the first run. For each edition, call the existing retrieval export with the five queries, `maxItemsPerQuery=10`, `dedupe=false`, resolution enabled, and the same date range for the full run. Record the exact accepted input values and collection UTC time. Require ten retained rows in each of the ten cells; do not replace missing rows from another cell.
2. Resolve the 100 collected rows through the existing resolver export in original order. Use the resolver's current 10-second per-row deadline, 2 MiB per-response cap, five-redirect limit, and concurrency cap of four. The harness calls retrieval/resolution exports directly; it does not invoke Actor persistence or write to a dataset (Issue #6 scope).
3. Before this run, add only the internal diagnostic visibility needed to classify failures if it cannot be captured reliably at the injected Fetch seam. Keep it out of the public row fields. Record per row/cell outcome, resolution stage, bounded failure category, response status/host class, and elapsed time/bytes where available. Never retain response bodies or article text in the report.
4. Count a success only if `urlResolved=true`, status is success, `googleNewsUrl` remains present, `publisherUrl` parses as HTTP(S) and is not a Google-owned, consent, captcha, or interstitial target, and `publisherDomain` equals the lowercased parsed hostname. Treat malformed, unresolved, ambiguous, Google-host, and consent/interstitial outcomes as failures.
5. Record a compact run manifest with commit SHA, UTC time, Node version, exact query/locale/configuration, per-cell retained counts, total denominator, successful count, failures by cell/category, and bounded request metrics. Keep row-level evidence sufficient to audit classification without including raw HTML/RPC bodies; attach a durable summary under `docs/changes/4/`.
6. If fewer than 100 rows are available, any cell is incomplete, or valid successes are below 95, the gate fails. Keep Issue #4 and PR #11 draft/on hold. Use the measured failure categories to make the smallest HTTP-first correction, add focused regression coverage, then rerun the **same matrix** against the new exact commit. If the gate passes, record the evidence and continue normal validation; do not merge or promote as part of this gate.

This sample is safe to run before an algorithm change. The present implementation and green CI do not prove current Google News compatibility, but no evidence yet justifies changing the resolver strategy before measuring the matrix. Measurement-only diagnostic instrumentation is permitted; dataset/public-schema work is not. If the current implementation returns a generic failure without a classifiable stage, add an internal diagnostic callback/result that does not alter the public row shape, then run the sample.

### Failure Categories

Use at least: `consent_or_interstitial`, `invalid_publisher_url`, `google_host`, `metadata_missing_or_mismatch`, `rpc_http_error`, `rpc_parse_or_result_error`, `timeout`, `network`, `redirect_limit`, and `other`. Record HTTP status and host class when observed. A category is diagnostic evidence; it does not make the row successful.

### Gate Status

The required matrix ran at `2026-09-28T06:41:40.589Z` against commit `953281a584ee3490d29fc7d49f90bffd7421d995`. It retained 100/100 rows (10 in every cell) and produced 0 valid publisher URLs; all 100 failures were classified as `consent_or_interstitial`. The sample is recorded in `docs/changes/4/live-sample.json`. The gate is **hold** because the threshold is at least 95/100; do not treat mocked success or automated validation as a live pass.

## Implementation Summary

Add a native Fetch based publisher resolver for each retained Google News record, preserve all discovery data, and integrate row-level success/failure/not-requested outcomes into the existing processing flow.

## HLD Reference

`docs/changes/4/hld.md` — required. It defines the row contract, decoder flow, limits, and fail-soft invariants.

## Repository Assessment

`src/input.ts` already validates `resolvePublisherUrls` and defaults it to true. `src/google-news.ts` returns discovery records and has an injectable Fetch seam, a 10 second request timeout, a 2 MiB bounded reader, and ordered query processing. `src/index.ts` retrieves records then invokes the current logging processor. Existing tests cover input and RSS retrieval but not publisher resolution. `package.json` exposes `vitest run` and `npm run validate` (format, lint, typecheck, tests, build).

## Implementation Approach

Add an enriched record type and resolver module. Keep single-row request/parse failures local; use an ordered bounded mapper for retained records. Disabled mode creates not-requested outcomes without invoking Fetch. Enabled mode first validates the Google News URL, handles bounded redirects, then uses article ID/signature/timestamp metadata and the source-backed `Fbv4je` request when the response remains on Google News. A successful result must be an HTTP(S) URL outside the Google News host. Do not fetch publisher bodies or expose unapproved failure-reason fields.

## Implementation Sequence

1. Add resolver types and pure helpers for URL validation, page marker extraction, `f.req` construction, and framed decoder response parsing.
2. Add bounded single-row resolution with one 10 second deadline, a five-redirect limit, and 2 MiB per-response cap. Cancel unused bodies.
3. Add an ordered mapper with concurrency capped at four and per-row failure conversion.
4. Integrate the mapper after `retrieveGoogleNewsArticles` and before the existing processing/logging seam; preserve input ordering and every discovery field.
5. Add focused tests for direct redirect and decoder success, per-row failure isolation, disabled zero requests, and parser/bound failures.
6. Update `docs/architecture.md` if implementation establishes the resolver method as current architecture; retain its undocumented-endpoint maintenance risk.

## Development Integrity Checks

Run repository formatting, lint, typecheck, unit tests, and build through `npm run validate` after implementation. A current-link live smoke check is required to resolve the known protocol risk; keep its request bounded and do not return page content or article text.

## Validation Requirements

### Unit

- Direct redirect and modern RPC paths yield success, `urlResolved:true`, valid HTTP(S) `publisherUrl`, and lowercased `publisherDomain`.
- Network, HTTP, timeout, redirect, marker, and response-parse failures yield failure while preserving the Google News URL.
- One failed record does not prevent adjacent records from completing; output order and discovery fields remain unchanged.
- Disabled mode yields not_requested and an injected Fetch spy records zero calls.
- Oversized response and deadline/redirect bounds are enforced.

### End-to-End

- Run the Actor against mocked RSS and decoder HTTP responses to confirm RSS retrieval → resolver → processing data flow.
- **Current-link smoke outcome:** The bounded live checks did not establish a successful resolution. Three current publisher links (BBC, Telegraph, Reuters) returned failure; the BBC request redirected to `consent.google.com` before article markers could be retrieved. The decoder success path remains unverified against a current link.

### Other

- Run `npm run validate`.
- Review the durable architecture update for consistency with the implemented request flow and limits.

## Open Implementation Questions

- The documented upstream decoder request uses a literal form key `f.req` and URL-encodes only its JSON value. A live successful decode is not yet verified; confirm during implementation/validation and report any endpoint drift.
- Ensure response reader cancellation and deadline cleanup behave correctly for redirects and malformed responses.

## Low-Level Design Decision

**LLD required: Yes.** The exact form encoding, three-level nested request JSON, article marker binding, framed response parsing, redirect/deadline interaction, and cross-file typed row changes are brittle file-level details. Record these in `docs/changes/4/low-level-design.md` before coding.

## Implementation Checklist

- [x] Resolver module and types added
- [x] Bounded ordered row mapping integrated
- [x] Success, failure, and not-requested tests added
- [ ] Corrected current-link RPC smoke result recorded
- [x] Architecture definition reconciled if required
- [x] `npm run validate` passes

**Implementation status:** The resolver module and types are implemented. `npm run validate` passed formatting, lint, typecheck, 53 tests, and build. The live success check remains open as recorded above.

## Approval

Proceed under the user's authorization to implement Issue #4. Escalate only if the corrected source-backed request cannot be made to work within the existing HTTP-first product boundary.
