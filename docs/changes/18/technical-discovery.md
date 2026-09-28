# Technical Discovery: Publisher article identity and hosted success rate

**Status:** Complete; the tested marker/RPC plus bounded publisher HTTP path is **Not feasible** for Issue #4's 95/100 gate on the frozen 100-row sample.

**GitHub Issue:** [#18](https://github.com/adunato/google-news-enriched-actor-poc/issues/18)  
**Blocked downstream Issue:** [#4](https://github.com/adunato/google-news-enriched-actor-poc/issues/4). Issues #5, #6 and #7 remain transitively blocked.  
**Created / updated:** 2026-09-28  
**Product / Architecture:** `docs/product.md` PR-006, PR-007, PR-010, PR-011 and PR-013; `docs/architecture.md` Sections 2-5 and 8-9.

## 1. Technical question

Can the marker/RPC publisher candidates established in #14 be checked with bounded HTTP requests so that each accepted publisher page is shown to be the originating Google News story, while reaching at least 95 valid corresponding articles in the defined 100-row GB/US matrix under the approved HTTP-only constraints?

## 2. Established context and hypotheses

- Discovery #14 produced 100 syntactic publisher URL candidates in its hosted sample, but did not retain RSS titles or test exact story identity.
- The Issue #18 frozen input contains five queries (`world news`, `politics`, `business`, `technology`, `climate change`) across GB `en-GB` and US `en-US`, the first 10 feed items per cell, `when:7d`, with deduplication disabled. It has exactly 100 rows.
- The frozen manifest file SHA-256 is `d1ed2bea31efc54358ac24d991a9037ec0f0840ccd50547c01bd794c64389f3c`; its row-array SHA-256 is `fdbab474e5764350c547080c0002f042b062e03f157a270d5b9474d846ad2f2a`.
- Hypothesis: normalizing a publisher page title against the corresponding RSS title can identify valid destination URLs. This probe tested that hypothesis; it did not test every possible HTTP-only resolver.
- Browser rendering, residential proxies, paywall bypass, paid extraction/news APIs, and production resolver work remained out of scope.

## 3. Probe and classification method

Both environments used the same frozen manifest and probe implementation. The marker/RPC step supplied candidates; the publisher check then made bounded GET requests with concurrency 4, a 10-second request timeout, at most five manually followed redirects, and a 256 KiB inspected HTML prefix. A row failure did not stop other rows. At most one retry was permitted for 408, 425, 429, 5xx, timeout or network errors; access denials were not retried.

Before every publisher request, the probe resolves every A/AAAA address, accepts only addresses classified as globally routable `unicast` by pinned `ipaddr.js@2.2.0`, and passes that validated address set to Node `http`/`https` as a custom lookup. Redirects are manual: each new target is resolved, checked and pinned before its request. This prevents a second DNS resolution from redirecting a validated hostname to a private address. The safety tests cover private/special IPv4 and IPv6 ranges, IPv4-mapped loopback, private DNS answers, a redirect to loopback, and reuse of pinned DNS answers.

Identity signals are limited to publisher `h1`, `og:title` and JSON-LD `headline`. Titles are entity-decoded up to three passes, NFKC-normalized, case-folded, stripped of soft hyphens/format characters, punctuation and symbols, and whitespace-collapsed. A source suffix is removed only on an exact separator-plus-source-name match.

- **Confirmed match:** at least one supported title signal exactly matches the normalized RSS title.
- **Confirmed mismatch:** a complete response contains at least two independent supported title signals that agree on one normalized non-matching title.
- **Unverifiable:** no matching title is found and evidence is truncated, missing, conflicting or too weak to establish a mismatch. Invalid numeric entities remain literal and cannot abort the row or run.
- **Strict success:** confirmed match, HTTP 200 HTML and an article-like marker. HTTP status, article markers and title identity remain separate measures.

## 4. Evidence

### Final local and hosted results

| Measure                             | Local Windows / Node 24.15.0 | Apify Linux / Node 20.20.2 |
| ----------------------------------- | ---------------------------: | -------------------------: |
| Frozen rows                         |                          100 |                        100 |
| Candidate extraction                |                      100/100 |                    100/100 |
| HTTP 200 HTML                       |                           80 |                         81 |
| HTTP 403                            |                           15 |                         15 |
| HTTP 401                            |                            4 |                          4 |
| HTTP 451                            |                            1 |                          0 |
| Article-like marker                 |                           77 |                         78 |
| Confirmed title match               |                           78 |                         79 |
| Confirmed mismatch                  |                            0 |                          0 |
| Unverifiable identity               |                           22 |                         21 |
| Strict confirmed publisher articles |                   **75/100** |                 **76/100** |
| Retries in this final pinned run    |                            0 |                          0 |

The required threshold is 95/100. The final hosted run was build `0.4.1` / `bhBBv5ohtKDQamR4D`, run `oiLOkd2rSc4WAYTAg`, dataset `urfl3jsv2WB81GnUo`, Actor `ffjdMHqwE6aTsLhnb`. It ran from `2026-09-28T15:57:19.831Z` through `2026-09-28T15:57:51.272Z` UTC, with 256 MiB configured and a 900-second timeout. The base image was `apify/actor-node:20`, resolved digest `sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`. Reported usage was $0.0010753898, 0.00217514 compute units, and peak memory 72,314,880 bytes. The Apify runtime region was not exposed.

The hosted dataset contains one summary plus 100 per-row records. The Actor wrapper verified both frozen hashes and verified all 100 row IDs exactly once before saving. The sanitized per-row evidence retains row/candidate hashes, publisher host, status/stages, title signals and identity reason. It does not retain publisher URLs, Google News URLs, cookies, tokens or page bodies. Four retained raw Apify run API captures had their platform-generated dataset signing key removed before integration; the affected files and post-redaction hashes are recorded in [`hosted-run-metadata.json`](hosted-run-metadata.json). The full hosted evidence is in [`hosted-results.json`](hosted-results.json), the dataset export in [`hosted-dataset-items-pinned-final.json`](hosted-dataset-items-pinned-final.json), run/build/runtime and cleanup details in [`hosted-run-metadata.json`](hosted-run-metadata.json), and the captured Apify log in [`hosted-run-log-pinned-final.txt`](hosted-run-log-pinned-final.txt).

### Per-query and edition strict counts

| Query          | GB local | GB hosted | US local | US hosted |
| -------------- | -------: | --------: | -------: | --------: |
| world news     |     8/10 |      8/10 |     8/10 |      9/10 |
| politics       |     7/10 |      6/10 |     6/10 |      6/10 |
| business       |     7/10 |      7/10 |     6/10 |      6/10 |
| technology     |     8/10 |      8/10 |     6/10 |      7/10 |
| climate change |    10/10 |     10/10 |     9/10 |      9/10 |

### Retry evidence

The final pinned local and hosted runs contained no qualifying transient publisher response, so they issued no retry. A superseded pre-pinning hosted run observed one justified HTTP 503 retry on row `q5-gb-08`: attempt 1 returned 503 and the one additional request also returned 503. Access remained 503, identity remained unverifiable, and the retry did not change strict success. It added one bounded publisher GET; the run's total Apify usage was $0.0010548036, but marginal per-request billing was not separately reported. This run is retained as `hosted-results-pre-pinned-superseded.json`; it is not the final acceptance run because its DNS validation was not pinned to the socket.

### Superseded execution records

- Run `qucBPtccC6YhknGKN` / build `ff7MAA5j9eFlIBuxW`: superseded after review found entity normalization and mismatch adjudication defects.
- Run `Elw4umZiOM0dddUDb` / build `OuuO1CT6bmKziAWDH`: superseded because DNS answers were checked before fetch but not pinned to the connection.
- Run `fb01FIaxyn5eRlafA` / build `jslSiwDfVTu4jQYbM`: failed before the probe started because the hosted wrapper dependency was absent; no publisher requests were made.
- Final run `oiLOkd2rSc4WAYTAg` / build `bhBBv5ohtKDQamR4D`: exact pinned-address replay used for the conclusion.

## 5. Findings

- The marker/RPC path returned candidates for 100/100 rows in both the final local and hosted runs.
- The hosted environment produced 81 HTTP 200 HTML pages and 78 article-like markers, but only 79 title matches and 76 strict successes. Local strict success was 75/100. Both are below the unchanged 95/100 gate.
- The final local/hosted results differ by one strict success on the same frozen inputs; live publisher responses and egress can vary. No 401/403/451 access denial was retried.
- Strict outcomes differ on exactly three rows: `q1-us-06` is strict only in the hosted run (local 451; hosted 200 with a confirmed match and article marker), `q2-gb-04` is strict only locally (local 200 with a confirmed match and article marker; hosted 403), and `q4-us-08` is strict only in the hosted run (local 403; hosted 200 with a confirmed match and article marker). The two hosted gains and one hosted loss produce the net +1 difference. These are live access/response differences; no classifier discrepancy was found.
- The corrected conservative adjudication moved ambiguous or conflicting titles to unverifiable. Twenty-one hosted rows and 22 local rows remain unverifiable, so the evidence does not establish whether every such destination is actually the same story.
- The tested marker/RPC plus bounded publisher HTTP path does not meet #4's target on this sample. This is evidence against relying on this tested path for the gate, not proof that every future HTTP-only resolver is impossible.

## 6. Limitations and residual risks

- This is one frozen 100-row RSS snapshot replayed in two runtime/network environments. Google News and publishers remain live and volatile; the inputs are frozen but destination behavior is not.
- The exact-title rule is deliberately conservative. Editorial title changes, truncation, omitted signals, or conflicting metadata can create false negatives and unverifiable rows. It does not count topical similarity as identity proof.
- Candidate extraction depends on Google's undocumented marker/RPC behavior, which can change. This work did not establish an official supported Google resolver contract.
- Public-address validation pins each resolved A/AAAA answer used for the publisher connection and blocks special/private ranges classified by the pinned library. The probe does not test publisher-specific allowlists or network-layer egress policy.
- Apify did not report the runtime region, and the two results cannot characterize future variability or a stable long-term success rate.
- This discovery does not validate full-text extraction, paywall behavior, dataset delivery, charging or production Actor behavior.

## 7. Conclusion

**Result: Not feasible for the tested marker/RPC plus bounded publisher HTTP path on this fixed sample.** The final strict count was 75/100 locally and 76/100 on Apify Node 20, both below the required 95/100.

No >=95/100 contract is supported for #4 by this tested path. The result does not rule out every alternative HTTP-only resolver; evaluating a materially different approach requires a new approved investigation. The title identity of 21 hosted and 22 local rows remains unverifiable, so no broader impossibility claim is warranted.

## 8. Downstream implications

- Keep #4 and its draft implementation on hold. Do not relax its acceptance threshold based on this discovery.
- After this evidence is integrated, rerun `assess-change` on #4. That reassessment decides whether to close, reformulate or pursue a separately approved alternative, and whether any design/planning artifacts are warranted.
- Issues #5, #6 and #7 remain blocked through #4. This Issue did not implement the resolver and does not authorize production work.
- No Product Definition or Architecture Definition change is justified by this result.

## 9. Reproducibility and validation

From `docs/changes/18/`, install with `npm ci`, run the focused safety checks with `npm test`, then run `node probe.mjs` to replay the frozen manifest. Do not use `node probe.mjs --refresh`; that captures a different sample. Current file hashes are recorded in `hosted-run-metadata.json`. Formatting the captured JSON for repository readability changed its file SHA-256 to `d1ed2bea31efc54358ac24d991a9037ec0f0840ccd50547c01bd794c64389f3c`; the canonical row-array SHA-256 remains `fdbab474e5764350c547080c0002f042b062e03f157a270d5b9474d846ad2f2a`. Pre-format hashes for the hosted execution are preserved in that metadata.

Validation performed: `npm ci`; seven focused `node:test` cases passed; syntax checks passed for the probe modules; `npm run validate` passed formatting, lint, typecheck, 42 repository tests and build; final local Node 24 replay completed 100 rows; final exact-build Apify Node 20 replay completed 100 rows and verified dataset coverage/hash integrity. The Actor, all builds, runs and per-run stores were created only for this discovery; cleanup verification is recorded in `hosted-run-metadata.json` after completion.

Cloud cleanup completed after evidence capture: all four created runs, all four builds, and the disposable Actor were deleted. Run-associated datasets, key-value stores and request queues were removed with their runs/Actor. Follow-up CLI lookups found no task-created build or Actor IDs.

**Learning checkpoint:** A reusable DNS pinning lesson was identified; it is being captured separately by the orchestration workflow.
