# Iteration 8 — local worker lifecycle timing

**Status:** Completed once as approved. Ten of ten cases finished or reached the per-case timeout; no retry occurred. This result remains Inconclusive for the original Technical Question.

## Hypothesis

Iteration 7's 78 eligible extraction calls all timed out at the five-second worker deadline, including one eligible prefix below 16 KiB. Hosted timing did not identify whether startup, import, extraction, result delivery/scoring, or worker exit consumed the deadline. The hypothesis is that a bounded local measurement using the same fresh-worker protocol can identify the stage responsible for most elapsed time on authored inputs.

## Why this is the next useful test

Iterations 5–6 already measured synthetic input-size and complexity effects, including startup/import and extraction. Iteration 7 had no phase telemetry. This diagnostic adds explicit lifecycle and exit instrumentation around the same exact dependency and five-second worker flow, including a case below the smallest eligible hosted prefix bin. It informs whether a worker lifecycle or deadline proposal is warranted before another hosted evaluation. It cannot establish the cause for live publisher HTML or readability.

## Exact bounded experiment

Run once, serially, across ten cases:

| Markup shape | Exact UTF-8 input sizes |
| --- | --- |
| Semantic article with headings and paragraphs | 8, 32, 96, 192, 256 KiB |
| Generic nested `div` containers | 8, 32, 96, 192, 256 KiB |

Generate synthetic English content entirely in memory. Use only a reserved `fixture.invalid` URL. Start one fresh worker per case and call `extractFromHtml(html, fixtureUrl)` exactly once, matching Iteration 7's worker lifecycle. Do not retry a timed-out case.

Instrument and retain these sanitized phases:

- parent worker construction to first worker-ready message;
- dynamic Extractus import duration;
- extraction call duration;
- extraction-complete event to result message arrival (result post/delivery interval);
- parent proxy-scoring duration;
- result message to natural worker exit, and exit code class;
- end-to-end worker construction to result message/exit and timeout stage.

The five-second per-case deadline runs from worker construction through result message delivery, matching the production probe's result deadline. Worker exit is observed only within the remaining five-second case window; if unobserved by that deadline, terminate and classify exit observation as unavailable. Enforce a 90-second total deadline. Retain exactly ten sanitized case records and one summary; no HTML, extracted content, URL, exception message or other raw fixture material is retained.

## Environment and input limits

- Local Windows Node `v20.19.0`.
- Use the already installed `@extractus/article-extractor@9.0.1` from Iteration 7's package lock and `node_modules`; do not install packages or change dependencies.
- Fresh worker per case, one active worker maximum.
- Exact target inputs: 8/32/96/192/256 KiB; maximum input 256 KiB and extracted output 1 MiB.
- Parent and worker old-space limits: 128 MiB each; stop if process RSS exceeds 256 MiB.
- One run; 5 seconds per case and 90 seconds overall; no retries.

## Network and privacy controls

The harness uses only authored synthetic markup and `fixture.invalid`. Before importing Extractus, both parent and worker replace global `fetch`, Node HTTP/HTTPS request/get, and socket connection entry points with throwing counters. Any attempted network access is a hard stop and is not retried. The runner does not read publisher data or credentials. Extracted synthetic content stays in memory until scoring and is discarded. Persist only case ID, markup shape, actual byte count, sanitized phase timings/status/exit class, output character count, structural proxy counts, aggregate counters, Node/package identity and process RSS. Never write or log raw HTML, extracted content, URL, exception text or credentials.

## Stop conditions

Stop without retry if any case exceeds the total deadline, any network entry point is attempted, input/output/memory bounds are crossed, the package lock/version check fails, case count differs from ten, raw values could reach logs/results, or the exact Node 20 executable is unavailable. Record any incomplete run as inconclusive and preserve only sanitized cases completed before the stop.

## Expected interpretation

Compare phase durations and timeout/exit stages across the two shapes and five sizes. A repeatable dominant local phase supports focusing a future worker/deadline proposal on that stage; it does not prove why the hosted publisher rows timed out. Keep the five-second bound unchanged until a stage is identified. This synthetic diagnostic cannot establish live extraction quality, human readability, Issue #5 acceptance, population limits, or authorize another hosted run.

## Pre-run decision

**Owner approval:** The user approved exactly one local-only Iteration 8 worker-lifecycle diagnostic with authored Node 20 inputs, five-second per-case and 90-second total bounds. Approval does not authorize network access, an Actor/build/run, publisher requests or production changes.

## Result

**Observed environment and bounds:** Node `v20.19.0`; exact locked `@extractus/article-extractor@9.0.1`; 10/10 serial cases. Overall elapsed time was 23,008.980 ms, sum of per-case totals 22,988.194 ms, and unallocated harness/setup overhead 20.786 ms. Peak RSS was 158,425,088 bytes (256 MiB stop bound). All ten worker counters and parent intercepts reported zero network attempts. No publisher data, Actor, hosted build/run, or external network request was used.

