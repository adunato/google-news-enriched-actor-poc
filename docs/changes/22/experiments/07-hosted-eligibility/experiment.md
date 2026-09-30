# Iteration 7 -- hosted eligibility and gate/proxy discordance

**Status:** One approved hosted attempt was started and promptly aborted before cohort execution. The operator reports the likely cause was an initial response check looking for the user-set cap flag at the wrong JSON level; the exact launch/abort gate was not separately retained, so this cause is not independently proven. The run record has since confirmed the requested options. The approval did not authorize a replacement run; no retry or production adoption is authorized.

## Approval and launch gate

The approval covered one fresh 100-row cohort with private visibility, `LIMITED_PERMISSIONS`, Node 20, a server-enforced user-set `$1` maximum charge, 256 MiB, 900 seconds and restart disabled. The run was started with those options. The operator reports an initial check looked for `isMaxTotalChargeUsdSetByUser` at the run object's root rather than `options`; this is the likely abort cause, but was not independently recorded. The actual run record confirms the nested cap, user-set flag and resource options. No second run is authorized.

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

**Inconclusive; no cohort was measured.** Private Actor `Bfr473LGEb7zdZca5` (`LIMITED_PERMISSIONS`) was built as `Sn04suuqSPfk4aiFJ`, build `0.7.1`, from `apify/actor-node:20`. The single launched run `ivjPy5JwYppT1sCWq` returned options `maxTotalChargeUsd=1`, `isMaxTotalChargeUsdSetByUser=true`, memory 256 MiB, timeout 900 seconds and restart disabled. It was aborted after the initial response was misread; the final status is `ABORTED`, with a recorded 1-second duration, $0.0000638889 usage, 0 received/0 sent network bytes, and platform-reported average/peak memory and average CPU all zero. These zero resource metrics are not a useful measurement of normal Actor memory use. Its default dataset `W0boJKkPdqOpKkq7Z` contains 0 items. In-memory log inspection found no completion/failure marker and no URL patterns; raw logs were discarded. The telemetry shows no network bytes, but does not establish a completed publisher-request cohort. Sanitized metadata is retained in `run-options-verification.json`; no raw input, URL, page content or logs were retained. The disposable Actor was deleted; the aborted run and empty dataset remain available.

An earlier malformed CLI Actor-creation request unexpectedly created a default empty Actor named `my-actor`; it was deleted immediately, with no build/run.

## Next checkpoint

The highest-value next action is an offline run-options shape test before attempting the cohort again. That test is now added. The original approval was consumed by the aborted hosted attempt, so request a new approval for exactly one replacement 100-row cohort only after the offline check passes. Do not infer production adoption or start another run under the prior approval.

## Learning checkpoint

The run API nests `isMaxTotalChargeUsdSetByUser` under `options`; checking a guessed root-level location caused this one attempt to be aborted. The regression is captured in the local offline run-options helper/test. No broader project learning record was added.
