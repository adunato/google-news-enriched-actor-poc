# Iteration 7 -- hosted eligibility and gate/proxy discordance

**Status:** The first approved attempt was aborted before cohort execution. The user approved exactly one replacement on 2026-09-30; its 100-row cohort completed under the approved limits. Iteration 7 remains Inconclusive because no eligible extraction completed within the five-second worker bound. Neither approval authorizes another run or production adoption.

## Approval and launch gate

The first approval covered one fresh 100-row cohort with private visibility, `LIMITED_PERMISSIONS`, Node 20, a server-enforced user-set `$1` maximum charge, 256 MiB, 900 seconds and restart disabled. Its run record confirmed those options but it was aborted before cohort measurement. The operator reports an initial check looked for `isMaxTotalChargeUsdSetByUser` at the run object's root rather than `options`; this is the likely abort cause, but was not independently recorded. The user then approved exactly one replacement attempt with the same cohort and bounds. That replacement completed; no further run is authorized.

`src/verify-run-options.mjs` and `src/run-options-preflight.mjs` now validate the nested API response shape, exact build number and every required run bound using synthetic input plus sanitized run metadata. They reject missing or root-level-only cap flags before a run is considered verified.

## Purpose and hypothesis

Iteration 4 had 31 pre-extraction challenge/gate skips and 25 other not-attempted rows, leaving at most 44/100 possible proxy accepts in that cohort even if every one of 44 extraction timeouts had passed. This is below Issue #5's 50/100 target under those classifications, but it is one cohort and gate signals may disagree with extracted output.

**Hypothesis:** A fresh 100-row cohort may have a different permitted-HTML eligibility rate, and comparing the existing pre-extraction gate signal with the structural proxy on the same fetched response will reveal gate/proxy discordance candidates. Such a discordance is not proof of a false positive, false negative, classifier sensitivity or article readability.

## Proposed cohort and procedure

If separately approved, acquire one fresh cohort in-run with the same five queries, GB/US locales and ten feed rows per cell (100 rows, ten cells). Keep the existing direct-HTTP controls: concurrency four, ten-second request timeout, five redirects, 256 KiB response prefix, 250 ms per-host spacing, public DNS validation/pinning, bounded retries, robots handling and per-row failure isolation. Skip robots disallowed, unavailable or truncated-unknown; proceed on robots not-found.

For each final permitted 2xx `text/html` or XHTML response already fetched, call `extractFromHtml(htmlPrefix, publisherUrl)` exactly once, including when the pre-existing `challengeLike` signal is positive. Never call a URL-fetching extraction API and make no extra publisher request. Keep extraction serial with a five-second worker bound. Preserve all 100 planned rows in the denominator; report fetch/robots/gate exclusions and extraction outcomes separately.

## Exact proxy rule

Use `src/readability-proxy.mjs`, copied without behavior changes from Iteration 4. For output <=1,048,576 characters it removes comments, scripts, styles, noscript and hidden text; normalizes/segments; then returns `accepted_proxy` only with >=100 English-letter words, >=2 substantive segments each >=20 words, and distinct consecutive five-gram ratio >=0.80. Its implemented statuses include `empty`, `oversize`, `too_short`, `quality_rejected`, `accepted_proxy` and `error`.

The Iteration 4 plan additionally declared a navigation/chrome token ratio `<0.35`, but the helper never implemented that rule. The historical erratum is recorded in the Iteration 4 experiment artifact. Iteration 7 deliberately uses the existing helper without a navigation/chrome filter and labels its result an **optimistic structural proxy**. A proxy pass is not Issue #5 acceptance or `fullTextStatus: success`. >=50/100 meets only this proxy threshold; <50/100 falls short under this proxy.

## Gate/proxy comparison

For every row, retain an aggregate cross-tab of gate signal (`gate_positive`, `gate_clear`, `gate_unavailable`) against each extraction outcome (`not_attempted`, `timeout`, `error`, `empty`, `oversize`, `too_short`, `quality_rejected`, `accepted_proxy`). This is the predeclared full gate-by-extraction/proxy outcome table; no row-level cross-tab is retained.

