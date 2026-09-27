# Low-Level Design: Publisher URL Resolution

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
