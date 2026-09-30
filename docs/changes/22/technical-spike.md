# Technical Spike: Automated news-site access capability and constraints

**Issue:** [#22](https://github.com/adunato/google-news-enriched-actor-poc/issues/22)

**Status:** The first Iteration 7 attempt was aborted before cohort measurement. The user approved exactly one replacement attempt on 2026-09-30; that replacement completed its full 100-row cohort under the approved limits. Iteration 7 remains Inconclusive for the original Technical Question because all 78 eligible extraction calls hit the five-second worker deadline and no proxy output was scored. Issue #22 remains open.

**Iteration result:** Inconclusive for the original Technical Question.

## Technical Question

What automated web-access approaches can this news POC/product family responsibly rely on to retrieve public publisher pages at useful reliability, and where are the practical technical, cost, operational, policy or legal boundaries that should cause the product to stop, degrade gracefully, or use a different data source?

## Living checkpoint after Iteration 7

### Current Understanding

The replacement Iteration 7 cohort completed all 100 planned rows across ten cells. In this one sample, 78 rows had permitted 2xx HTML and 22 were not eligible for extraction. All 78 eligible calls timed out at the five-second worker deadline; the remaining 22 were not attempted. Among eligible rows, the HTML prefix bins were 1 below 16 KiB, 9 from 16 to <64 KiB, 19 from 64 to <128 KiB, 15 from 128 to <256 KiB, and 34 at the 256 KiB cap. The stored raw prefix histogram uses all 100 rows, with the 22 noneligible rows assigned zero bytes; therefore its `<16 KiB` bin is 23. Therefore `accepted_proxy=0/100`, but the proxy did not score any extracted text. The outcome is a worker/runtime-bound failure for this sample, not evidence that Extractus produced low-quality text. The gate cross-tab was 33 positive + 33 timeouts, 45 clear + 45 timeouts, and 22 unavailable + 22 not-attempted; no discordant proxy result was observed. This one cohort does not establish population eligibility or classifier accuracy. The first attempt's operator-reported likely cause remains unproven and separate from the replacement result. Its zero network-byte and empty-dataset telemetry did not measure a cohort. Iteration 4's 44/100 conditional ceiling remains specific to that earlier cohort.

### Supported Technical Specification

The tested I7 implementation is locally runnable on Node 20.19 with the exact locked Extractus 9.0.1 dependency. It called extraction once on each of the 78 already-fetched permitted 2xx HTML responses, including gate-positive rows, using a serial five-second worker and persisted one validated aggregate after the complete cohort. The replacement run detail confirmed private `LIMITED_PERMISSIONS` Actor settings, exact build `0.7.1`, Node 20 base image, user-set `$1` maximum charge, 256 MiB, 900-second timeout and restart disabled. It completed in 498.429 seconds; final platform usage was $0.00715251, average/peak memory 74,184,643/111,677,440 bytes, average CPU 4.87%, and network counters were 34,652,070 bytes received and 939,481 sent for the whole run. The network counters do not distinguish feed and publisher traffic. The aggregate-only dataset contained one allow-listed item for 100 rows; raw logs were inspected in memory and discarded. The optimistic structural proxy cannot establish human readability, intended-article match, or Issue #5 acceptance.

### Remaining Uncertainty

The stage of the five-second failures is unknown: startup, import, parse, post, or worker exit. Hosted timing is only reported in coarse bins and no page content was retained. Fixed application log messages contain no per-row worker phase timings. All eligible rows timed out across the cohort's observed size bins, including the one eligible prefix below 16 KiB, so byte size alone cannot explain the failures. The aggregate does not provide a joint per-row size/phase trace. The build ID is `tz0HwMbSVyJkP95ab` (`0.7.1`); a source digest was not exposed in retained run/build metadata. The 0/100 proxy count is below the predeclared 50 threshold for this run, but it cannot be interpreted as 78 extraction-quality failures because no output was scored. No Issue #5 readability result or gate/proxy discordance was measured. A single sample cannot establish future cohort eligibility. The structural proxy also cannot establish readability or Issue #5 acceptance.

## Iteration 4 plan — one hosted readability-proxy run

**Current understanding:** Iteration 2 returned HTTP 200 HTML for 72/100 rows in a fresh hosted Node 20 cohort, but neither that run nor Iteration 3's local Node 24 fixture screen established readable extraction on publisher pages. Iteration 3 screened `@extractus/article-extractor@9.0.1` successfully on four authored positive fixtures and two negative fixtures. The owner explicitly approved this exact dependency and locked dependencies for one hosted Spike evaluation only; production use is not approved.

**Investigation backlog (ordered):**

1. Run one fresh, capped hosted Node 20 evaluation of the approved extractor on the established 100-row, ten-cell cohort, with a predeclared structural extraction proxy and sanitized output.
2. If the proxy is useful, recommend human-reviewable quality validation on a new approved sample; preserve uncertainty about intended-article match and actual readability.
3. Continue the broader access/policy/operational boundary investigation only through separately approved bounded iterations; no escalation to browser, proxies, managed unblocking or paid services is included here.

**Selected hypothesis:** At least 50 of the planned 100 fresh rows will produce extracted text that passes the predeclared structural proxy with the owner-approved extractor in Node 20.

**Why this is next:** This directly measures whether the local fixture screen survives the target runtime and a fresh publisher cohort under the already tested access controls. It has higher information value than another access-only baseline because readable text is the unmeasured Issue #5 acceptance signal.

**Exact bounded experiment:** Use `extractFromHtml(htmlPrefix, publisherUrl)` once for each eligible already-fetched response. Eligibility is final HTTP 200 HTML, robots allowed/not-found, and no obvious challenge/access-gate signal. Use only the existing 256 KiB fetched prefix. Extraction runs one at a time in workers with a five-second per-row termination deadline. No `extract(url)` call. The exact proxy, categories and sanitization are predeclared in [`experiments/04-hosted-readability/experiment.md`](experiments/04-hosted-readability/experiment.md): output cap 1,048,576 chars; remove comments/scripts/styles/noscript/hidden text; decode entities and collapse whitespace; segment paragraphs/headings/list items/BR; English-letter words with optional apostrophes; require >=100 words, >=2 substantive segments of >=20 words, >=0.80 distinct consecutive five-word-sequence ratio within those segments, and navigation/chrome token ratio below 0.35. Retain only proxy status and aggregate metrics; never retain body text.

**Representative environment/data:** One fresh in-run Google News feed cohort in Apify Node 20; five existing queries, GB/en-GB and US/en-US, ten feed rows in each of ten cells. Google marker/RPC resolution remains an undocumented investigation input, not a product contract. The cohort must be exactly 100 rows with ten in each cell.

**Expected evidence and interpretation:** Count `accepted_proxy` over all 100 planned rows; >=50 meets only this structural proxy threshold and <50 fails it. Not-attempted, empty, short, rejected, timeout and error rows remain in the denominator. The proxy cannot prove the extracted text matches the intended article, excludes subtle boilerplate, is coherent, or is human-readable. It does not establish `fullTextStatus: success` or Issue #5 acceptance. Capture sanitized dataset/API output and hosted run/build/runtime/cost/memory evidence.

**Operational bounds and stop conditions:** One private disposable Actor and one hosted run; server-enforced max charge `$1`, 256 MiB memory, 900-second timeout, restart disabled. Preserve Iteration 2 HTTP concurrency, ten-second request timeout, five redirects, 256 KiB prefix, host spacing, public DNS pinning, robots policy, and per-row isolation. No additional run, browser, paywall bypass, proxy, managed unblocking or paid external service. No raw URLs, titles, HTML, article text, cookies or raw logs may be retained. Do not start if privacy, visibility or server-enforced bounds cannot be verified. Delete the disposable Actor after collecting sanitized evidence; keep the run/dataset evidence.

**Owner checkpoint:** The owner approved exactly one hosted run using `@extractus/article-extractor@9.0.1` and its locked dependencies for this Spike iteration only. The dependency is not approved for production use. Execute the single capped experiment and stop at the next checkpoint.

## Iteration 4 evidence and checkpoint

**Experiment:** One fresh 100-row cohort was processed by one private Apify Node 20 Actor run, with ten rows in each of the ten planned query/locale cells. Candidate publisher destination resolution succeeded for 100/100 rows. Access results were HTTP 200 HTML 75/100, HTTP 403 11/100, HTTP 406 1/100, robots unavailable/skipped 9/100, and robots disallowed/skipped 4/100. The HTTP procedure retained the existing concurrency, timeout, redirect, prefix, DNS pinning, per-host pacing, robots, retry and row-isolation bounds.

**Environment and exact execution:** Actor `u7Arb7xwwXT4L7UFM` was private with `LIMITED_PERMISSIONS`; build `JixHitVDKLI84WNqm` / `0.4.1` used the Node 20 image. Exactly one run was made: `SkzjjjnVbnDgxIVtk`, status `SUCCEEDED`, exit code 0 on Node `v20.20.2`; elapsed `323.164` seconds; no restart. Run settings were 256 MiB, 900 seconds, restart disabled, and server-enforced `maxTotalChargeUsd=1` with `isMaxTotalChargeUsdSetByUser=true`. Final run metadata after evidence reads recorded usage total `$0.0052094971533649505`, `0.0224419444` compute units, average/peak memory `71,089,291` / `109,015,040` bytes, average/peak CPU `4.887` / `125.711`, and received/sent network bytes `33,354,949` / `919,972`.

The normal dataset API returned 100 unique rows, ten in every cell. The deterministic proxy accepted `0/100`. The 44 eligible already-fetched HTML rows all reached the predeclared five-second extraction-worker timeout. Thirty-one challenge/gate rows were skipped before extraction, and 25 other rows were not attempted due to robots, HTTP denial or transport status. The hosted dataset labeled the challenge skips `quality_rejected`; that code label is misleading because the extractor was never invoked for those rows. Count them as pre-extraction challenge skips, not extractor-quality results. The 44 timeouts are an observed measurement/runtime bound; they are not evidence that returned text was unreadable or that the extraction method is unsuitable. No extracted output was available to score.

For timeout rows, the sanitized input prefixes ranged from `23,756` to `262,144` bytes (median `162,419`); 15 were capped at 256 KiB. A local-only Node `v20.19.0` diagnostic with the same locked dependency and authored/synthetic fixtures showed four small authored fixtures completing the full worker/import/extract/post/proxy path in `442.5–674.3` ms (import `358.0–566.6` ms; extraction `21.9–44.9` ms; parent scoring `1.6–10.1` ms). An in-memory `262,088`-byte synthetic fixture reached the same five-second deadline during `extractFromHtml`, before output/post. This makes large-input parsing a plausible contributor, but it does not diagnose any live publisher row; the hosted run retained no HTML and had no phase instrumentation. No publisher requests or additional hosted run were made during this diagnostic. Sanitized timings and the local-only reproducer are retained in [`experiments/04-hosted-readability/timeout-diagnosis.json`](experiments/04-hosted-readability/timeout-diagnosis.json) and [`experiments/04-hosted-readability/src/diagnose-timeout.mjs`](experiments/04-hosted-readability/src/diagnose-timeout.mjs).

Sanitized dataset SHA-256: `0ef3bfa1878d5495486c0ad8742098d348d3c057f33cb3112196b3a6a9edd54a`. The retained dataset contains only opaque row/cell IDs, fetch classifications and bounded metrics. The output schema/privacy check found no unexpected fields and zero URL patterns. The run log was scanned in memory, showed zero URL patterns and no `probe_failed` signal, and was not retained. The disposable private Actor was deleted; run and dataset remain retrievable. No URL, title, publisher name/host, HTML, article text, cookie or raw log was retained.

**Iteration result:** `Inconclusive` for extraction quality and for the original Technical Question. The 100-row hosted operational test completed, but the extraction deadline prevented meaningful proxy scoring. The measured `0/100` accepted-proxy count does not distinguish extraction quality from timeout behavior. It does not establish `fullTextStatus: success` or Issue #5's 50% human-readable target. No production dependency or Product/Architecture change is approved.

**Current understanding:** The direct HTTP path retrieved 200 HTML for 75/100 rows in this fresh hosted sample. The approved candidate dependency tree installed and ran in Node 20.20.2. Every eligible extraction attempt hit the five-second worker deadline; the cause remains unknown. Cost, memory, dataset completeness and output privacy remained within bounds.

**Recommended next action:** Iteration 5 should run a bounded local Node 20 input-size scaling diagnostic on authored/synthetic fixtures with phase timings. This is the highest-value next step because 15 hosted prefixes were capped and a similarly sized synthetic input reached the extraction timeout, while small fixtures completed quickly. Use no publisher requests. Any later hosted publisher rerun needs a new owner approval after a defensible time/memory bound is identified; do not simply repeat the current experiment.

**Prerequisite/blocker status:** The timeout affected the completed extraction measurement and blocks meaningful proxy interpretation or another hosted cohort. It is a material runtime/measurement uncertainty, not an access or authentication prerequisite. The local diagnosis narrowed but did not resolve it: worker startup/import and parsing of small authored fixtures fit within the bound, while one 262,088-byte synthetic fixture timed out during extraction. Recovery is a bounded input-size scaling diagnostic and then a revised experiment design. No publisher request or extra hosted run was made.

**Owner decision requested:** **Approve Iteration 5: a bounded local Node 20 input-size scaling diagnostic using authored/synthetic HTML and the locked dependency, with no publisher requests or hosted Actor run.** If approved, identify a defensible per-row deadline and return a proposed hosted follow-up for a separate decision. If redirected or declined, Issue #22 and Issue #5 remain unresolved; current evidence supports direct-access observations only.

## Iteration 5 plan -- local synthetic input-size scaling

**Status:** Approved and executed as one local diagnostic. Iteration 4's authorization covered one hosted run only; Iteration 5 was separately approved for local synthetic inputs. It does not authorize another hosted run.

**Current understanding:** In Iteration 4, all 44 eligible hosted rows reached the five-second worker timeout; 15 response prefixes were capped, and the timed-out prefixes ranged from 23,756 to 262,144 bytes. A local Node 20.19.0 diagnostic with the same lock completed four small authored fixtures in 443-674 ms, while one 262,088-byte synthetic input timed out during extraction. Hosted execution used Node 20.20.2; the local patch version differs. The live publisher HTML was not retained, so the timed-out cases cannot be replayed.

**Hypothesis:** With a fresh worker per case, startup/import time remains below one second across the input ladder; extraction time is the main size-dependent cost, with at least one large synthetic case (128-256 KiB) reaching the five-second worker deadline while smaller cases complete. Comparing semantic article markup with generic nested-div markup tests whether structure changes the size boundary.

**Why this is next:** It separates fixed worker/import overhead from extraction cost and maps a reproducible synthetic size boundary before changing the hosted deadline or response cap. This is the best next measurement because the current hosted evidence includes many large prefixes and no retained page body to replay.

**Exact bounded experiment:** Use the exact Iteration 4 `package-lock.json`, `@extractus/article-extractor@9.0.1`, and already-installed dependencies. On local Node 20.19.0, generate in memory one semantic-article case and one generic-div case at each target input size: 16, 32, 64, 128, 192, and 256 KiB (12 serial cases total; actual UTF-8 byte count recorded). Use the same worker-thread call sequence and five-second timer as Iteration 4. Instrument worker start/import, `extractFromHtml`, content post, parent proxy scoring, and total elapsed time. Each case runs once in a fresh worker; terminate on five seconds and do not retry. Input never exceeds 256 KiB; extracted output is capped at 1 MiB. Use only synthetic/generated article text and `fixture.invalid` as the supplied base URL.

**Representative environment/data:** Local Windows Node `v20.19.0` with the exact lock used for hosted build `0.4.1`; generated synthetic English article markup in the two stated shapes. The local patch version is not the hosted `v20.20.2` patch version. No publisher URL, page, title, credential, cookie, or network request is part of this experiment.

**Expected evidence and interpretation:** Retain only case ID, markup shape, actual input byte count, phase timings, status/last phase, output character count, proxy classification and bounded word/segment metrics. If worker/import stays below one second and extraction grows past five seconds only at larger inputs, that supports a size-related timeout boundary for these synthetic shapes. If small cases time out or startup/import dominates, revise the worker/runtime design hypothesis. If both shapes complete, the prior synthetic timeout was not reproduced and no size threshold is established. In all outcomes, the diagnostic cannot establish publisher extraction quality or explain any specific Iteration 4 live row. Recommend candidate timeout/HTML-cap changes only for a separately reviewed follow-up design.

**Operational bounds and stop conditions:** One active worker; one pass over 12 cases; five seconds per case; 90-second overall deadline; 256 KiB maximum input; 1 MiB maximum output; launch the parent with Node's 128 MiB old-space cap and apply a 128 MiB worker old-space limit. Record process RSS and stop if it exceeds 256 MiB. Stop on package/lock identity mismatch, any attempted network access, unexpected persistence/logging of fixture text, input/output cap violation, memory-limit breach, or overall deadline. Timed-out cases are terminated and not retried. Keep this work under `experiments/05-local-size-scaling/`; no production or shared code changes.

**Deliverables:** A small local-only reproducibility script and sanitized `experiment.md`/metrics record with phase timings, size/shape outcome and a supported deadline/cap recommendation (or an explicit inconclusive result). Retain no generated fixture or extracted text. No hosted Actor, publisher request, cost or production change is included.

**Owner decision recorded:** Approved for one bounded local diagnostic only. Execution and evidence are recorded below; no later hosted run is authorized.

## Iteration 5 evidence and checkpoint

**Experiment:** Ran all 12 serial synthetic cases in the planned two markup shapes at 16, 32, 64, 128, 192 and 256 KiB. Each used one fresh worker and the five-second end-to-end deadline. Node `v20.19.0`, exact locked and installed `@extractus/article-extractor@9.0.1`; package-lock SHA-256 `d40e0664285e6ebdd6222ed452dd91c3fc2f77a4fa5f3abef652e9648868b3e2`. The run-level elapsed metric was `27,803.8` ms; the sum of per-case `totalMs` values is `27,190.2` ms. The `613.6` ms difference is unallocated harness overhead (synthetic input generation, inter-case orchestration and summary assembly); it was not separately timed and is not attributed to extraction. The overall clock starts just before the case loop and is sampled while assembling the summary before writing `results.json`; each case clock begins after that case's HTML is generated. All cases ran, with no global stop condition. The runner makes no network-client calls; workers replace global `fetch` and Node HTTP/HTTPS request/get with throwing/counting interceptors before importing the extractor. The nine completed cases report `networkAttempts: 0`; the three timeout cases report `null` because they emitted no counter before termination, so telemetry does not establish a zero counter for every case. Peak recorded process RSS was `76,201,984` bytes, below the 256 MiB bound. The parent was launched with `--max-old-space-size=128`; each worker used `maxOldGenerationSizeMb: 128` (only the worker limit is a result field).

| Synthetic shape | 16 KiB | 32 KiB | 64 KiB | 128 KiB | 192 KiB | 256 KiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Semantic article extraction | 69.8 ms | 154.1 ms | 502.6 ms | 1,758.7 ms | timeout at 5 s | timeout at 5 s |
| Generic nested-div extraction | 55.6 ms | 120.9 ms | 348.6 ms | 1,237.3 ms | 4,266.6 ms | timeout at 5 s |

All nine completed cases reached output post and parent proxy scoring; the three timeouts remained in `extractFromHtml`. Parent scoring took 3.5-14.0 ms. Worker import was 2,174.1 ms on the first case and 123.2-139.3 ms on subsequent fresh workers. Thus the hypothesis that import stays below one second across the ladder was false for this first-run measurement; extraction time increased sharply with input size in both generated shapes. The semantic shape timed out at 192 KiB while the generic shape completed that size close to the deadline, so a universal size threshold is not established. These timings are specific to a local Node 20.19.0 Windows process and generated repetitive markup; they cannot establish hosted Node 20.20.2 behavior or explain particular live rows.

The generated repeated text failed the structural readability proxy in every completed case; this is expected from the fixture design and is not an extractor-quality result. Output was measured only in memory, never persisted. The sanitized per-case results are in [`experiments/05-local-size-scaling/results.json`](experiments/05-local-size-scaling/results.json); the one-pass runner and worker are in that experiment's `src/` directory. No generated HTML or extracted text was retained.

**Iteration result:** `Inconclusive` for the original Technical Question and for live publisher quality. This diagnostic supports that extraction cost can dominate the five-second deadline as synthetic inputs grow, while worker startup is about 28-54 ms and proxy scoring is small; the first package import incurred a one-time 2.17-second delay. It does not provide a safe live-page byte cap or timeout recommendation because the content is synthetic, highly repetitive, and only one machine/runtime patch was tested. Iteration 4's 44 hosted timeouts remain unexplained on a per-row basis. No production dependency, timeout or input-cap change is approved.

**Recommended next action:** Before any more hosted extraction evaluation, seek approval for one local Node 20 complexity-control study: 12 serial cases using two structures (semantic article and nested div), three exact input sizes (64, 128 and 192 KiB), and two authored synthetic content profiles (unique varied prose at low markup density and equivalent-length repeated prose at high markup density). Use a fresh worker per case, five-second per-case and 90-second overall limits, 256 KiB input/1 MiB output caps, 128 MiB parent and worker old-space limits, and stop at 256 MiB RSS or any network attempt. Retain phase timings, size, profile, shape, sanitized proxy counts and completion phase only. This isolates the two factors absent from Iteration 5—text repetition and markup density—while rechecking the near-timeout 192 KiB point. It may inform a synthetic-only candidate cap/deadline, but cannot establish a safe live-page bound or publisher readability. It is higher value than another hosted cohort because the current evidence has no defensible bound for interpreting the prior 44 timeouts.

**Prerequisite/blocker status:** No execution blocker affected Iteration 5. A defensible live-page timeout/cap remains unresolved; the safe recovery is another separately approved local diagnostic before considering a hosted rerun. No production or hosted action is currently authorized.

**Owner decision requested:** **Approve one further local Node 20 complexity-control study: the 12-case 2-shape × 3-size × 2-content-profile cohort, with one fresh worker/case, 5-second per-case and 90-second overall deadlines, 256 KiB input/1 MiB output caps, 128 MiB old-space per parent and worker, 256 MiB RSS stop, and no network/publisher data.** This authorizes local synthetic work only. Any hosted publisher evaluation requires separate explicit approval. If declined, retain the current Inconclusive conclusion and do not rerun Iteration 4.

**Learning checkpoint:** None. The observed size sensitivity is specific to this extractor, version, runtime patch and synthetic corpus; it is not a portable operational rule.

## Iteration 6 approved plan — local synthetic complexity controls

**Owner approval:** The owner approved one local Iteration 6 matching the bounded cohort below. This authorizes synthetic local work only; no live publisher or hosted run.

**Current understanding:** Iteration 5 showed extraction times increasing with size for repeated synthetic inputs. At 192 KiB, semantic article markup timed out while generic nested-div markup completed in 4,266.6 ms. The content was repeated, so Iteration 5 did not distinguish text profile/markup density effects from outer structure. It did not establish a live page cap or explain Iteration 4's hosted timeouts.

**Hypothesis:** Holding HTML input bytes and outer shape constant, the repeated-prose/high-inline-markup profile will take longer to extract than unique varied prose with paragraph-level markup. The effect may differ between semantic-article and nested-div structures. This comparison measures the combined content-profile change, not repetition or markup density independently.

**Why this is next:** It repeats the ambiguous 192 KiB boundary and samples 64/128 KiB controls while crossing each shape and size with both content profiles. The balanced 2×3×2 cohort can show whether the prior shape-dependent boundary persists and whether profile shifts local extraction timing, without involving publisher content or another hosted run.

**Exact bounded experiment:** Run exactly 12 serial cases: `semantic_article` and `generic_nested_div` × 64, 128 and 192 KiB × `unique_low_markup` and `repeated_high_markup`. Generate each exact-size UTF-8 fixture in memory, assert its size, and use one fresh worker per case. Use `extractFromHtml(html, fixture.invalid URL)` with the Iteration 4 locked and installed `@extractus/article-extractor@9.0.1`. Record worker start, import, extraction, output post, parent proxy and case total timings; retain only case profile/shape/size, bytes, output character count and sanitized proxy metrics. Do not retry.

**Representative environment/data:** Local Windows Node `v20.19.0`, exact Iteration 4 lock; generated synthetic English prose only. The unique profile uses varied word sequences with paragraph-level markup. The repeated profile uses repeated English prose with inline span markup. Both profiles are generated at each target input size in both outer shapes. This is not a representative publisher cohort.

**Expected evidence and interpretation:** Compare extraction and full case timings for the two profiles within each shape/size pair, and compare shapes separately. Consistent differences support only a profile-associated cost on these fixtures because repetition and inline markup density change together. Timeout means the worker exceeded the measurement deadline; it is not a quality failure. The study cannot establish publisher readability, a universal safe input cap/deadline, or the cause of any Iteration 4 timeout. Report overall timer and per-case timer totals separately, including unallocated harness overhead and exact timer boundaries.

**Operational bounds and stop conditions:** One worker at a time; 12 cases maximum; five seconds per case; 90-second overall deadline; input cap 256 KiB; output cap 1 MiB; parent launched with `--max-old-space-size=128`; worker old-space 128 MiB; stop over 256 MiB RSS. Synthetic data only; no publisher URL or network request. Worker replaces global `fetch` and Node HTTP/HTTPS request/get with throwing/counting interceptors before importing the extractor. Stop if an attempt is reported, dependency identity or fixture/cap assertion fails, RSS exceeds the bound, or overall deadline expires. If a case times out before returning its network counter, retain null and do not claim zero attempts for that case. Never retain raw HTML or extracted text.

**Deliverables:** A local-only reproducibility runner/worker and `experiments/06-local-complexity/experiment.md` with sanitized per-case phase metrics, interpretation, limitations and a next decision checkpoint. No production/shared-code changes, Actor, hosted run or new dependency.

**Owner decision recorded:** Approved for this one bounded local iteration. After evidence is recorded, stop and return with the result and next recommendation; do not start another experiment under this approval.

## Iteration 6 evidence and checkpoint

**Experiment:** One local Node `v20.19.0` run completed the balanced 12 cases across two HTML shapes, three byte sizes and two synthetic profiles. Exact lock and installed `@extractus/article-extractor@9.0.1` were verified; package-lock SHA-256 was `d40e0664285e6ebdd6222ed452dd91c3fc2f77a4fa5f3abef652e9648868b3e2`. Preflight verified exact UTF-8 sizes. Run elapsed was `32,495.3` ms; per-case `totalMs` summed to `32,224.1` ms, leaving `271.2` ms unallocated fixture-generation/inter-case/summary overhead. Overall timing starts before the case loops and is sampled before results-file write; per-case timing begins after fixture generation. No retry or global stop condition occurred.

| Outer shape | Profile | 64 KiB | 128 KiB | 192 KiB |
| --- | --- | ---: | ---: | ---: |
| Semantic article | Unique, low markup | 487.3 ms, 7,960 words | 2,624.4 ms, 15,880 words | timeout at 5 s |
| Semantic article | Repeated, high markup | 263.5 ms, 3,024 words | 1,514.7 ms, 6,144 words | 2,738.8 ms, 9,216 words |
| Generic nested div | Unique, low markup | 1,171.3 ms, 7,963 words | timeout at 5 s | timeout at 5 s |
| Generic nested div | Repeated, high markup | 611.0 ms, 3,027 words | 1,593.3 ms, 6,147 words | 3,024.3 ms, 9,219 words |

Nine cases completed and reported `networkAttempts: 0`; three unique/low-markup cases timed out during extraction and report null network counters: semantic 192 KiB and nested-div 128/192 KiB. The harness itself makes no network-client calls, and workers block/count `fetch` and Node HTTP/HTTPS request/get before importing the extractor; no intercepted attempts were reported by completed cases, but timeout rows cannot be claimed as zero. Parent old-space was set by the `--max-old-space-size=128` launch option and each worker had a 128 MiB old-space limit. Maximum retained post-case RSS sample was `106,704,896` bytes; final RSS `94,535,680` bytes, below the 256 MiB stop.

**Plan limitation/deviation:** The cases held total HTML input bytes equal, but not extracted word count. The high-markup profile used more inline spans, reducing how many repeated phrases fit in a fixed byte size; the unique/low-markup profile returned roughly 2.6 times as many words at 128 KiB. Thus the observed timing differences apply to the combined profile and text volume; they do not isolate repetition or markup density. No rerun was made under the one-iteration approval. Sanitized phase and outcome data are in [`experiments/06-local-complexity/results.json`](experiments/06-local-complexity/results.json); the script and worker remain local to that experiment. No raw HTML or extracted text was retained.

**Iteration result:** `Inconclusive` for the original Technical Question and publisher readability. The unique/low-markup profile was slower at each comparable completed shape/size and timed out in three larger cells, while every repeated/high-markup case completed, including both 192 KiB cells. This is only an observed combined-profile difference; the unique profile also returned substantially more words. Shape affected outcomes: unique/low markup completed at 128 KiB in semantic markup and timed out at that size in generic nested divs. These synthetic observations establish neither a universal input cap nor a safe live deadline and do not explain the Iteration 4 publisher timeouts. No production change or hosted follow-up is approved.

**Recommended next action:** Prepare one fresh 100-row private hosted access/eligibility and gate/proxy-discordance cohort for owner review. In Iteration 4, 31 rows were challenge/gate skips and 25 other rows were not attempted, leaving at most 44/100 possible proxy accepts under those classifications, below Issue #5's 50/100 target even if all 44 timeouts had passed. This is conditional on one cohort; it does not establish a population ceiling. A new parser-only study cannot test the permitted-HTML ceiling or disagreement between gate signal and extraction proxy.

**Historical Iteration 4 proxy erratum:** The pre-run specification declared a navigation/chrome token ratio `<0.35`, but the implemented `readability-proxy.mjs` does not calculate it. Iteration 4's `accepted_proxy=0/100` remains correct because no output was scored; the nav/chrome criterion was not measured. See the erratum in `experiments/04-hosted-readability/experiment.md`.

**Prerequisite/blocker status:** None affected Iteration 6. The 44/100 ceiling is conditional on Iteration 4's single sample and its classifications; it blocks claiming that an extraction-only change would meet the 50/100 target on that cohort, not the population. A fresh cohort and aggregate gate/proxy comparison are the recovery path. No hosted run is authorized yet.

**Approval boundary:** Iteration 7 required separate approval because Iteration 6 authorization was local-only. The user approved one initial attempt and exactly one replacement attempt; both approvals are consumed. No further hosted run or production adoption is authorized.
## Iteration 7 approved method — hosted eligibility and gate/proxy discordance

**Status:** The first approved attempt was aborted before cohort measurement. The user separately approved one replacement, which completed on 2026-09-30. No further hosted run or production adoption is authorized by those approvals.

**Hypothesis:** A fresh bounded cohort may have a different permitted-HTML eligibility rate. Comparing the pre-existing challenge/gate signal with the structural proxy on the same fetched response will show aggregate disagreement candidates. A gate-positive row passing the proxy is not a proven false positive; a proxy pass is not evidence of true readability.

**Why this is next:** In Iteration 4, 56/100 rows were excluded before extraction. Extractor speed alone could not have lifted that cohort to the 50/100 proxy threshold. A fresh eligibility cohort with same-response gate/proxy comparison is the highest-value way to reassess this sample ceiling. The result remains sample-specific and cannot establish that any disputed output is human-readable.

**Exact proposed experiment:** One fresh 100-row cohort using the same five Google News queries × GB/US × ten feed rows per cell, acquired in-run. Preserve existing HTTP/robots controls: concurrency four, ten-second request timeout, five redirects, 256 KiB response prefix, 250 ms per-host spacing, public DNS validation/pinning, bounded retries and per-row failure isolation; skip robots disallowed, unavailable or truncated-unknown and proceed on robots not-found. On every final permitted 2xx HTML response already fetched, call the locked extractor exactly once on bounded HTML, including responses with the existing `challengeLike` signal. Make no extra publisher request. Extraction remains serial with the existing five-second worker bound. Keep all 100 planned rows in the denominator.

**Proxy definition:** Use `experiments/04-hosted-readability/src/readability-proxy.mjs` unchanged. For output <=1,048,576 characters, require >=100 English-letter words, >=2 substantive segments of >=20 words and distinct consecutive five-gram ratio >=0.80, after the helper's implemented parsing/normalization/hidden-text treatment. The helper has no navigation/chrome ratio; Iteration 7 will not claim or apply one. Label this **optimistic structural proxy**: >=50/100 meets only this proxy threshold; <50/100 falls short under it. Neither outcome establishes `fullTextStatus: success` or Issue #5's human-readable-text acceptance.

**Gate/proxy comparison:** Persist aggregate counts for gate-positive + accepted proxy; gate-positive + scored but not accepted; gate-positive + timeout/error/not scored; and the same three outcomes for gate-clear rows. These are descriptive discordance/agreement categories only, not false-positive/false-negative rates, sensitivity or specificity. No human review is included.

**Representative environment/data:** One private disposable Apify Node 20 Actor/run using the same ten-cell fresh cohort. The extractor would run only within this separately approved Spike iteration. No browser, proxy, bypass, paid service or new dependency.

**Retained evidence and privacy:** Persist aggregate counts by opaque cohort cell only: planned rows, feed/destination outcomes, robots/HTTP/transport classes, eligible 2xx HTML, gate signal counts, extraction/proxy statuses, gate/proxy comparisons, coarse timing/response-prefix-size bins, and run/build/runtime/cost/memory metadata. Do not persist row-level records, URLs, hostnames, titles, HTML, article text, cookies, exception text or raw logs. Response content exists in memory only for the bounded fetch and extraction path; no human review surface is used.

**Operational bounds and stop conditions:** Exactly one private disposable Actor/build/run if approved; verify private visibility and a server-enforced user-set `$1` maximum charge, 256 MiB, 900-second timeout and restart disabled before launch. Stop if privacy allow-list, visibility or any bound cannot be confirmed, if the cohort is incomplete, or if an unexpected paid/access service or raw persistence is required. No retry or second run.

**Local-only preflight:** `experiments/07-hosted-eligibility/src/preflight.mjs` tests synthetic ten-cell/100-row denominator accounting, aggregate-only serialization, cross-tabs and the implemented proxy's lack of a nav/chrome filter. `run-options-preflight.mjs` validates sanitized API run-detail metadata at the correct nested `options` path, including the user-set cap flag and exact build. Both make no network request and fetch no feed or publisher page.

**Approval and outcome:** The first approved attempt used Actor `Bfr473LGEb7zdZca5`, build `Sn04suuqSPfk4aiFJ`/`0.7.1`, and run `ivjPy5JwYppT1sCWq`; it was aborted after one second before cohort measurement. Its nested options show the required bounds, but the operator-reported likely abort cause (checking a root-level field instead of `options`) is not independently proven. The dataset was empty and network byte counters were zero, which do not prove that no request was attempted. The disposable Actor was deleted. A malformed CLI creation also briefly made a default empty Actor; it was deleted without a build or run.

The user then approved exactly one replacement run. Private Actor `92K6tvwsserxl729y` had `LIMITED_PERMISSIONS`; build `tz0HwMbSVyJkP95ab`/`0.7.1` used `apify/actor-node:20`. Run `HODLEJIYZ5ESj4FWG` detail was checked against the committed nested-options verifier: `options.maxTotalChargeUsd=1`, `isMaxTotalChargeUsdSetByUser=true`, memory 256 MiB, timeout 900 seconds, restart false, exact build `0.7.1`. It succeeded in 498.429 seconds. Final usage was `$0.00715251`; average/peak memory 74,184,643/111,677,440 bytes; average CPU 4.87%; network counters were 34,652,070 received and 939,481 sent bytes for the whole Actor run. The private aggregate dataset `snsmC79RVurc4fB0f` contained exactly one item. Sanitized aggregate and run metadata are retained; logs were checked in memory for URL-like/sensitive markers and discarded. The disposable Actor was deleted after collection; run and dataset remain.

The 100-row denominator was complete across ten cells of ten. There were 78 permitted 2xx HTML rows and 22 rows not eligible for extraction. All 78 eligible extractions timed out at the five-second worker bound; 22 were not attempted. Thus `accepted_proxy=0/100`, but no extraction output was scored and this is not a quality failure classification. Gate-positive rows were 33 timeouts; gate-clear rows were 45 timeouts; 22 unavailable gate rows were not attempted. No gate/proxy discordance was measured. The result is below the 50/100 proxy threshold for this cohort, and does not satisfy Issue #5; it does not establish a population limit or human-readable-text rate.

**Next highest-value iteration:** Before considering another publisher cohort, seek owner approval for one bounded local Node 20 worker-lifecycle diagnostic using the exact locked package and current worker protocol on authored synthetic HTML. Add aggregate-only counters for worker boot/import/parse/post/exit stages and run the lifecycle preflight across sizes that include the observed `<16 KiB` and larger prefix bins; preserve the five-second per-case and 90-second total bounds. This can locate the stage that consumes the deadline without retaining page content. Keep the five-second deadline unchanged until a stage is identified. Only after that diagnosis should a separately approved hosted follow-up be considered. Another cohort under the current bound risks reproducing timeouts, while changing the timeout now would mask the cause and may approach the 900-second Actor cap. Synthetic output still cannot establish publisher quality.

**Prerequisite/blocker and recovery:** The prior run-options lookup issue is corrected and the offline nested-options verifier passed against the replacement run detail. The replacement's server-side limits were confirmed from `options`; the Actor has been deleted. The worker deadline is now the material runtime blocker to proxy scoring in this sample. Recovery is a local-only phase diagnostic and proposed worker/deadline options for owner review; no hosted retry is authorized by either Iteration 7 approval. If declined or redirected, retain the current Inconclusive conclusion and leave Issue #22 open. Even a future proxy pass would require separate quality evidence and cannot alone establish Issue #5.

**Owner decision requested:** Approve or redirect exactly one local-only Node 20 worker-lifecycle diagnostic: authored synthetic HTML including a `<16 KiB` case and larger size bins, exact locked Extractus 9.0.1 and current worker protocol, aggregate phase/exit counters, five-second per-case and 90-second total bounds. No network, publisher data, Actor, production change or hosted rerun. Keep the worker deadline at five seconds until the stage is identified. If declined, retain the current Inconclusive result; approval does not authorize a later hosted run or production adoption.
## Iteration 3 plan — local readability-method evaluation

**Current understanding:** Iteration 2 showed HTTP 200 HTML for 72/100 rows in one fresh Apify Node 20 sample. Neither hosted iteration retained page HTML or measured readable article text. Issue #5's acceptance criterion remains at least 50% readable full-text extraction on a representative 100-row sample. No extraction algorithm or dependency is approved for production use.

**Investigation backlog (ordered):**

1. Screen a candidate open-source readability method against authored, sanitized HTML fixtures using explicit expected article text and a lightweight no-new-dependency baseline where it can produce text.
2. If the candidate passes this local quality screen, present its exact dependency and hosted test proposal for explicit owner approval before any hosted run.
3. Only after approval, test readable extraction on a fresh representative 100-row cohort in the target Apify Node 20 runtime; measure the Issue #5 criterion with human-reviewable quality evidence.

**Selected hypothesis:** `@extractus/article-extractor@9.0.1`, called with already-fetched HTML and its URL, may identify readable article text across common publisher layouts without performing its own network fetch, and may outperform a minimal semantic-container baseline on a small local fixture set.

**Why this is the next useful test:** Readable text is the unmeasured acceptance signal blocking Issue #5. A local, authored-fixture screen can reject an unsuitable method cheaply and without publisher data or hosted spend. It cannot establish the representative 50% target, but it can inform whether a separately approved hosted evaluation is worthwhile.

**Exact bounded experiment:** Inspect the exact candidate package metadata, source and transitive dependency tree; verify the called API is extraction-only and does not fetch URLs; record license, install scripts, dependency count and Node compatibility evidence. Then evaluate serially against a small authored fixture corpus covering semantic article markup, generic div containers, navigation-heavy pages, short/metadata pages, malformed/truncated HTML, and blocked/consent pages. Use fixture-level expected title/body text and classify each output as readable or not. Cap fixture HTML at 256 KiB, set a per-fixture timeout and an overall time bound, isolate exceptions per fixture, and retain only authored fixtures, expected text, sanitized metrics and classifications. Compare a no-new-dependency semantic `article`/`main` baseline only where it emits text; do not treat marker-only signals as extracted text.

**Representative environment/data:** Local Node runtime, exact packed npm artifact for `@extractus/article-extractor@9.0.1`, and synthetic authored HTML fixtures with no live publisher data, URLs, page text, or credentials. The local environment is not Apify Node 20 and the fixture corpus is not representative of the 100-row acceptance cohort.

**Expected evidence and interpretation:** Retain candidate package identity/integrity, dependency and license facts, Node/API behavior, per-fixture output word counts/readable classifications, expected-body coverage and non-article contamination estimates, plus manual fixture-level quality review. A local pass supports only a candidate recommendation for an owner-approved hosted test. It does not satisfy Issue #5 or support adoption. Recommend against the candidate if it fetches independently, materially expands the approved dependency/risk boundary, or has systematic fixture failures/contamination.

**Operational bounds and stop conditions:** No publisher requests, no Apify Actor or hosted run, and no production dependency changes. Maximum six fixtures, each HTML input at most 256 KiB; serial execution with a 5-second fixture timeout and a 60-second overall cap. Install or unpack only within this experiment directory; disable lifecycle scripts. Stop on any unexpected network access, package identity/integrity mismatch, unsafe behavior, or fixture data leakage. Do not retain package caches, raw live pages, URLs, or sensitive output in Git.

**Owner checkpoint:** The owner approved local candidate-method evaluation within #22. That approval does not approve a production dependency or a hosted run. Return the candidate recommendation and exact dependency choice for explicit approval before any hosted evaluation.

## Context and scope

The first two iterations tested the lowest-complexity baseline: public direct HTTP access to publisher pages, first locally and then in the target hosted runtime. They did not test session state, browser execution, proxies, managed unblocking, paid APIs, or readable full-text extraction. The Product and Architecture boundaries remain unchanged.

Issue #5 requires at least 50% readable full-text extraction on its representative 100-row sample. This iteration's article marker and headline signals do not measure readable text and cannot satisfy that acceptance criterion.

## Iteration 3 evidence and checkpoint

**Hypothesis:** `@extractus/article-extractor@9.0.1` can extract readable text from already-fetched HTML across common layouts without making its own network requests, and improves on a minimal semantic-container baseline.

**Package inspection:** The exact npm package artifact was `@extractus/article-extractor@9.0.1`, MIT licensed, registry integrity `sha512-tI6tVthdtv3diHKg7SwiHrhwmP4AERKSa/0Cv/MT8cP7vFFMk74M1IgegZLf6pWtq4tdCxPdiDQ/77DVa0yTpQ==`. The package declares no install scripts and no Node `engines` range. Its two direct runtime dependencies are `@mozilla/readability@0.6.0` (Apache-2.0; Node >=14) and `linkedom@0.18.13` (ISC; Node >=16); the locked dependency tree installed 22 packages total, with optional `canvas` unmet. Source inspection confirms `extractFromHtml(html, url, options)` passes supplied HTML to parsing. Only the separate `extract()` URL path calls `retrieve()` and its fetcher. This experiment invoked `extractFromHtml` only. Node 20 compatibility remains unverified because this local run used Node `v24.15.0`.

**Experiment:** Six synthetic authored fixtures (four positive article layouts, two negative short/metadata or consent/block pages), each under 1.4 KiB, were processed serially. The candidate ran in isolated workers with a 5-second fixture timeout and 60-second overall cap. The no-new-dependency baseline extracted text only from semantic `article` or `main` containers. A result counted as readable when it had at least 100 words, expected-body unique-token recall >=0.55 and precision >=0.80. The evaluation retained only output word counts, token metrics and classifications; no extracted body text was written.

| Fixture class | Candidate result | Semantic baseline |
| ------------- | ---------------- | ----------------- |
| Semantic article | Readable, 113 words, recall/precision 1.00/1.00 | Readable, 116 words, 1.00/1.00 |
| Generic div article | Readable, 124 words, 1.00/0.99 | Not available |
| Navigation-heavy article | Readable, 117 words, 1.00/1.00 | Readable, 122 words, 1.00/1.00 |
| Malformed/truncated article | Readable, 120 words, 1.00/1.00 | Not available |
| Short metadata page | No readable output | 10 words; below readable threshold |
| Consent/block page | 54 words; below readable threshold | Not available |

The candidate passed the authored screen on all four positive fixtures and had no false positive on either negative fixture. The semantic baseline produced readable text on two of the four positive fixtures; it is intentionally unavailable for the generic-div and malformed cases. The candidate therefore adds fixture coverage in this narrow comparison. This supports a hosted evaluation recommendation only; six authored fixtures do not estimate publisher success or Issue #5's representative rate.

**Iteration result:** `Supported` for the bounded synthetic-fixture hypothesis. The original Technical Question remains `Inconclusive`: no fresh publisher HTML was tested, Node 20 behavior and hosted cost remain unmeasured, and the 100-row readable-text criterion remains untested. No production dependency is approved or added.

**Current understanding:** The inspected candidate can extract the authored fixture bodies when called with already-fetched HTML on local Node 24. Its separate URL convenience API performs fetching, so the tested function boundary can preserve the existing HTTP/robots controls. It expands the runtime dependency tree by 22 packages and has no declared Node engine range. Hosted compatibility and representative publisher quality are unknown.

**Recommended next iteration:** Iteration 4 — after explicit owner approval, run one capped private Apify Node 20 evaluation using `@extractus/article-extractor@9.0.1` on a fresh 100-row cohort stratified as ten rows in each of the existing five-query by two-locale cells. Keep the existing direct-HTTP, URL-resolution, robots, per-row failure isolation, and privacy constraints; invoke only `extractFromHtml` on the response bytes already fetched by the bounded pipeline. Collect per-row readable-status and word-count quality metrics plus run identity, Node version, cost, memory and sanitized failure classes. Set the same server-enforced $1 maximum charge, 256 MiB memory and 900-second timeout, and do not retry an incomplete run. Retain no URLs, titles, HTML or article text.

**Why this is next:** It tests whether the fixture result survives the target Node runtime and fresh publisher HTML, and whether readable output reaches the Issue #5 threshold under the already measured access conditions. No retained publisher HTML exists to replay locally.

**Prerequisite/blocker status:** None affected Iteration 3. A new dependency approval blocks Iteration 4. This is an explicit dependency/risk decision, not an authentication prerequisite. Recovery is to obtain approval for this exact package and bounded hosted evaluation, or redirect to another candidate/no-dependency approach. The candidate has no declared Node engine range, so the hosted Node 20 run must itself verify runtime compatibility before interpreting extraction rates.

**Owner decision requested:** **Approve `@extractus/article-extractor@9.0.1` and its locked runtime dependencies solely for the single bounded hosted Iteration 4 above.** This approval would authorize an experiment only, not production adoption. If approved, execute one private capped Node 20 run and return the per-row quality, runtime, cost and memory evidence. If redirected or not approved, do not use this package in a hosted run; Issue #22 and Issue #5 remain unresolved on readable-text success.

Reproducible code, authored fixtures and sanitized metrics are in [`experiments/03-local-readability/`](experiments/03-local-readability/); exact lockfile and output are retained there.

## Investigation

- Captured a fresh Google News RSS cohort on 2026-09-29: five broad queries (`world news`, `politics`, `business`, `technology`, `climate change`) across GB and US editions, three items per query/edition cell (30 total).
- Obtained candidate publisher destinations with the same Google marker/RPC approach used in prior Issues #14/#18. All 30 rows returned a syntactic candidate. This uses an undocumented Google endpoint as an investigation input; it is not a supported product contract.
- Probed candidates locally with Node.js 24.15.0 on Windows x64. Maximum concurrency was four; request timeout was 10 seconds; redirects were followed manually up to five; inspected HTML was capped at 256 KiB; public DNS answers were checked and pinned to the request; a 250 ms per-host request-start interval was applied.
- Sent an honest `GoogleNewsAccessSpike/0.1` user agent. Retrieved each publisher origin's `robots.txt` first; skipped a page when the matching path was disallowed or the robots signal was unavailable/truncated. A missing robots file was recorded separately.
- Kept input URLs in a temporary local manifest only. The script removes it after completion, including error handling. The retained row evidence contains publisher hostnames, response/status signals, and hashes; it contains no URLs, cookies, page bodies, or plaintext title values.

## Evidence

The completed run covered 30/30 rows and all ten query/edition cells (three rows per cell), with 21 distinct publisher hostnames. The probe window was `2026-09-29T14:45:12.875Z` to `2026-09-29T14:45:47.777Z` UTC.

| Observation                                       | Count |
| ------------------------------------------------- | ----: |
| Candidate publisher destinations                  | 30/30 |
| HTTP 200 HTML                                     | 19/30 |
| HTTP 403                                          |  4/30 |
| HTTP 451                                          |  1/30 |
| Skipped: robots unavailable                       |  4/30 |
| Skipped: robots disallowed                        |  2/30 |
| Robots file not found (page request proceeded)    |  1/30 |
| Article-like HTML marker                          | 19/30 |
| Headline identity heuristic matched               | 19/30 |
| Generic challenge/denial text heuristic signalled |  5/30 |

Robots outcomes are counted per row: 23 allowed, four unavailable, two disallowed, and one not found. The generic challenge/denial heuristic is not proof of a CAPTCHA or a particular access-control system. Article markers and headline matches are shallow page signals; neither establishes readable article text or content identity.

Publisher-stage elapsed time averaged 423.9 ms across rows (including robots-skipped rows, which can be near zero); maximum was 1,191 ms. Local resource cost is not a useful estimate of Apify hosted cost. No Apify run, hosted log, or hosted cost evidence was produced because the installed CLI had account metadata but no token in the environment or stored auth.

Sanitized row evidence is [`local-results.json`](local-results.json), SHA-256 `cb5f44ed758ed8c6d267d541f3ea9b8e0f9d11e1f0b707e7bb01c7fa616d34c5`. The fresh RSS row-array hash is `d56e23c8a266312e7ed5afd82643d18330caf2c52cad5708ff6754e50696e0d1`.

## Findings

- In this small local sample, bounded direct HTTP returned HTTP 200 HTML with an article-like marker for 19/30 rows. The remaining cases included publisher denials and rows skipped because robots access was disallowed or could not be established.
- Access varied across 21 hosts. Some public publisher pages were reachable under this probe's honest user agent; others denied access. This sample does not support a stable population-level success rate.
- Robots signals changed whether a request was made: two rows were disallowed and four were skipped because robots could not be retrieved or parsed safely. Terms of Service were not assessed in this iteration; no legal or contractual permission conclusion follows.
- The five generic challenge/denial signals need classification in a later iteration. No challenge solving, authentication, paywall access, or access-control bypass was attempted.
- The evidence distinguishes an HTTP response, an article-like marker, and a headline match. It does not establish readable full-text extraction, so the Issue #5 50% target remains untested.
- No Product or Architecture boundary change is supported by this iteration.

## Limitations and variability

- Thirty rows are an exploratory reduced sample, not the canonical 100-row capability sample. Three rows per cell provide little protection against query-result and publisher variability.
- Results are local to one network/runtime and one short UTC window. Apify Node 20 behavior, cost, memory, and hosted logs remain unmeasured.
- The candidate URLs were produced by Google's undocumented marker/RPC method. This iteration did not establish that method as a durable or approved resolver dependency.
- `robots.txt` handling was conservative for access: disallowed and unavailable/truncated signals stopped the publisher request. Robots rules are not a legal determination. Publisher Terms of Service and content-rights implications were not reviewed.
- Article-like and challenge/denial detection use bounded HTML prefixes and heuristics. No body was retained, and no article readability extraction was attempted.
- An earlier 100-row attempt with one-second pacing exceeded the practical run window and was stopped before sanitized results were written. Its raw transient input was removed. The completed 30-row sample uses a 250 ms per-host start interval; the interrupted attempt contributes no result counts.

## Conclusion

**Overall Spike result: Inconclusive.** Iterations 1 and 2 show that bounded direct HTTP can retrieve public HTML from a subset of sampled publisher pages, while denials and robots signals require row-level classification and fail-soft behavior. The 100-row hosted sample strengthens the target-runtime access baseline, but neither iteration measured readable full-text extraction. The broader access ladder and policy/legal boundaries remain unresolved; no permission conclusion follows.

## Iteration 2 plan — hosted direct-HTTP baseline

**Current understanding:** Iteration 1 observed mixed outcomes on 30 rows from 21 hosts on local Node 24. Direct HTTP returned 200 HTML for 19 rows; robots denials/unavailability and HTTP denials occurred. This is exploratory access evidence only: no readable-text extraction or permission conclusion was produced. Apify Node 20 runtime and hosted cost remain unknown.

**Investigation backlog (ordered):**

1. Measure the same bounded direct-HTTP access path from the target Apify Node 20 environment on a representative 100-row sample.
2. Classify the resulting access and robots outcomes by the ten query/edition cells and publisher host, without treating HTML markers as readable-text evidence.
3. Use the hosted baseline to select a later, separately approved test of session/state or browser requirements; defer proxies, managed unblocking, and paid data sources until their product and risk boundaries are explicitly reviewed.

**Selected hypothesis:** The 30-row local baseline may not represent the access outcomes from Apify's target network/runtime; a fresh 100-row cohort may expose materially different denial, robots, or transport rates.

**Why this is the next useful test:** It isolates hosted network/runtime effects while holding the access method and request controls constant. It gives later access-ladder tests a representative baseline without escalating to a heavier technique.

**Exact experiment:** Run one private disposable Actor build on Apify Node 20. During that single run, fetch a fresh Google News RSS cohort for five existing broad queries in GB and US editions, taking the first ten feed items from each of the ten cells (100 rows total). Resolve each Google News destination and probe publisher pages using the existing direct HTTP procedure. Keep concurrency at four, request timeout at 10 seconds, manual redirects at no more than five, publisher response prefix at 256 KiB, and 250 ms per-host request-start spacing. Apply the existing public-DNS validation/pinning and robots skip policy. Keep per-row failures isolated. The run must reject an incomplete 100-row cohort and must not retry the experiment automatically.

**Representative environment/data:** Apify Node 20 hosted runtime; current fresh public Google News feeds for `world news`, `politics`, `business`, `technology`, and `climate change`, each in GB/en-GB and US/en-US editions, ten rows per cell. The feed/RPC acquisition runs inside the Actor; no URL-bearing manifest is uploaded as input. The Google marker/RPC destination method remains an undocumented investigation input and is not asserted as a product contract.

**Expected evidence and interpretation:** Record exact Actor/build/run identity; Node/runtime and run settings; start/end time, total and per-cell row counts; candidate resolution outcomes; HTTP/robots/access-class counts; latency summary; dataset item count and sanitized dataset hash; platform usage cost and memory; and sanitized warning/error classes. Retain only publisher hostnames, row/cell identifiers, status/classification signals, and one-way hashes; do not retain URLs, titles, page bodies, cookies, or raw logs. HTML/article markers remain separate from readable-text evidence. Treat any meaningful local-versus-hosted rate change as a sample-specific observation, not a population success guarantee.

**Operational bounds and stop conditions:** The Actor remains private. Start exactly one run with Apify's server-enforced `maxTotalChargeUsd=1`, 256 MiB memory, and a 900-second timeout. If the API does not confirm that cost cap and run settings, do not start. Stop/abort on any cap/configuration mismatch, incomplete or URL-bearing persistence, unexpected paid service/proxy use, or a material access-control signal requiring a new decision. Do not retry a failed/incomplete run in this iteration. Delete the disposable hosted Actor and URL-bearing temporary stores after collecting the run's sanitized dataset and metadata; retain no raw logs or input. Do not claim the 50% readable-text criterion was measured.

**Owner checkpoint:** The user's request to examine Issue #22 and proceed with next steps authorizes this bounded Iteration 2 under the existing Spike scope. This checkpoint is limited to the stated direct-HTTP hosted baseline; any escalation to sessions, browser execution, proxy/network identity changes, managed unblocking, or paid APIs requires a new decision.

## Owner checkpoint — Iteration 1

**Recommended next iteration:** Iteration 2 — run the same bounded direct-HTTP baseline on a fresh stratified 100-row sample in the target Apify Node 20 runtime.

**Why this is next:** Iteration 1 established that direct HTTP sometimes works and exposed several failure classes, but it ran locally on a reduced 30-row sample. Before escalating to sessions, browser execution, proxies or managed unblocking, the Spike needs to know how much of the observed access behaviour changes simply because the workload runs from the intended hosted environment/network. This is the highest-value next discriminator and provides the representative baseline against which later access-ladder techniques should be compared.

**Prerequisite/blocker status:** A usable Apify API token was not available to the Iteration 1 executor.

- This **did not affect Iteration 1's completed local evidence**.
- It **does block the recommended hosted Iteration 2** because the target-runtime run cannot be launched without Apify authentication.
- This is currently an **ordinary execution prerequisite**, not evidence against the access hypothesis and not a Product/Architecture decision.
- Recovery: use the repository/workstation's supported Apify authentication path and verify the executor can launch a private hosted run before Iteration 2. If no usable credential can be obtained through the supported project setup, report that specific credential/setup problem and the exact owner action required; do not reinterpret it as a research result.

**Owner decision requested:** **Approve Iteration 2: 100-row hosted Apify direct-HTTP baseline, once the ordinary Apify-authentication prerequisite is satisfied.**

**If approved:** the executor should resolve/verify the ordinary authentication prerequisite, run only the approved hosted baseline with the existing bounded HTTP/robots/privacy controls, retain hosted outcome and cost evidence, update the access-failure classification, and stop at the next decision-ready checkpoint. It should not yet escalate to browser/proxy/unblocker techniques.

**If redirected/not approved:** the Spike remains unable to distinguish local-network behaviour from the target Apify runtime, so escalation-method comparisons would lack a reliable hosted baseline.

## Iteration 2 evidence and checkpoint

**Experiment:** One private disposable Actor run acquired a fresh 100-row cohort inside the Apify Node 20 runtime. It covered five queries across GB and US, ten rows in each of ten cells, and used the existing bounded direct-HTTP and robots procedure. The candidate resolver remains an undocumented Google marker/RPC investigation input, not a product contract.

**Environment and exact execution:** Apify Actor Node `v20.20.2`; Actor `557mC3yknShbfdUFj`, verified private and `LIMITED_PERMISSIONS`; build `VmbZa987nkwekkELF` / `0.2.1`; run `rs8Ld1Hbq48WKaPHi`; status `SUCCEEDED`, exit code 0. Run settings were 256 MiB, 900 seconds, restart disabled, and Apify server-enforced `maxTotalChargeUsd=1` (`isMaxTotalChargeUsdSetByUser=true`). Start `2026-09-29T16:31:21.109Z`; finish `2026-09-29T16:33:32.651Z`; elapsed `131.389` seconds. Platform usage was `$0.0025387885869575873` / `0.0091242361` compute units. Average memory was `72,294,011` bytes; peak `117,448,704` bytes. Average/peak CPU usage was `4.889` / `103.668`; received/sent network bytes were `34,023,567` / `893,821`.

The default dataset API returned 100 items from dataset `i0SFWOp2bDxXlTSiG`; every one of the ten cells contained ten items. There were 73 distinct publisher hosts. Sanitized downloaded dataset SHA-256: `b52c3db653ab34d0fcf64ff33bf22b494deb616b78b708551d423139c10ca0eb`. No raw URL/title/body fields or URL values were found in the dataset; the run log scan also found no URL values. No URL-bearing run input or manifest was uploaded or persisted. The private disposable Actor was deleted after evidence collection; the succeeded run and sanitized dataset remain available for audit. No raw logs, URLs, titles or page bodies were committed.

| Cell | Rows | HTTP 200 HTML | HTTP 403 | Robots unavailable | Robots disallowed | Robots not found | Article-like | Headline match |
| ---- | ---: | ------------: | ------: | -----------------: | ----------------: | --------------: | -----------: | -------------: |
| q1-gb | 10 | 6 | 1 | 2 | 1 | 1 | 6 | 6 |
| q1-us | 10 | 8 | 1 | 1 | 0 | 0 | 8 | 8 |
| q2-gb | 10 | 7 | 3 | 0 | 0 | 0 | 7 | 7 |
| q2-us | 10 | 6 | 2 | 1 | 1 | 0 | 6 | 5 |
| q3-gb | 10 | 7 | 2 | 1 | 0 | 3 | 5 | 7 |
| q3-us | 10 | 6 | 2 | 0 | 2 | 0 | 6 | 5 |
| q4-gb | 10 | 9 | 0 | 1 | 0 | 0 | 8 | 8 |
| q4-us | 10 | 7 | 0 | 2 | 1 | 1 | 7 | 7 |
| q5-gb | 10 | 7 | 1 | 2 | 0 | 0 | 7 | 7 |
| q5-us | 10 | 9 | 1 | 0 | 0 | 0 | 9 | 9 |

**Aggregate observations:** All 100 rows resolved to a candidate publisher destination. Access outcomes were HTTP 200 HTML `72/100`, HTTP 403 `13/100`, robots unavailable/skipped `10/100`, and robots disallowed/skipped `5/100`. Five robots files were not found and those page requests proceeded. Robots totals were 80 allowed, 10 unavailable, five disallowed, and five not found. Sixty-nine rows had an article-like HTML marker; 70 matched the headline identity heuristic; 68 met the combined strict marker-and-identity signal. A generic challenge/denial heuristic signalled 29 rows; this is not proof of CAPTCHA or a particular access-control system. These signals do not establish readable article text.

**Iteration result:** `Inconclusive` for the selected local-versus-hosted comparison and the original Technical Question. The hosted run supports that direct HTTP retrieves HTML for a subset of this sample, but the local and hosted cohorts differ in size and selection, so their rates are not a controlled comparison. It does not establish population reliability, readable-text success, or access permission. No retry was run. No Product/Architecture boundary change is supported.

**Current understanding:** The target Apify runtime can resolve all 100 selected Google News destinations and retrieve HTTP 200 HTML for 72 sampled rows under the approved direct-HTTP bounds. Denials and robots-unavailable/disallowed outcomes remain material and must fail soft per row. Robots-not-found is distinct from unavailable/disallowed and was treated as a proceed signal in five rows. HTTP status, article-like marker, and headline match remain separate observations. No content was retained to assess readable extraction.

**Recommended next decision:** Option A - authorize bounded candidate-method selection/evaluation within Issue #22's direct-HTTP investigation. This is recommended because Issue #22's broader completion criteria remain open, and Iteration 2 did not measure readable text. No extraction method, algorithm, or dependency is currently approved for Issue #5.

**Why this is next:** The hosted baseline established access and identity signals only. It cannot answer whether a method can produce readable text at Issue #5's required rate. A fresh sample is required because no HTML or article text was retained. Candidate selection can remain a Spike investigation, but any dependency must be explicitly approved before a hosted run uses it.

**Prerequisite/blocker status:** No blocker affected Iteration 2. Option A requires an owner decision on bounded candidate-method selection and explicit dependency approval before any hosted run using a newly selected dependency. This is a scope/dependency decision, not a platform-authentication problem. No extraction method should be described as already approved.

**Owner decision requested:** Choose one path:

- **Option A (recommended):** authorize bounded candidate-method selection/evaluation within #22's direct-HTTP Spike; decide on any proposed dependency before a hosted run.
- **Option B:** if the owner judges #22's access investigation sufficient, stop further access investigation and route readability-method selection to Issue #5's design. Current evidence does not meet Issue #22's broader completion criteria, so this option does not itself support closing #22 or claiming a Feasible/Not feasible conclusion. Keep the Spike open unless its criteria are met or the owner explicitly changes/stops the original required outcome.

**Consequence of Option A:** prepare a bounded candidate evaluation, obtain dependency approval before any hosted run, and return with evidence at the next checkpoint. **Consequence of Option B:** move readability-method selection to Issue #5 design while Issue #22 remains open/inconclusive until its own criteria are met or explicitly revised. No new run is authorized by this checkpoint alone.

## Downstream implications

- Keep Issue #5 blocked pending a supported access strategy and representative readable-text evidence.
- Do not promote this investigation's Google marker/RPC method, browser execution, proxy use, managed unblocking, or paid extraction into the product boundary.
- Proposed next hypothesis for owner review: repeat the direct HTTP baseline on a fresh 100-row stratified sample in the Apify Node 20 runtime, retaining the same request, robots, and privacy bounds; then separately assess readable-text signals and hosted cost. This requires valid Apify authentication and a decision to authorize the next Spike iteration.
- Issue #22 remains open. After the Spike reaches a supported conclusion and is integrated, reassess Issue #5 as specified in that Issue.

## Reproducibility

From `docs/changes/22/`, run `npm ci` and `node probe.mjs --refresh`. The script fetches a new 30-row cohort, records sanitized evidence in `local-results.json`, and removes its temporary URL-bearing input manifest. It uses `probe-network.mjs` for public-address validation, DNS pinning, redirects, timeouts, and bounded response prefixes. No hosted run was performed.

**Learning checkpoint:** None. This iteration produced no reusable cross-project lesson beyond its unresolved technical findings.
