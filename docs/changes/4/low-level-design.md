# Low-Level Design: Publisher URL Resolution

## Addendum: Live Sample Harness and Diagnostic Contract (2026-09-28)

The Issue acceptance gate is 95 valid resolutions out of 100 retained rows across the fixed matrix in `hld.md` and `implementation-plan.md`. The harness must run before any substantial resolver algorithm change, call the retrieval and resolver exports directly, and avoid Actor dataset delivery.

The current resolver output exposes only `success`, `failure`, or `not_requested`; it has no failure reason field. Add a measurement-only internal diagnostic path (for example, an optional callback or a detailed internal result) that reports row index/cell, stage, bounded reason category, observed HTTP status, final host class, elapsed time, and response bytes. Do not add diagnostic fields to public enriched rows or persist response bodies. Keep the existing public resolver result and order unchanged.

Use categories `consent_or_interstitial`, `invalid_publisher_url`, `google_host`, `metadata_missing_or_mismatch`, `rpc_http_error`, `rpc_parse_or_result_error`, `timeout`, `network`, `redirect_limit`, and `other`. Derive a success independently from output fields: `urlResolved===true`, successful status, unchanged `googleNewsUrl`, valid HTTP(S) `publisherUrl` outside Google/consent/interstitial hosts, and `publisherDomain` equal to the parsed lowercased host. Ambiguous results count as failure until manually resolved under the stated predicate.

The harness manifest pins the code SHA and UTC run time, captures all ten matrix cells and input settings, requires exactly ten rows in every cell, and summarizes denominator, successes, failures per cell/category, timing, and response limits. It must not collapse records across cells or fill a short cell from another query. Record only minimal row audit data (cell, ordinal or stable hash, outcome, publisher host class/domain, and category); exclude article text and raw HTML/RPC bodies.

The present evidence supports running this sample against the current resolver before changing its algorithm. If measurement shows fewer than 95 valid rows or an incomplete matrix, leave Issue #4 and PR #11 on hold/draft; classify the failure distribution, make a targeted bounded HTTP-first correction, and rerun the identical matrix against the resulting commit.

## Change Overview

Implement a typed per-row resolver using native Fetch and integrate it between RSS retrieval and the current processing seam. Preserve Google News provenance, row ordering, bounded resource use, and failure isolation.

## File Changes

### `src/publisher-url.ts`

**Action:** Add.

**Responsibilities:**

- Export an enriched article type extending the discovery record with `urlResolved`, `urlResolutionStatus`, and optional `publisherUrl`/`publisherDomain`.
- Export a single-row resolver that accepts an injectable Fetch implementation and produces an enriched result even when resolution fails.
- Validate the input host as Google News and schemes as HTTP(S). Extract the opaque article ID from the supported RSS article path.
- Follow at most five Google News redirects manually under one 10 second row deadline. If a validated non-Google-News HTTP(S) redirect target is reached, return it as the publisher URL without fetching the publisher body.
- If the response remains on Google News, read at most 2 MiB, extract `data-n-a-id`, `data-n-a-ts`, and `data-n-a-sg` from the relevant article metadata element, and verify the ID is tied to the input article.
- Construct the `Fbv4je` / `garturlreq` nested JSON request. Form-encode only the JSON value and preserve the literal `f.req` key. Use a bounded POST to `https://news.google.com/_/DotsSplashUi/data/batchexecute`.
- Parse the bounded framed response for `garturlres`, validate the result as an HTTP(S) non-Google-News URL, and derive `publisherDomain` from lowercased `URL.hostname`.
- Convert all thrown request and parse errors to an internal failure result. Do not expose a separate public failure-reason field.
- Export an ordered batch resolver with concurrency capped at four; a disabled flag maps every row to `not_requested` without calling Fetch.

### `src/index.ts`

**Action:** Update.

**Responsibilities:**

- Call the batch resolver immediately after `retrieveGoogleNewsArticles` and before the existing processing/logging call.
- Pass `input.resolvePublisherUrls` and the injectable Fetch seam where appropriate.
- Preserve order and ensure a resolver failure never rejects the Actor run.

### `src/input.ts`

**Action:** Update only if required by the processing boundary.

**Responsibilities:**

- Adjust processing types to accept enriched records if the existing `processActorInput` seam is extended to receive records.
- Retain input validation and defaults without changing unrelated options.

### `src/publisher-url.test.ts`

**Action:** Add.

**Responsibilities:**

- Test direct redirect and decoder RPC success, including status/URL/domain consistency.
- Test a row failure beside an independent successful row and provenance preservation.
- Test disabled mode with a Fetch spy proving zero calls and explicit not-requested status.
- Test invalid/missing markers, malformed framed response, oversized response, redirect limit, and deadline/network failure as row-local failures.
- Assert discovery metadata and ordered output are preserved.

### `src/index.test.ts`

**Action:** Extend if orchestration assertions are not naturally covered by resolver tests.

**Responsibilities:**

- Verify the Actor path passes retained RSS records through resolution before processing and honors the disabled flag.

### `docs/architecture.md`

**Action:** Reconcile after implementation if the previously open resolver method is now durable current architecture.

**Responsibilities:**

- Record the actual HTTP resolution flow, row status behavior, bounds, and internal endpoint maintenance risk without expanding product scope.

## Cross-File Dependencies

- `publisher-url.ts` consumes the `GoogleNewsArticleRecord` contract from `google-news.ts` and returns its enriched extension.
- `index.ts` is the orchestration boundary and passes records to downstream processing.
- `input.ts` changes only if its current processor signature needs to receive rows.
- Tests use injected Fetch responses to cover redirects, article metadata, form requests, and framed decoder results without relying on live network calls.
- Architecture documentation follows implemented behavior and does not lead the code to a new product boundary.

## File Change Summary

| File                        | Action             | Responsibility                                                  |
| --------------------------- | ------------------ | --------------------------------------------------------------- |
| `src/publisher-url.ts`      | Add                | Typed single-row resolver and bounded ordered mapper            |
| `src/index.ts`              | Update             | Integrate resolution in the Actor flow                          |
| `src/input.ts`              | Conditional update | Adapt processing contract if rows are passed through it         |
| `src/publisher-url.test.ts` | Add                | Resolver success, failure, bounds, and disabled behavior        |
| `src/index.test.ts`         | Conditional update | Orchestration order/flag behavior                               |
| `docs/architecture.md`      | Reconcile          | Persist implemented resolver architecture if materially changed |
