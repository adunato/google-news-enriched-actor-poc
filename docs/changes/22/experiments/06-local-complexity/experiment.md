# Iteration 6 -- local synthetic complexity controls

**Status:** Executed once under the owner's local-only approval. No hosted run was made.

## Purpose and hypothesis

Iteration 5 found a size-related extraction cost in repeated synthetic content, but semantic 192 KiB timed out while generic nested-div 192 KiB completed near the five-second limit. This iteration holds total input size constant across two content profiles to test whether varied versus repeated text and markup density shift extraction time across the two outer structures.

**Hypothesis:** At the same target HTML size, repeated prose wrapped in high-density inline markup will extract more slowly than unique varied prose with low markup density. The difference may vary between semantic-article and generic nested-div outer structures. This local synthetic result cannot explain a specific hosted timeout or establish readable publisher extraction.

## Planned cohort and procedure

Run exactly 12 serial cases: two outer shapes (`semantic_article`, `generic_nested_div`) × three exact UTF-8 input sizes (64, 128 and 192 KiB) × two synthetic profiles (`unique_low_markup`, `repeated_high_markup`). Generate all HTML in memory and assert each fixture matches its target byte size before starting its worker. For each shape/size pair, produce one low-density profile with varied English-word sentence groups and paragraph-level markup, and one repeated-content profile with the same fixed repeated English prose wrapped in inline spans. The runner must vary both profiles at every shape and size; no case is retried.

Use the exact Iteration 4 lock and installed `@extractus/article-extractor@9.0.1`, local Windows Node `v20.19.0`, and `extractFromHtml(html, fixture.invalid URL)` in a fresh worker per case. Record worker-start, dynamic-import, extraction, output-post, parent proxy and case total timings. Retain profile/shape/size, exact input bytes, output character count and sanitized proxy counts; never persist or log fixture HTML or extracted text.

## Bounds and stop conditions

- Synthetic content only; no publisher data, live or hosted requests, Actor, credential or new dependency.
- One worker at a time; 12 cases maximum; five seconds per case; 90 seconds overall.
- Input at most 256 KiB and extracted output at most 1 MiB per case.
- Launch the parent with `--max-old-space-size=128`; apply a 128 MiB worker old-space limit; stop if process RSS exceeds 256 MiB.
- Worker instrumentation blocks and counts global `fetch` and Node HTTP/HTTPS request/get before extractor import. Stop if an attempt is reported; report null telemetry for any worker terminated before its counter is returned.
- Stop on dependency/lock mismatch, generation or cap assertion failure, memory breach, or overall deadline. Do not retry.
- No production or shared-code changes.

## Expected evidence and interpretation

Compare extraction and full per-case time across profiles within each shape/size pair. A consistent difference supports a profile-associated synthetic cost, not a causal claim about real pages; profile varies both text repetition and inline markup density. Compare the two outer structures separately. Any timeout is a worker/runtime measurement bound. Do not infer a universal safe byte cap or a live quality result. Record total-run time separately from the sum of per-case timings and state their timer boundaries and any unallocated harness overhead.

## Result

One pass ran all 12 cases on local Windows Node `v20.19.0` with the exact Iteration 4 lock and installed `@extractus/article-extractor@9.0.1`; package-lock SHA-256 was `d40e0664285e6ebdd6222ed452dd91c3fc2f77a4fa5f3abef652e9648868b3e2`. Preflight asserted every generated input at its exact target size. The run-level elapsed metric was 32,495.3 ms; the sum of case `totalMs` values was 32,224.1 ms. The 271.2 ms difference is unallocated fixture-generation/inter-case/summary overhead; it was not separately timed or assigned to extraction. The overall timer starts before the case loop and is read during summary assembly before writing `results.json`; case timers start after fixture generation. No overall, output, memory or network-reported stop condition fired; all cases were attempted and none was retried.

| Outer shape | Profile | 64 KiB extraction / output words | 128 KiB extraction / output words | 192 KiB extraction / output words |
| --- | --- | ---: | ---: | ---: |
| Semantic article | Unique, low markup | 487.3 ms / 7,960 | 2,624.4 ms / 15,880 | timeout at 5 s / unavailable |
| Semantic article | Repeated, high markup | 263.5 ms / 3,024 | 1,514.7 ms / 6,144 | 2,738.8 ms / 9,216 |
| Generic nested div | Unique, low markup | 1,171.3 ms / 7,963 | timeout at 5 s / unavailable | timeout at 5 s / unavailable |
| Generic nested div | Repeated, high markup | 611.0 ms / 3,027 | 1,593.3 ms / 6,147 | 3,024.3 ms / 9,219 |