These are descriptive counts only. A gate-positive row passing the proxy is a discordant candidate, not a verified classifier false positive. No human review, classifier accuracy estimate, or content-quality claim is included.

## Retained data and privacy

`src/probe.mjs` performs the cohort in memory and calls `Actor.pushData` once, only after the full 100-row/ten-cell aggregation validates. It emits one allow-listed aggregate dataset item; it has no per-row dataset write. An incomplete cohort or pre-sink error emits no dataset item. Per-row failures are reduced to fixed outcome classes; top-level and exit errors use fixed log strings. The dataset item contains only aggregate counts by opaque cohort cell: planned rows; feed/destination outcomes; robots, HTTP and transport classes; eligible 2xx HTML; gate signal counts; extraction and proxy status counts; the full gate-by-outcome table; and coarse timing and response-prefix-size bins. Record sanitized build/run/runtime/cost/memory metadata separately in the experiment artifact after any approved run. Never persist row IDs, URLs, hostnames, titles, HTML, article text, cookies, exception text or raw logs. No local raw manifest/results file is written. Use no temporary human review surface.

## Operational bounds and stop conditions

- Exactly one private disposable Actor build/run if approved; Node 20, server-enforced user-set `$1` maximum charge, 256 MiB, 900 seconds, restart disabled. `hosted-run-options.json` records these required options. It does not itself enforce platform settings; verify private visibility and every server-side value through the Apify run configuration before any start.
- Exactly 100 complete rows; no retry of the cohort or hosted run. Preserve existing HTTP/robots/DNS/prefix/retry/row-isolation bounds.
- No browser, paywall bypass, proxy, managed unblocking, paid external service or new dependency.
- Stop if privacy allow-list fails, raw fields could be persisted/logged, a cap/private-visibility setting cannot be verified, cohort is incomplete, or an unexpected access service is required. Do not retry.

## Local-only preflight

`src/preflight.mjs` is offline and synthetic only. It calls the same exported `executeIteration7` pipeline, `inspectHtmlForIteration7` gate/extraction function and aggregate sink used by the Actor path, supplying an in-memory matrix and fake network-stage results. It sends both a gate-positive and gate-clear synthetic HTML response through the actual locked worker/package extraction path; checks one worker at a time and tests termination at the configured five-second deadline; validates the 100-row/ten-cell full cross-tab; and injects raw sentinels in row fields, candidate destinations, feed metadata and error messages to prove they are absent from the one emitted aggregate item. It also checks that an incomplete cohort emits no item and a failed sink is called once with sanitized data. Offline network tests cover public-DNS rejection/pinning, redirect resolution, robots rule selection, bounded response prefixes and a mocked request timeout. It asserts the required private/Node 20/`$1`/256 MiB/900-second/no-restart/one-run option record. These checks cannot verify Apify's server-enforced options; those must be inspected before an approved hosted launch. Preflight ran on local Node `v20.19.0` with the locked extractor `9.0.1`. It makes no real network request, does not build or launch an Actor, and makes no feed or publisher request.

## Expected interpretation

Report aggregate counts and conditional ceilings with the full 100-row denominator. A gate-positive accepted proxy is only a discordant candidate; the proxy is optimistic because it has no implemented navigation/chrome test, and its pass rate is not human-readable-text evidence. This experiment can update the sampled access/eligibility and gate/proxy relationship; it cannot prove false-positive rates, population success, fullTextStatus success, or satisfy Issue #5.

## Result

**The first attempt was Inconclusive; the approved replacement completed the cohort but did not score any extracted output.** First attempt: private Actor `Bfr473LGEb7zdZca5` (`LIMITED_PERMISSIONS`), build `Sn04suuqSPfk4aiFJ`/`0.7.1`, run `ivjPy5JwYppT1sCWq`; it was aborted after one second before cohort measurement. The nested run options had the required `$1` user-set cap, 256 MiB, 900-second timeout and restart disabled. The likely cause is operator-reported (checking the flag at the wrong JSON level) and not independently proven. Its dataset was empty and network counters were zero; that does not prove no request was attempted. Raw logs were discarded and the Actor deleted.

