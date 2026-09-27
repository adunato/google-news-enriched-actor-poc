# Implementation Plan: Publisher URL Resolution

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