All nine completed cases reached output post and parent scoring. Three cases timed out after `extract_started`: unique/low-markup semantic 192 KiB and unique/low-markup nested div at 128 and 192 KiB. Import times were 138.8-341.0 ms; proxy scoring took 14.4-110.9 ms on completed cases. The full sanitized per-case timings, statuses, output-character counts and proxy metrics are in `results.json`.

**Plan limitation/deviation:** Although every paired fixture had the same total HTML byte size, the generated profiles did not have equivalent extracted word counts. Because the repeated/high-markup profile uses more inline span tags, it consumed more of each byte budget with markup and yielded substantially fewer words than the unique/low-markup profile (for example, 15,880 versus 6,144 at 128 KiB semantic). Therefore this run compares combined fixture profiles, including both markup density/repetition and extracted text volume. It cannot attribute timing differences to repetition or markup density separately. This limitation was not visible until the sanitized per-case word counts were available. No rerun is made under the one-iteration approval.

The nine completed workers each reported `networkAttempts: 0`; the three terminated workers report `null` because their counter was not sent before timeout. The runner itself makes no network-client calls, and the worker installs throwing/counting interceptors for global `fetch` and Node HTTP/HTTPS request/get before extractor import. Thus no intercepted attempt was reported by completed cases, but the timeout rows do not provide counter telemetry and cannot be claimed as zero. Parent Node was launched with `--max-old-space-size=128`; each worker was limited to 128 MiB old-space (only the worker limit is in `results.json`). The largest retained post-case RSS sample was 106,704,896 bytes; the final RSS was 94,535,680 bytes, below the 256 MiB stop. Input sizes and output caps remained within bounds.

**Interpretation:** In both outer shapes, the unique/low-markup profile took longer than the repeated/high-markup profile at 64 KiB; at 128 KiB semantic both completed with the same ordering. The unique profile timed out in three larger cells while every repeated/high-markup case completed, including both 192 KiB cells. This is an observed combined-profile association, not an isolated content or markup cause: the unique profile produced substantially more extracted words at the same HTML size. Outer structure also mattered, since the unique profile completed at 128 KiB in semantic markup but timed out in nested div markup. No safe universal byte cap or live-page deadline follows from this synthetic result.

**Result:** Inconclusive for the original Spike question and live publisher quality. No production dependency, timeout, input cap or hosted follow-up is approved.

## Next checkpoint
The highest-value next step is a separately approved fresh access/eligibility cohort with an agreed transient privacy-review method for challenge/gate-positive pages. In Iteration 4's fixed 100-row cohort, 31 challenge/gate rows were skipped before extraction and 25 other rows were not attempted. That left at most 44/100 possible accepted proxies even if every eligible timeout had succeeded, below Issue #5's 50/100 target. This is a ceiling conditional on that cohort's classifications, not a population conclusion: a fresh sample may have a different eligible rate, and gate heuristics may have false positives.

Proposed bounds are one fresh private Node 20 run on the same 100-row design (five queries × GB/US × ten rows/cell), no extraction dependency calls, and the existing direct-HTTP controls: concurrency four, ten-second request timeout, five redirects, 256 KiB response prefix, host spacing, public DNS pinning, robots policy and per-row isolation. Classify HTTP/robots/transport outcomes and each challenge signal separately. Review flagged challenge prefixes only in a temporary private in-memory review surface; retain no URL, title, HTML, article text, cookies or raw logs. Persist only opaque cell/row identifiers, status classes, signal booleans, bounded byte counts and the reviewer's coarse class. Stop if privacy isolation or server cost/runtime bounds cannot be enforced; one run only, no retry. This directly measures whether access eligibility or gate classification is the limiting factor for the 50/100 target and has higher value than another synthetic parser ladder. Separate owner approval must authorize both the hosted run and this transient review method. If the review method is not approved, do not retain raw samples; a status-only cohort can measure the ceiling but cannot validate false-positive gate classifications.
## Learning checkpoint

None. The fixture-profile confound is specific to this local probe and does not establish a portable technical lesson.
