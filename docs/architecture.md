# Architecture Definition: Enriched Google News Actor POC

> Canonical durable architecture artifact describing the approved technical structure of the POC.

**Artifact ID:** `architecture-enriched-google-news-actor-poc`  
**Status:** `Approved`  
**Owner:** Project owner  
**Created / updated:** `2026-09-27`  
**Product Definition:** `docs/product.md` / `product-enriched-google-news-actor-poc`  
**Traceability:** SideGig enriched POC bootstrap handoff; Gateway 3 Pass; Step 9 repository establishment

## 1. Architecture Summary

The product is one independently deployable TypeScript/Node.js Apify Actor. It uses Google News as the discovery source, normalizes feed records, attempts lightweight publisher URL resolution, optionally performs bounded HTTP article fetching/readability extraction, isolates enrichment failures per row, and writes normalized records to the default Apify dataset.

The architecture is intentionally HTTP-first and lightweight. Browser automation, residential proxies, paid external extraction/news services and other heavy dependencies are excluded by the POC boundary.

## 2. System Context and Boundaries

Inside the product boundary are Actor input validation, Google News requests/parsing, publisher URL resolution, optional full-text extraction, row-level status/error isolation, orchestration/deduplication and Apify dataset delivery.

External dependencies are Google News public search/RSS behaviour, public publisher pages when enrichment is requested, and Apify Actor runtime/dataset/API/logging/analytics/charging/Store capabilities. There is no separate application backend or persistent database.

## 3. Components and Responsibilities

| Component | Responsibility |
| --- | --- |
| Actor entrypoint and input validation | Read Actor input, enforce the approved bounded contract and start orchestration. |
| Google News request adapter | Perform bounded HTTP requests with timeout/retry/body-size controls. |
| Google News parser/normalizer | Convert feed records into the approved core metadata contract. |
| Publisher URL resolver | Resolve Google News article links to publisher URLs and emit explicit status/reason information. |
| Article fetch/readability stage | When requested, fetch resolved publisher pages over HTTP and attempt readable text extraction. |
| Row enrichment boundary | Isolate URL/full-text failures and preserve fallback/provenance fields. |
| Multi-query orchestrator | Execute bounded queries, enforce result limits, deduplicate where requested and coordinate enrichment. |
| Apify delivery/observability | Push rows to the default dataset and emit platform-native logs, analytics and charging evidence. |

## 4. Principal Flows

### Standard enriched search

1. Apify starts the Actor with validated query/locale/recency/result-limit inputs.
2. The request adapter retrieves Google News results for each bounded query.
3. The parser normalizes feed records.
4. When enabled, the resolver attempts a publisher URL for each row and records the result status.
5. When full text is requested and a publisher URL is available, the article stage performs a bounded HTTP fetch and readability extraction.
6. Row-level failures are captured as status/fallback data rather than propagated as run-fatal errors.
7. Optional cross-query deduplication is applied.
8. Final rows are written to the default Apify dataset.

### Fail-soft enrichment

1. A publisher-resolution or article-fetch/extraction operation fails.
2. The affected row records a machine-readable failure/status.
3. The original Google News URL remains present.
4. Processing continues for remaining rows and queries.
5. The run remains successful unless a source-level/systemic failure makes the dataset unusable.

## 5. Interfaces and Integrations

| Interface / integration | Purpose | Direction / contract |
| --- | --- | --- |
| Apify Actor input | User/API invocation | Inbound JSON matching the Product Definition input contract. |
| Google News public feed/search | Article discovery | Outbound bounded HTTP; no paid API dependency. |
| Publisher HTTP pages | URL resolution and optional article text | Outbound bounded HTTP; partial failure is expected. |
| Apify default dataset/API | Result delivery | Outbound normalized rows matching the product contract. |
| Apify logs/analytics/charging | Operational and POC evidence | Platform-native observability and pay-per-event evidence. |

## 6. Data and State

No persistent application state. Each result row carries core Google News metadata, original Google News URL, publisher-resolution outcome and optional full-text outcome. Cross-query deduplication is in-run only. Apify owns persisted dataset/run records and observation evidence.

## 7. Deployment and Runtime

- Runtime: TypeScript compiled for Node.js 20.
- Platform: one Apify Actor.
- Development integration branch: `dev`.
- Release validation/promotion uses SideGig `staging` and `main`.
- Deployment mechanics are governed by the installed `apify-actor-deployment`, `prepare-release`, `staging-validation` and `promote-release` skills.

Actor/Store schemas and Docker packaging are implementation artifacts and will be introduced through normal Issues rather than invented at bootstrap.

## 8. Cross-Cutting Architecture

- **Security:** No product credentials should be required for Google News/public publisher access. Repository/deployment secrets remain in platform secret stores, never source control.
- **Reliability:** Bounded requests, retries/timeouts/body limits where appropriate, and strict row-level isolation for publisher-specific failures.
- **Observability:** Apify-native logs/run status/dataset evidence plus charging/analytics needed for Step 8 evaluation.
- **Performance / scale:** Query count and per-query result limits bound work. Enrichment must remain bounded and suitable for a lightweight POC.
- **Cost:** Avoid mandatory browser/proxy/paid extraction infrastructure; preserve the low-cost experimental model.

## 9. Architecture Principles and Constraints

- HTTP-first and dependency-light.
- Preserve Google News URL provenance/fallback.
- Fail soft at row level for publisher resolution and full text.
- Keep source acquisition, parsing, URL resolution, article extraction and orchestration responsibilities separable.
- Do not introduce excluded heavy dependencies to rescue capability metrics.
- Reuse legacy implementation only through explicit post-bootstrap Issues; the legacy repository is an implementation reference, not this repository's architecture authority.

## 10. Open Architecture Questions

No outstanding durable architecture questions block implementation. Exact URL-resolution algorithm, readability library/algorithm and file/module decomposition are intentionally delegated to Issue-centred design/planning.

## 11. Architecture Summary

- One lightweight TypeScript/Node.js Apify Actor with Google News discovery and Apify-native delivery.
- Publisher resolution and optional full text are explicit stages with per-row failure isolation.
- Heavy scraping/extraction dependencies are excluded by architecture, not merely deferred implementation choices.
