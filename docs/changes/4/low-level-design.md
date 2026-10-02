# Low-Level Design: Edition-Aware Publisher URL Resolution

**Artifact ID:** `low-level-design-4-edition-aware-publisher-resolution`<br>
**Status:** `Approved`<br>
**Owner:** Project owner<br>
**Created / updated:** `2026-09-30`<br>
**GitHub Issue:** [#4](https://github.com/adunato/google-news-enriched-actor-poc/issues/4)<br>
**Implementation Plan:** `docs/changes/4/implementation-plan.md` — `implementation-plan-4-publisher-url-resolution`<br>
**HLD reference:** `docs/changes/4/hld.md` — `hld-4-publisher-url-resolution`<br>
**Technical Spike:** Issue [#14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14), Feasible conclusion integrated by PR #21; `docs/changes/14/technical-spike.md`

## 1. Change Overview

Carry the exact Google News edition used for each RSS record into resolver calls. Use the edition for explicit parameter-page acquisition. Keep the RPC context fixed at H5-tested `US:en` for every row. Preserve the discovery record and public enriched-row schema; record the RPC context and unsupported-locale flag in internal diagnostics only.

## 2. File Changes

### `src/google-news.ts`

**Action:** `Modify`

Add and export the internal types:

- `GoogleNewsEdition` with `hl`, `gl`, and `ceid` string fields.
- `GoogleNewsArticleCandidate` with `record: GoogleNewsArticleRecord` and `edition: GoogleNewsEdition`.

Keep `GoogleNewsArticleRecord` unchanged. Change `retrieveGoogleNewsArticles` to return `GoogleNewsArticleCandidate[]`. For each RSS response, construct the edition from the finalized URL returned by `buildGoogleNewsRssUrl` by reading its exact `hl`, `gl`, and `ceid` query values, then pair each normalized record with it. This keeps context identical to the discovery request. Keep per-query limiting unchanged. When dedupe is enabled, compare `candidate.record.googleNewsUrl` and retain the first whole candidate so its originating edition remains attached. Do not infer locale from the article link or `oc` parameter.

### `src/publisher-url.ts`

**Action:** `Modify`

Accept `GoogleNewsArticleCandidate` in `resolvePublisherUrl` and `resolvePublisherUrls`; preserve the injected Fetch and diagnostic callback interfaces. Use `candidate.record` for article-ID parsing, failure construction, and public result creation.

Build the explicit article-ID parameter-page URL using candidate `hl`, `gl`, and `ceid`. Require the page marker article ID to equal the nested record's article ID. For every RPC, set the `Fbv4je` / `garturlreq` request context to the fixed H5-tested `US:en`, regardless of candidate edition. Do not pass candidate `ceid` to the RPC or infer a locale mapping. Keep the request deadline, response cap, redirect limit, and concurrency unchanged.

Extend `PublisherResolutionDiagnostic` with internal `rpcContext: "US:en"` and `outsideTestedGbUsEnglish: boolean` fields. Set the flag to false only for exact GB English (`hl=en-GB`, `gl=GB`) and US English (`hl=en-US`, `gl=US`) candidates; set it to true for other or missing edition values. Preserve diagnostic callback isolation so diagnostics cannot change resolver outcomes. Do not add a new public status or row field.

Return `PublisherResolvedArticle` by spreading only `candidate.record` and adding the existing resolution fields. Apply this to success, failure, and `not_requested` outcomes. Missing/invalid edition context is a row-level failure; do not infer or fall back to another edition. The result must not contain `edition` or a candidate wrapper.

### `src/index.ts`

**Action:** `Modify`

Pass discovery candidates directly into `resolvePublisherUrls`. Continue handing flattened `PublisherResolvedArticle[]` results to `processActorInput`. Do not spread candidates or attach edition to processing/public-output rows.

### `src/google-news.test.ts`

**Action:** `Modify`

Assert each returned candidate has the unchanged nested discovery record and exact `hl`/`gl`/`ceid` values read from its finalized RSS request URL. Cover GB (`en-GB`, `GB`) and US (`en-US`, `US`) inputs. Retain request construction, row limit, order, and first-seen deduplication coverage; assert dedupe retains the complete first candidate.

### `src/publisher-url.test.ts`

**Action:** `Modify`

Pass candidate wrappers to resolver tests. Verify GB and US editions produce matching parameter-page query values, while both generate RPC requests using fixed `US:en`. Verify diagnostics report `rpcContext: "US:en"` and set `outsideTestedGbUsEnglish` false for the two tested edition pairs and true for another locale or missing context. Keep article-ID matching, result validation, row failure isolation, order, bounds, and disabled zero-call coverage. Assert successful, failed, and `not_requested` outputs contain no `edition`, candidate `record` wrapper, or new public status.

### `src/index.test.ts`

**Action:** `Modify`

Update orchestration coverage for candidate resolver input and flattened processing output. Assert edition is absent at the processing seam and that order/counts remain intact. Verify GB and US candidate editions reach parameter-page construction while resolver RPC context remains `US:en`.

### `scripts/sample-publisher-resolution.mjs`

**Action:** `Modify`

Retain edition context in cell candidates and pass candidates unchanged to `resolvePublisherUrls`. For hashes and success-predicate comparisons, read the original record from `candidate.record`; compare resolved output with its `googleNewsUrl`. Preserve the run manifest's cell edition fields and row audit format, including the internal RPC context and outside-tested-GB/US-English flag from resolver diagnostics. Do not write candidate wrappers or diagnostics into public result rows.

## 3. Cross-File Dependencies

1. `src/google-news.ts` pairs each discovery record with exact finalized RSS `hl`/`gl`/`ceid` values; first-seen dedupe retains the full pair.
2. `src/index.ts` forwards candidates unchanged to the resolver.
3. `src/publisher-url.ts` uses candidate edition only for parameter-page acquisition, uses fixed `US:en` for each RPC, records internal diagnostic context, then returns a result built from the nested record only.
4. Discovery/resolver/orchestration tests verify the two locale contexts, constant RPC context, diagnostic flags, dedupe association, fail-soft/disabled behavior, and no-leak invariant. The live sample harness preserves this internal context in its evidence path.

`GoogleNewsEdition`, `GoogleNewsArticleCandidate`, and diagnostic fields are internal contracts only. No edition metadata, diagnostic fields, or new status values enter the public row schema.

## 4. File Change Summary

| File                                      | Action | Purpose                                                                                                             |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `src/google-news.ts`                      | Modify | Pair records with exact RSS edition context; preserve the pair through dedupe.                                      |
| `src/publisher-url.ts`                    | Modify | Use candidate edition for page requests, fixed `US:en` for RPC, record diagnostics, and strip context from results. |
| `src/index.ts`                            | Modify | Pass internal candidates to resolution and flattened rows onward.                                                   |
| `src/google-news.test.ts`                 | Modify | Prove edition association, GB/US values, and first-seen candidate retention.                                        |
| `src/publisher-url.test.ts`               | Modify | Prove page locale, fixed RPC context, diagnostic flags, no leakage, and fail-soft behavior.                         |
| `src/index.test.ts`                       | Modify | Prove orchestration keeps internal edition context out of result rows.                                              |
| `scripts/sample-publisher-resolution.mjs` | Modify | Carry candidates through the fixed live matrix and retain internal diagnostics.                                     |

### Completion contract

The design is approved against the Issue, HLD, and Implementation Plan. No unresolved file-level decision remains. Implementation must preserve the existing HTTP bounds, H5 URL-resolution rule, fixed RPC context, row-level failure isolation, original URL provenance, and public output shape. Compatibility outside GB/US English remains unverified and must be visible in internal diagnostics.