**Phase summary:** Startup 29.958–57.110 ms (median 50.982; n=10); dynamic import 151.341–353.252 ms (median 313.406; n=10); extraction 43.870–3,951.960 ms (median 196.782; n=7 completed); result delivery 0.018–0.194 ms (median 0.038; n=7); parent scoring 4.727–31.237 ms (median 7.491; n=7); exit after result 8.196–31.387 ms (median 13.788; n=7). Three cases timed out during extraction and were terminated. Their observed wall-clock totals were 5,008.607–5,019.215 ms because the timer initiated termination at 5,000 ms and total timing includes worker teardown. This does not extend the processing deadline. Seven returned outputs were rejected by the structural proxy; the generated repeated text was a harness fixture and these proxy results are not publisher quality evidence.

| Shape | Input | Extract phase | Result |
| --- | ---: | ---: | --- |
| Semantic article | 8 KiB | 43.870 ms | Returned; proxy rejected |
| Semantic article | 32 KiB | 83.668 ms | Returned; proxy rejected |
| Semantic article | 96 KiB | 458.627 ms | Returned; proxy rejected |
| Semantic article | 192 KiB | 3,951.960 ms | Returned; proxy rejected |
| Semantic article | 256 KiB | Timed out at 5 s | Terminated during extraction |
| Generic nested div | 8 KiB | 50.997 ms | Returned; proxy rejected |
| Generic nested div | 32 KiB | 196.782 ms | Returned; proxy rejected |
| Generic nested div | 96 KiB | 1,090.185 ms | Returned; proxy rejected |
| Generic nested div | 192 KiB | Timed out at 5 s | Terminated during extraction |
| Generic nested div | 256 KiB | Timed out at 5 s | Terminated during extraction |

**Interpretation:** Extraction dominated the near-deadline local cases. The semantic 192 KiB case completed just below five seconds, while generic nested-div at 96 KiB took 1,090 ms versus semantic 96 KiB at 459 ms. Thus size and markup shape may affect extraction cost for these authored fixtures. Startup plus import remained below about 411 ms; delivery, scoring and observed post-result exit were small among completed cases. This does not explain Iteration 7's all-78 hosted timeouts: one eligible hosted prefix was below 16 KiB, while both local 8 KiB cases completed in less than 0.5 seconds total. The environments, input structures and content differ, and hosted stage telemetry remains missing. No universal safe input cap or deadline can be inferred. Keep the five-second bound unchanged pending identification of the hosted timeout stage. No Issue #5 readability result was measured.

**Retained evidence:** [`results.json`](results.json) contains the sanitized ten-case observations and aggregate; [`preflight-report.json`](preflight-report.json) records offline lifecycle validation. Run `node validate-results.mjs` for read-only schema/privacy/bounds validation. JavaScript syntax checks and `git diff --check` passed. The result file was not modified after the single matrix run.

## Checkpoint after Iteration 8

**Recommended next action:** Prepare and request separate approval for one aggregate-only hosted phase-telemetry diagnostic on a fresh bounded 100-row cohort, after an offline preflight of the instrumented worker path. Keep the five-second per-row deadline, existing direct-HTTP/robots/DNS/privacy and cost/memory/time bounds, and emit only aggregate phase/exit timing bins plus eligibility and input-size denominators. Do not extend the timeout or retry rows.

**Why this is next:** Local measurement shows extraction can consume most of five seconds on larger synthetic inputs, but cannot explain the target-runtime result: all 78 eligible hosted rows timed out, including the one eligible prefix below 16 KiB, and no hosted stage counters were retained. Another synthetic ladder cannot resolve this hosted lifecycle uncertainty; the current cohort also has no proxy output for quality assessment. Aggregate phase data from the intended runtime would distinguish startup/import and exit/delivery problems from extraction cost with the highest current information value.

**Prerequisite/blocker status:** No blocker affected this completed local iteration. Any hosted phase diagnostic is a new hosted action outside the consumed Iteration 7 approvals and local-only Iteration 8 approval. This is an authorization prerequisite, not an experiment failure. Recovery is to implement and offline-validate aggregate instrumentation, then request approval for one exact private Node 20 cohort and server-enforced cap before any build or run. Keep the five-second timeout unchanged until the stage is identified.

**Owner decision requested:** Approve one separately capped hosted phase-telemetry diagnostic after its local preflight is reviewed, or decline/redirect. Approval should be limited to one fresh 100-row private Node 20 cohort with the existing user-set $1 cap, 256 MiB, 900-second timeout, restart disabled, aggregate-only retention and no retries. It does not authorize a longer timeout, production adoption or another run.

**Consequence of approval:** Complete offline instrumentation/preflight, then execute only the approved cohort and stop at its result checkpoint with sanitized phase/exit, eligibility/size-bin, cost, memory and run evidence.

**Consequence of decline or redirect:** Issue #22 remains Inconclusive and open. Iteration 8 supports only synthetic local timing; the cause of the hosted timeouts and Issue #5 readability remain unresolved. Any different hosted method, larger deadline or production change requires its own decision.

**Learning checkpoint:** None. No reusable cross-project lesson was established.
