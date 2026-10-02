# Implementation Plan: Publisher URL Resolution

**Artifact ID:** `implementation-plan-4-publisher-url-resolution`<br>
**Status:** `Approved`<br>
**Owner:** Project owner<br>
**Created / updated:** `2026-09-30`<br>
**GitHub Issue:** [#4](https://github.com/adunato/google-news-enriched-actor-poc/issues/4)<br>
**HLD reference:** `docs/changes/4/hld.md` — `hld-4-publisher-url-resolution`<br>
**Technical Spike:** Issue [#14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14), Feasible conclusion integrated by PR #21; `docs/changes/14/technical-spike.md`<br>
**Context references:** `docs/product.md` PR-006, PR-007, PR-010, PR-011, PR-013; `docs/architecture.md` Sections 3–5 and 8–9; `docs/changes/4/live-sample.json`

## 1. Implementation Summary

Carry internal Google News edition context from RSS discovery through deduplication and parameter-page acquisition. Use the fixed H5-tested `US:en` context for every `Fbv4je` / `garturlreq` RPC; do not derive RPC context from RSS edition. Preserve the existing public row contract, ordering, fail-soft behavior, and request bounds. The hosted known-positive `GB:en` q1 RPC result is limited corroboration and does not establish a general locale mapping. The mandatory fixed 100-row matrix remains required. Issue #4 remains unaccepted until the sample retains all 100 rows and yields at least 95 valid publisher URLs.

The independent publisher accessibility/title-confirmation evidence must be reported separately from resolver success. Do not fetch publisher pages as part of this work or attempt the access techniques assigned to Spike #22.

## 2. HLD Reference

The approved HLD `hld-4-publisher-url-resolution` constrains implementation to the article-ID-bound marker/RPC mechanism and owner-approved H5 success rule. Markers must match the source row's article ID; the RPC uses fixed `US:en` context for every row and must return a parseable non-Google HTTP(S) URL. Preserve the input Google News URL. Carry internal `{hl, gl, ceid}` from RSS request to parameter-page request and strip it before constructing the public result row. Record the actual RPC context and an outside-tested-GB/US-English flag in internal diagnostics. Treat consent/interstitial outcomes as bounded failures without cookies, browser rendering, proxies, or access workarounds. Keep the 10-second row deadline, 2 MiB response cap, five-redirect maximum, and concurrency cap of four.

## 3. Repository Assessment

- `src/google-news.ts` owns RSS retrieval, per-query limiting, and deduplication. It must retain the edition associated with each retrieved record without adding locale fields to the public discovery record.
- `src/publisher-url.ts` owns the bounded resolver, edition-specific marker/RPC request and parsing, row status, and injectable Fetch seam.
- `src/index.ts` passes discovery candidates to the resolver and hands flattened result rows, with no edition context, to the current processing seam.
- `src/publisher-url.test.ts` covers resolver behavior; `src/google-news.test.ts` and `src/index.test.ts` cover discovery and orchestration behavior.
- `scripts/sample-publisher-resolution.mjs` and the retained `docs/changes/4/live-sample.json` provide the live-sample harness/evidence path; the harness must pass candidates including edition context to the resolver and continue auditing only the nested discovery record and flattened result.
- The current retained live sample has 100 rows but 0 valid resolutions because all requests redirect to a consent/interstitial host before marker retrieval. It is a failed acceptance sample, not evidence against the article-ID marker/RPC path.
- `npm run validate` is the local quality contract. Dataset delivery is not part of this Issue.

## 4. Implementation Approach

### 4.1 Internal edition context

Define an internal `GoogleNewsEdition` containing `hl`, `gl`, and `ceid`, and pair it with each unchanged `GoogleNewsArticleRecord` in an internal candidate type. Derive the context from the exact `ActorInput` values used to build that RSS request. Carry the candidate through URL-based deduplication so the first retained record keeps its associated edition. Do not parse edition from `googleNewsUrl` or guess from `oc=5`.

### 4.2 Resolver acquisition and public row contract

Change single-row and batch resolver interfaces to accept candidates. Construct the explicit article-ID parameter-page request from the candidate edition. Keep `US:en` as the fixed RPC context for every candidate, replacing the unproven attempt to pass the candidate's RSS `ceid`. Preserve strict marker/article-ID matching, the source-backed `Fbv4je` / `garturlreq` request, and framed `garturlres` parsing. Validate result scheme and host, derive `publisherDomain` from the lowercased hostname, and maintain one success/failure/not-requested outcome per input row. Build results from the nested record only; do not spread or serialize edition context into the public result. Internal diagnostics record RPC context and whether the source edition is outside tested GB/US English. Keep diagnostics bounded and outside the public schema.

### 4.3 Failure isolation and regression coverage

Keep every network, redirect, timeout, metadata, RPC, and result-validation failure local to its row. Missing edition context is a row-level failure, with no guessed fallback. Verify an interstitial is classified and returned as failure without consent handling. Verify the mapper preserves row order and continues after a failure. Preserve zero resolver calls when resolution is disabled and ensure this path does not expose edition metadata either.

### 4.4 Live evidence and architecture reconciliation

Run the exact Issue #4 matrix against the candidate commit after local validation. Record the commit SHA, UTC collection time, exact inputs/configuration, Node/runtime, all ten cell counts, total denominator, valid successes, failures by bounded category, and request metrics. The gate passes only at 100 retained rows and >=95 valid successes. Report publisher-page title confirmations/unverifiable rows separately using existing evidence; no publisher-page requests are needed for the H5 resolution rule. Update `docs/architecture.md` after the implemented acquisition path is established, including the undocumented endpoint maintenance risk. Do not change `docs/product.md` unless the implementation reveals a product behavior change requiring a separate approved decision.

## 5. Implementation Sequence

1. Define the internal edition/candidate types and make discovery attach exact RSS `hl`/`gl`/`ceid` values; ensure first-seen URL deduplication retains the whole candidate.
2. Update resolver signatures and use the carried edition for parameter-page context while keeping RPC context fixed at `US:en`. Keep returned success/failure/not-requested rows flattened to the existing public schema.
3. Update `src/index.ts` and the live sample harness for candidate flow. Update discovery, resolver, and orchestration tests for GB/US context, dedupe association, disabled behavior, failure isolation, and no edition leakage.
4. Run the repository integrity checks and correct in-scope defects.
5. Execute the fixed 100-row live sample on the exact candidate commit. If incomplete or below 95/100, record the evidence and keep #4 on hold; do not substitute rows or lower the threshold.
6. Reconcile `docs/architecture.md` with the implemented edition-aware acquisition path and update the durable evidence record with the final live outcome.
7. Hand off the implementation, integrity results, architecture diff, and live evidence for Issue #4 validation. Do not treat hosted known-positive evidence or mocked checks as a live matrix pass.

## 6. Development Integrity Checks

- Run `npm run validate` (format check, lint, typecheck, unit tests, and build).
- Review the resolver and diagnostics for the approved bounds and ensure no response body, cookie, credential, or article text is retained in reports.
- Check that `docs/architecture.md` reflects implemented behavior and still distinguishes resolution from publisher access and dataset delivery.
- Run `git diff --check` on the change before handoff.

## 7. Test and Validation Strategy

### Acceptance Evidence Matrix

| Acceptance criterion / behaviour                            | Risk or boundary                                                                      | Test level                                   | Environment / data                               | Pass evidence                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every eligible retained row is attempted when enabled       | Orchestration may skip or misassociate rows                                           | Unit/integration plus live matrix            | Mocked records; fixed live sample                | One ordered outcome per eligible row; exact 100 retained live rows                                                                                   |
| At least 95 valid publisher URLs from 100 rows              | Current Google acquisition/RPC behavior can change or be blocked                      | Mandatory representative live evidence       | Five queries × GB/US English × 10 rows per cell  | All ten cells contain 10 rows; at least 95 rows meet the Issue/HLD validity rule                                                                     |
| Success status, URL and domain agree                        | Parsing may accept invalid scheme/host or mismatched metadata                         | Unit/contract tests plus live classification | Mock RPC responses; live outcomes                | `urlResolved=true`, success status, matching article-ID marker, parseable HTTP(S) non-Google URL, lowercased parsed hostname                         |
| Failure preserves Google News URL and does not fail the run | HTTP, redirect, marker, timeout, or RPC failure may leak across rows                  | Unit/integration tests                       | Injected Fetch and adjacent success/failure rows | Failed row preserves provenance and explicit failure; neighboring rows complete; run continues                                                       |
| Disabled mode makes no resolver request                     | Disabled input might still invoke external HTTP                                       | Unit test with Fetch spy                     | Mocked                                           | `not_requested` outcome on each row and zero resolver calls                                                                                          |
| Correct discovery edition is used through parameter-page    | Lost or guessed locale context can change marker acquisition                          | Unit/integration tests for GB and US         | Mocked RSS records and Fetch                     | Each candidate carries exact RSS `hl`/`gl`/`ceid`; parameter page uses that context; duplicates retain the first candidate's context                 |
| RPC context matches the evidence-backed design              | RSS locale might be an unproven RPC locale mapping                                    | Unit/contract tests                          | Mocked Fetch                                     | Every RPC uses fixed `US:en`; diagnostics record it and flag editions outside GB/US English; no claim of general locale compatibility                |
| Edition context stays internal                              | Candidate wrapper or object spread can leak internal locale data into output          | Contract tests at resolver/orchestration     | Mocked candidates, enabled and disabled paths    | Public result rows contain original discovery/enrichment fields and no `edition` or candidate wrapper                                                |
| HTTP-first bounds and excluded methods are preserved        | Drift could add excessive work or excluded access mechanisms                          | Unit checks and implementation review        | Mocked requests plus code review                 | 10-second deadline, 2 MiB response cap, five redirects, concurrency four; no browser, proxy, paid service, paywall bypass, or publisher-body request |
| Publisher access/title evidence is represented separately   | URL resolution could be conflated with page accessibility or exact-title confirmation | Evidence review                              | Integrated #14/#18 reports and live manifest     | Existing 79 confirmed / 21 unverifiable / 0 confirmed mismatch distinction retained; no claim of 100 independent title confirmations                 |

### Bounded Residual Feasibility Gates

**Bounded evidence gate:** Retained H5 evidence from the mixed GB/US 100-row matrix used RPC context `US:en` and produced 100/100 mechanism-level candidates. A hosted q1 check also succeeded for `GB:en`, but does not establish a general RSS-edition-to-RPC mapping. Therefore implementation uses the fixed H5-tested `US:en` RPC context on every row and marks non-GB/US-English editions in internal diagnostics as outside tested locale coverage. The exact Issue #4 100-row gate remains mandatory. During implementation, any consent/interstitial response is a row failure under existing bounds; do not add cookies, browser interaction, proxying, publisher access probes, or another resolver family.

### Representative End-to-End / Live Coverage

After implementation and local validation, run the same frozen matrix used for every #4 acceptance attempt. Each edition/query cell must retain the edition attached to the exact RSS request that produced its records:

| Query        | GB (`en-GB`, `GB`) | US (`en-US`, `US`) |
| ------------ | -----------------: | -----------------: |
| `world news` |                 10 |                 10 |
| `politics`   |                 10 |                 10 |
| `business`   |                 10 |                 10 |
| `technology` |                 10 |                 10 |
| `health`     |                 10 |                 10 |

Use `maxItemsPerQuery=10`, `dedupe=false`, `resolvePublisherUrls=true`, and one shared date-range/configuration for the run. Record accepted inputs and collection UTC time. Do not replace a missing cell row with another query/edition. A valid success requires `urlResolved=true`, explicit success status, preserved `googleNewsUrl`, a parseable HTTP(S) `publisherUrl` on a non-Google host, and `publisherDomain` equal to the parsed lowercased hostname. Consent/interstitial, malformed, ambiguous, Google-owned, or asset destinations fail. Pass only with denominator 100 and at least 95 successes.

Publisher accessibility and title confirmation are separate reporting dimensions. Use the retained #18 evidence (79 title-confirmed, 21 unverifiable, zero confirmed mismatches) as contextual evidence; do not fetch publisher pages or infer that a URL-resolution pass proves the publisher is currently accessible. If no independent confirmation evidence is collected during this run, state that plainly.

### Regression and Edge Coverage

- RSS request construction and returned candidates preserve exact `hl`, `gl`, and `ceid`; the explicit parameter-page URL uses that candidate edition.
- Every decoder RPC uses fixed `US:en` regardless of candidate edition; diagnostics report this context and flag source editions outside GB/US English.
- URL-based deduplication keeps the first retained candidate intact, including its edition.
- Marker acceptance requires exact source article-ID agreement; missing and mismatched markers fail before RPC.
- Correct `Fbv4je` form key/body handling and valid framed `garturlres` response produce a validated success.
- Consent/interstitial redirect, bad status, malformed response, timeout, network error, redirect limit, oversized response, Google-owned destination, and invalid scheme produce row failure with original URL preserved.
- One failed row beside successful rows does not change output count/order or block completion.
- Disabled resolution makes zero Fetch calls, emits `not_requested`, and does not leak edition context.
- Both successful and failed resolution outputs omit internal edition data and preserve the established public row shape.
- Bounded concurrency and request deadline/response caps remain enforced.

## 8. Open Implementation Questions

No material design question remains. Retained hosted known-positive evidence covers one query with both GB and US RPC locales; the broader mixed-edition evidence supports fixed `US:en` as best effort, not a general mapping. The internal edition context is used for RSS/parameter-page requests. The full 100-row live sample remains a mandatory acceptance gate. An incomplete/sub-threshold sample keeps Issue #4 on hold and requires evidence-based reassessment; it does not permit lowering the acceptance criterion or extending the work into consent circumvention or publisher access.

## 9. Low-Level Design Decision

**LLD required:** `Yes`

### Rationale

The internal edition context crosses discovery/deduplication, resolver request construction, and orchestration/public-row projection. Keeping it beside the record without changing the stable output schema requires explicit file-level types, function signatures, first-seen deduplication behavior, and a projection/leak invariant. The LLD records those coupled responsibilities and tests.

## 10. Implementation Checklist

- [x] Carry internal edition context through discovery, deduplication, and resolver calls
- [x] Use edition context in parameter-page and RPC construction without public-row leakage
- [x] Add/update deterministic GB/US, dedupe, disabled, failure-isolation, and projection coverage
- [x] Run `npm run validate` and `git diff --check`
- [x] Run the exact live 100-row matrix on the candidate commit; final candidate run `docs/changes/4/live-sample-20260930T083606Z.json` passed 100/100 on `30086115200285844a01f5090ebd50adc2dfb156` with all ten query/edition cells at 10/10
- [x] Record live outcome and attempt chronology: `08:09Z` run on `52a67b2` was 100/100 but exposed an audit-category defect; `08:22Z` run on `2eec014` was 0/100 (`google_host`); final corrected run at `08:36Z` passed 100/100. The middle run shows material Google redirect/consent variability; it does not supersede the passing exact-candidate run, and the resolver must continue to fail soft under that condition. Manifests: `live-sample-20260930T080912Z.json`, `live-sample-20260930T082220Z.json`, and `live-sample-20260930T083606Z.json`.
- [x] Reconcile `docs/architecture.md` with the implemented acquisition path and prepare the validation/PR review handoff

**Implementation evidence status:** Local repository validation and the required representative live gate pass. The final live manifest is tied to the current candidate commit and records a clean working tree. The earlier failed redirect run is retained as a residual operational risk for review; it does not change the unchanged >=95/100 acceptance threshold or the final candidate run's result.

### Approval

**Decision:** `Approve implementation`<br>
**Rationale:** The #14 prerequisite is complete and integrated; the HLD resolves the mechanism and contract. Implementation is authorized subject to the edition-context invariants, deterministic checks, and unchanged live acceptance gate.<br>
**Required follow-up:** Complete implementation, integrity checks, live evidence, and architecture reconciliation before validation handoff.
