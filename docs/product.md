# Product Definition: Enriched Google News Actor POC

> Canonical durable product artifact. This document describes the current approved product intent and externally meaningful behaviour.

**Artifact ID:** `product-enriched-google-news-actor-poc`  
**Status:** `Approved`  
**Owner:** Project owner  
**Created / updated:** `2026-09-27`  
**Upstream context:** SideGig `implementation/apify/poc.md` Steps 6-8 and `implementation/apify/enriched-poc-bootstrap-handoff.md`  
**Traceability:** Gateway 3 — Pass; Step 9 repository establishment

## 1. Product Summary

The Enriched Google News Actor POC is a paid Apify Actor for users who need Google News discovery in a form that can be consumed directly by research, monitoring, automation and AI/data workflows. It returns structured Google News records, attempts to resolve each Google News article link to the real publisher URL, and can optionally perform best-effort readable article-text extraction.

The POC tests whether integrated publisher-URL resolution and optional full text provide enough practical value for a new entrant to earn paid usage in the Apify Store.

## 2. Users and Primary Use Cases

### Users

- Developers and automation builders.
- Researchers and analysts.
- Media-monitoring, PR and communications users.
- RAG, AI and data-pipeline workflows.

### Primary Use Cases

1. Search Google News programmatically and receive normalized article records.
2. Obtain real publisher URLs without separately operating URL-resolution logic.
3. Optionally obtain readable article text for downstream research, monitoring or AI workflows.
4. Consume results through the standard Apify dataset/API mechanisms.

## 3. Product Scope

### In Scope

- One to twenty Google News search queries per run.
- Locale/language and country/edition controls.
- Bounded recency windows.
- One to one hundred results per query.
- Optional cross-query deduplication.
- Publisher URL resolution for Google News article links.
- Explicit resolution status/fallback behaviour.
- Optional, bounded, best-effort HTTP full-text extraction.
- Explicit full-text status and word-count output.
- Default Apify dataset/API delivery.
- Public paid POC operation and a controlled 30-day observation window.

### Out of Scope

- Browser rendering or browser scraping.
- Paywall bypass.
- Residential proxies.
- Paid external extraction or news APIs.
- Stateful monitoring/alerting.
- Multi-source news aggregation.
- AI enrichment, sentiment analysis or event clustering.
- Publisher-specific heavy extraction infrastructure.

## 4. Product Capabilities

| Capability | Description |
| --- | --- |
| Google News search | Accept bounded query, locale, country and recency controls and return normalized Google News article records. |
| Publisher URL resolution | Attempt to resolve each Google News article URL to a real publisher URL while retaining the Google News URL as fallback/provenance. |
| Optional full text | When requested, fetch the resolved publisher page over HTTP and attempt readable article-text extraction. |
| Fail-soft enrichment | Record publisher-resolution/full-text outcomes per row so an individual publisher failure does not fail the run. |
| Dataset/API delivery | Store normalized records in the default Apify dataset and expose them through standard Apify APIs/exports. |
| Paid POC charging | Support the temporary Step 7 pay-per-event charging model for article-result and successful-full-text events. |

## 5. Product Requirements and Behaviour

| ID | Requirement |
| --- | --- |
| `PR-001` | `queries` is required and accepts 1-20 non-empty Google News search expressions; native Google News operators may pass through. |
| `PR-002` | `maxItemsPerQuery` defaults to 20 and accepts 1-100. |
| `PR-003` | `language` defaults to `en-GB`; `country` defaults to `GB`. |
| `PR-004` | `dateRange` accepts `any`, `1h`, `6h`, `1d`, `7d`, or `30d`, defaulting to `7d`. |
| `PR-005` | `dedupe` defaults to `true` and removes obvious repeated records across queries while retaining the first matching-query context. |
| `PR-006` | `resolvePublisherUrls` defaults to `true`; every Google News article link is eligible for publisher URL resolution. |
| `PR-007` | Resolution failure must preserve `googleNewsUrl`, set explicit resolution status, and remain non-fatal to the run. |
| `PR-008` | `includeFullText` defaults to `false`; when true, full-text extraction occurs only after publisher URL resolution using bounded HTTP access. |
| `PR-009` | Full-text failure is recorded per row with explicit status and must not fail the run. |
| `PR-010` | Required core output fields are `query`, `title`, `sourceName`, `publishedAt`, `googleNewsUrl`, `urlResolved`, and `urlResolutionStatus`. |
| `PR-011` | Optional output fields include `snippet`, `publisherUrl`, `publisherDomain`, `articleText`, `fullTextStatus`, and `wordCount` where applicable. |
| `PR-012` | Results are written to the default Apify dataset and remain consumable through standard Apify APIs/exports. |
| `PR-013` | The implementation must remain lightweight and must not make an excluded heavy dependency mandatory. |

## 6. External Interaction and Contract

| Input | Required | Contract |
| --- | --- | --- |
| `queries` | Yes | 1-20 non-empty strings. |
| `maxItemsPerQuery` | No | Integer 1-100; default 20. |
| `language` | No | Supported locale/language string; default `en-GB`. |
| `country` | No | Supported two-letter country/edition code; default `GB`. |
| `dateRange` | No | `any`, `1h`, `6h`, `1d`, `7d`, `30d`; default `7d`. |
| `dedupe` | No | Boolean; default `true`. |
| `resolvePublisherUrls` | No | Boolean; default `true`. |
| `includeFullText` | No | Boolean; default `false`. |

Principal outputs are one normalized dataset row per delivered article result. The Google News URL is always retained. Successful enrichment adds the resolved publisher URL/domain and, when requested and available, readable article text and word count. Resolution/full-text status fields distinguish success, failure and not-requested states.

Temporary POC pricing is **$2.00 per 1,000 delivered article records with resolved-publisher-URL attempts**, plus **$2.00 per 1,000 successful full-text enrichments** when full text is requested. Failed full-text extraction is not charged as a full-text event.

## 7. Constraints and Non-Goals

- The observation window is 30 consecutive days and starts only after public listing, active charging, launch-baseline capture and closure of all Step 8 pre-observation requirements.
- The product must preserve fail-soft per-row behaviour.
- Google News/public publisher HTTP access and Apify-native capabilities are the intended dependency model.
- Production pricing beyond the POC is not decided by this artifact.
- The excluded capabilities listed in Section 3 are not implementation shortcuts available within this POC.

## 8. Open Product Questions

No outstanding product-definition questions block implementation. Exact implementation decomposition and algorithms are intentionally delegated to Issue-centred design/planning.

## 9. Product Definition Summary

- Deliver structured Google News results with real publisher URL resolution as the core differentiator.
- Offer optional best-effort full text without making publisher failures fatal.
- Keep the experiment lightweight, Apify-native, paid and bounded by the approved 30-day POC conditions.