Replacement: private Actor `92K6tvwsserxl729y` (`LIMITED_PERMISSIONS`), build ID `tz0HwMbSVyJkP95ab`/version `0.7.1`, run `HODLEJIYZ5ESj4FWG`, from the `apify/actor-node:20` image. The run detail passed the committed nested-options verifier: exact build `0.7.1`, user-set `$1` cap, 256 MiB, 900 seconds, restart false. Status `SUCCEEDED`; duration 498.429 seconds; final usage `$0.00715251`; average/peak memory 74,184,643/111,677,440 bytes; average CPU 4.87%; total run network counters 34,652,070 bytes received and 939,481 sent. The network counters are not publisher-only. Source digest was not exposed in retained run/build metadata. The dataset `snsmC79RVurc4fB0f` has one allow-listed aggregate item and exactly 100 planned rows across ten cells. In-memory log checks found no URL-like patterns or article/title/cookie/HTML markers; no phase timings were present. Raw logs were discarded. The disposable replacement Actor was deleted and API not-found confirmed; run and sanitized aggregate evidence remain.

Results: 78/100 rows had permitted 2xx HTML; 22 were not eligible. All 78 eligible extraction calls timed out at the five-second worker deadline; 22 were `not_attempted`. `accepted_proxy=0/100`, with no extraction output scored; this is a timeout/runtime-bound result, not an extraction-quality rejection. The gate cross-tab was positive 33→timeout 33, clear 45→timeout 45, unavailable 22→not_attempted 22. No discordant proxy result was measured. Eligible-only prefix bins were 1 `<16 KiB`, 9 `16–<64 KiB`, 19 `64–<128 KiB`, 15 `128–<256 KiB`, and 34 at the 256 KiB cap. The stored histogram includes all 100 rows, so 22 noneligible zero-byte rows increase the `<16 KiB` count to 23. The zero proxy count is below the 50/100 predeclared threshold for this cohort; it does not establish an extraction-quality rate, population limit, or human-readable-text rate and does not satisfy Issue #5.

An earlier malformed CLI Actor-creation request unexpectedly created a default empty Actor named `my-actor`; it was deleted immediately, with no build/run.

## Next checkpoint

**Recommended next iteration:** One owner-approved local Node 20 worker-lifecycle diagnostic using the exact locked package and current worker protocol on authored synthetic HTML. Add aggregate-only worker boot/import/parse/post/exit counters and run lifecycle preflight across a `<16 KiB` case and larger sizes, with five-second per-case and 90-second overall bounds. This can identify which stage consumes the deadline without retaining page content. Keep the five-second deadline unchanged until a stage is identified; only then consider a separately approved hosted follow-up. Another cohort under the current bound risks reproducing timeouts, and directly raising it could approach the 900-second Actor cap. Synthetic output cannot establish publisher quality or Issue #5.

**Prerequisite/blocker and recovery:** The client-side run-options issue is corrected; the offline `npm run preflight:run-options` passed and the replacement's detailed run `options` confirmed each server-side bound. The Actor was deleted. The material blocker is that the current five-second worker bound timed out for every eligible row, with no phase-level timing. Failures span all eligible prefix-size bins, including one below 16 KiB; byte size alone does not explain them. If the diagnostic is declined or redirected, retain this bounded timeout result, do not request publisher data, and leave Issue #22 Inconclusive. Any future hosted cohort or timeout change requires separate explicit approval and a concrete runtime plan.

**Owner decision requested:** Approve or redirect exactly one local-only Node 20 worker-lifecycle diagnostic: authored synthetic HTML including a `<16 KiB` case and larger size bins; exact locked Extractus 9.0.1 and current worker protocol; aggregate phase/exit counters; five-second per-case and 90-second total bounds. No network, publisher data, Actor, production change or hosted rerun. Keep the worker deadline at five seconds until the stage is identified. If declined, retain the current Inconclusive result; approval does not authorize a later hosted run or production adoption.

## Learning checkpoint

The run API nests `isMaxTotalChargeUsdSetByUser` under `options`. The operator reports that checking a root-level location likely caused the first attempt to be aborted, but the exact launch/abort gate was not retained and the cause is not independently proven. The local offline helper validates the nested field and exact build. No broader project learning record was added.
