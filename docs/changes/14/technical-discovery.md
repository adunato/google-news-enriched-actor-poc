# Technical Discovery: Google News publisher URL resolution boundary

**Artifact ID:** `technical-discovery-14-google-news-publisher-url`  
**Status:** `Inconclusive`  
**Owner:** Technical Discovery execution  
**Created / updated:** `2026-09-28`  
**GitHub Issue:** [#14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14)  
**Blocked downstream Issue(s):** [#4](https://github.com/adunato/google-news-enriched-actor-poc/issues/4); #5, #6 and #7 remain transitively blocked  
**Product Definition:** `docs/product.md`, PR-006, PR-007, PR-010, PR-011, PR-013 and Sections 3–5  
**Architecture Definition:** `docs/architecture.md`, Sections 2–5 and 8–9

## 1. Technical Question

Can the current Google News RSS article links be resolved to valid publisher article URLs at the #4 target of at least 95/100 with bounded HTTP-only requests, across the relevant local and intended Apify runtime environments? The result determines whether #4 may design against a particular resolution contract or remains blocked.

## 2. Known Context and Unknowns

### Established evidence

- The repository retrieval path uses `https://news.google.com/rss/search`, bounds each feed response to 2 MiB, applies `when:7d`, locale and edition parameters, and preserves the RSS item link as `googleNewsUrl` (`src/google-news.ts` at repository commit `a59a7b68ca108ab8197dd7b6272ab4bf39446f02`).
- Issue #4 and its PR #11 report a prior 100-row sample with 0 valid publisher URLs. All rows stopped at HTTP 302 to a consent/interstitial host before markers or decoder RPC could be reached.
- The official Google News documentation reviewed for this discovery explains publisher article URL requirements and Google News linking behaviour, but does not specify a public RSS article-link resolver, marker contract, or `batchexecute` RPC. See [Google News technical guidelines](https://support.google.com/news/publisher-center/answer/9606708?hl=en), [Google News article best practices](https://support.google.com/news/publisher-center/answer/9607104?hl=en-GB), and [Google News feed-content changes](https://support.google.com/news/publisher-center/answer/11299757?hl=en). This is a scoped documentation search result, not proof that no unpublished or differently indexed specification exists.
- PR #11's resolver implementation was used as an investigation lead only. Its `data-n-a-id`, `data-n-a-ts`, `data-n-a-sg`, `Fbv4je` / `garturlreq`, and `garturlres` assumptions were independently exercised in the live local probe below.

### Material unknowns

- Whether the observed undocumented marker/RPC path remains compatible from the intended Apify hosted runtime.
- Whether the local redirect bounce through `consent.google.com` is stable across runs, regions, or runtime/network identity.
- Whether Google will keep the observed page markers and RPC request/response shape.

## 3. Investigation Design

### Representative environments and data

- Local: Windows x64, Node.js `v24.15.0`.
- Hosted: Apify private disposable Actor, Linux, Node.js `v20.20.2`, based on `apify/actor-node:20`; Apify pinned the image to `sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`.
- Same fixed manifest in both environments: five queries (`world news`, `politics`, `business`, `technology`, `climate change`) × GB (`en-GB`) and US (`en-US`), first 10 RSS items per cell, `when:7d`, `dedupe=false`, 100 rows. The hosted run did not refresh feeds. The 100 manifest rows contain 94 unique Google News article IDs because the feed cells overlap.
- All requests were public and unauthenticated, without Google cookies/account credentials, residential proxies, browser automation or paid APIs.

### Probes

1. Fetch ten RSS feeds, retain ten rows per cell, and record bounded feed diagnostics.
2. For all rows, follow up to five Google News redirects, with an 8-second timeout and 2 MiB response cap; record response/host/marker diagnostics without storing HTML.
3. Decode legacy article tokens offline, with at most five base64url passes.
4. For all rows, refetch the Google News page under a shared 10-second row timeout, five-redirect limit, 2 MiB response cap and concurrency 4. Extract page markers only when the article ID matches the input, POST the `Fbv4je` / `garturlreq` request to `https://news.google.com/_/DotsSplashUi/data/batchexecute`, and parse `garturlres`. The expanded Google-owned host predicate is recorded in `rpc-probe.mjs` and `hosted-probe-results.json`.
5. In Apify Node 20, replay the same manifest and issue one bounded GET to each candidate publisher URL: concurrency 4, shared 10-second timeout, at most five redirects and a 256 KiB HTML response prefix. The recorded article-like heuristic matches `<article>`, schema.org `Article`/`NewsArticle` itemtype, or `og:type=article`. Only status, hostnames, hashes, response type, byte-cap state and heuristic result were retained; no publisher URL or body was retained.

The request and response assumptions originate in PR #11's candidate implementation but were independently exercised against live Google endpoints. Google does not document this RPC as a supported resolver API in the reviewed sources.

## 4. Evidence

- **RSS matrix:** `2026-09-28T12:49:13.513Z`–`12:50:14.912Z` UTC. All 10 feeds returned HTTP 200 from `news.google.com` and at least 10 parseable items; exactly 10 were retained per cell.
- **Local GET/token:** 100/100 rows ended at HTTP 200 on `news.google.com`; 0/100 produced a publisher destination through ordinary redirect or token decode. RSS source metadata identified source sites, not item article URLs.
- **Local marker/RPC:** `2026-09-28T12:55:28.076Z`–`12:55:35.671Z` UTC. 100/100 candidate destinations passed the then-used HTTP(S)/non-Google `.com` predicate, with 10/10 per cell. All 100 page/article IDs matched; all 100 RPC calls returned HTTP 200 and parsed `garturlres`. This is URL syntax/domain evidence, not page accessibility or story identity.
- **Hosted marker/RPC:** final run `SaG4cPaZ0Z3RZT2tO`, build `6GaplhGGGMCwe5zXp` / `0.0.4`, Actor `qGVphQDt7CqcseeEO`; RPC window `2026-09-28T13:17:33.883Z`–`13:17:38.113Z` UTC. Runtime was Apify Linux Node `v20.20.2`. All 100 rows passed the expanded Google-owned host exclusion; each of the 10 query/edition cells had 10/10 RPC destinations. All rows followed the observed `302 → 303 → 302 → 200` Google/consent bounce, matched all three markers, and received an RPC HTTP 200 response.
- **Hosted publisher GET:** run `SaG4cPaZ0Z3RZT2tO`, `2026-09-28T13:17:38.122Z`–`13:17:45.261Z` UTC. Outcomes: 77/100 HTTP 200 HTML responses with an article-like marker, 20 HTTP errors (13×403, 5×401, 2×405), and 3 HTTP 200 HTML responses without a marker. The 77% heuristic result is below 95%; it does not prove that any page matches the corresponding Google News story.
- The hosted matrix counts are 10/10 RPC destinations in every query/edition cell. Article-like GET counts by cell are recorded in `hosted-probe-results.json`; they ranged from 6/10 to 9/10.
- The final run completed `2026-09-28T13:17:31.261Z`–`13:17:46.671Z` UTC, exit code 0, configured 256 MiB, 15.325 seconds, peak memory 89,939,968 bytes, 0.0010642361 compute units and `$0.0003268311` reported run usage. The Apify API response did not expose the runtime region; the build log showed its image registry in `us-east-1`, which does not establish the container's execution region.
- Account: Apify username `adunato`, user ID `O56PJDpqDQa4WIM3x`. Temporary Actor remained private. Four disposable builds/runs were used to correct evidence persistence and timestamp capture; only final build/run results are discovery evidence. All temporary cloud resources were removed after capture.
- Full sanitized hosted evidence, including per-row stages, response status, hostnames and hashes, is [`hosted-probe-results.json`](hosted-probe-results.json). Local evidence is [`probe-results.json`](probe-results.json); local reproducibility scripts are [`probe.mjs`](probe.mjs) and [`rpc-probe.mjs`](rpc-probe.mjs).

## 5. Findings

- **Observed:** ordinary HTTP redirects and legacy token decoding each returned 0/100 publisher destinations in the local sample.
- **Observed:** marker + RPC returned 100/100 syntactic non-Google destinations in local Node 24 and hosted Apify Node 20. Every hosted cell returned 10/10.
- **Observed:** the hosted publisher GET heuristic found article-like metadata on 77/100 destinations, below the 95/100 target; 20 responses were 401/403/405 and three HTML responses had no recorded article marker.
- **Observed:** none of the probes compared a publisher page's title/content with the originating Google News item. The evidence does not establish exact article identity. Publisher blocks could be transient, but retry behaviour was not tested.
- **Supported inference:** the undocumented marker/RPC sequence is runtime-compatible in this one Apify Node 20 run and can produce syntactically plausible non-Google URLs. It has not met the stricter accessible/article-like page target in the single hosted sample.
- **Unresolved:** true article identity, variability across later samples/runtime egress, whether bounded retries change publisher response outcomes, and future compatibility of Google's undocumented RPC and markers.

## 6. Limitations and Variability

- One local and one hosted matrix used current RSS results from a single sample day. The rows are not a stable corpus and 94 of 100 rows are unique.
- Publisher HTTP responses can change with time, network identity, rate limits and publisher policy. Only one bounded hosted GET per destination was made; no retries were made.
- The article-like marker is a shallow HTML heuristic. It can produce false positives and false negatives and is not a publisher article-identity check. The source titles were not retained in plaintext, and no page content was retained for comparison.
- `Fbv4je` / `garturlreq` and Google's marker/RPC format are undocumented and may change without notice.
- No paywalls, article text extraction or full-text behaviour were tested.

## 7. Conclusion

**Result:** `Inconclusive`

**Supported integration/behaviour contract:** In the tested local and hosted runtime samples, a bounded HTTP flow that follows at most five Google News redirects, extracts three markers for the matching input article ID, calls the undocumented RPC and excludes the tested Google-owned host families yielded 100/100 syntactic candidate destinations. In Apify, only 77/100 publisher pages returned HTTP 200 HTML with the recorded article-like marker. No exact story identity was established. This evidence is insufficient for downstream design to rely on a 95% valid publisher-article contract.

**Viable approach(es):** Marker + RPC is a demonstrated way to obtain candidate destinations in these samples. The downstream 95/100 article capability remains unproven.

**Rejected / unsupported approach(es):** Plain HTTP GET redirects alone, legacy token decoding and RSS source URL metadata each yielded 0/100 article destinations in the local sample. The marker/RPC approach is not yet supported as a production resolution contract because publisher accessibility/article identity did not meet the strict evidence gate.

## 8. Downstream Implications

- Keep Issue #4 blocked. The hosted RPC path reached 100/100 candidate URLs, but the bounded page heuristic reached 77/100 and exact story identity is unresolved.
- Further discovery, if pursued, should compare publisher response pages against the originating item identity and determine whether allowed bounded retries materially change the HTTP-error rate. Do not weaken the success predicate or expand to browser rendering, proxies, paid services or paywall bypass.
- After this discovery is integrated, rerun `assess-change` on #4. Issues #5, #6 and #7 remain transitively dependent on #4.
- No product or durable architecture change is justified by this evidence.

## 9. Reproducibility

- **Repository commit:** `a59a7b68ca108ab8197dd7b6272ab4bf39446f02`.
- **Local runtime:** Node.js `v24.15.0`, Windows x64. From the repository root after `npm ci`, run `node docs/changes/14/probe.mjs` and `node docs/changes/14/rpc-probe.mjs`. The first command refreshes the RSS/GET/token matrix; the second runs marker/RPC against its manifest. The hosted replay did not refresh feeds.
- **Hosted runtime:** Apify Linux image `apify/actor-node:20`, resolved digest above; Node.js `v20.20.2`; Actor `qGVphQDt7CqcseeEO`; final build `0.0.4` (`6GaplhGGGMCwe5zXp`); final run `SaG4cPaZ0Z3RZT2tO`. Account `adunato` (`O56PJDpqDQa4WIM3x`). Runtime region was not available in run metadata. Commands: `apify actors push --dir <temporary-project> --json --wait-for-finish 900` and `apify actors call qGVphQDt7CqcseeEO --build 0.0.4 --memory 256 --timeout 900 --json`.
- **Input/probe hashes and exact disposable project files:** recorded in [`hosted-probe-handoff.md`](hosted-probe-handoff.md); the manifest, Actor definition, Dockerfile, package lock, and exact hosted scripts are retained alongside this artifact.
- **Evidence paths:** `docs/changes/14/probe.mjs`, `docs/changes/14/rpc-probe.mjs`, `docs/changes/14/probe-results.json`, `docs/changes/14/hosted-probe-results.json`, `docs/changes/14/hosted-probe-input-manifest.json`, `docs/changes/14/hosted-probe-main.mjs`, `docs/changes/14/hosted-probe-rpc.mjs`, `docs/changes/14/hosted-probe.Dockerfile`, `docs/changes/14/hosted-probe-package.json`, `docs/changes/14/hosted-probe-package-lock.json`, `docs/changes/14/hosted-probe-actor.json`.
- No secrets, cookies, publisher URLs, publisher page bodies or RPC bodies were retained in the hosted dataset.

## Completion

**Decision:** `Inconclusive / further discovery required`  
**Rationale:** The fixed matrix yielded 100/100 syntactic candidate URLs in Apify Node 20, but only 77/100 publisher pages matched the bounded article-like HTTP heuristic, below the 95/100 threshold. Exact article identity remains unverified.  
**Required downstream action:** Keep #4 blocked. If work continues, verify destination identity against the originating story under approved HTTP-only limits; after integrating this discovery, rerun `assess-change` on #4.

**Learning record:** [`docs/learnings/issue-14-publisher-url-validity.md`](../../learnings/issue-14-publisher-url-validity.md) (`SideGig review: No`).
