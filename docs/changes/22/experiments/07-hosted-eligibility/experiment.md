# Iteration 7 -- hosted eligibility and gate/proxy discordance

**Status:** Proposed for owner review only. Iteration 6 approval does not authorize this hosted experiment. No Actor build/run or publisher request has occurred.

## Purpose and hypothesis

Iteration 4 had 31 pre-extraction challenge/gate skips and 25 other not-attempted rows, leaving at most 44/100 possible proxy accepts in that cohort even if every one of 44 extraction timeouts had passed. This is below Issue #5's 50/100 target under those classifications, but it is one cohort and gate signals may disagree with extracted output.

**Hypothesis:** A fresh 100-row cohort may have a different permitted-HTML eligibility rate, and comparing the existing pre-extraction gate signal with the structural proxy on the same fetched response will reveal gate/proxy discordance candidates. Such a discordance is not proof of a false positive, false negative, classifier sensitivity or article readability.

## Proposed cohort and procedure

If separately approved, acquire one fresh cohort in-run with the same five queries, GB/US locales and ten feed rows per cell (100 rows, ten cells). Keep the existing direct-HTTP controls: concurrency four, ten-second request timeout, five redirects, 256 KiB response prefix, 250 ms per-host spacing, public DNS validation/pinning, bounded retries, robots handling and per-row failure isolation. Skip robots disallowed, unavailable or truncated-unknown; proceed on robots not-found.

For each final permitted 2xx `text/html` or XHTML response already fetched, call `extractFromHtml(htmlPrefix, publisherUrl)` exactly once, including when the pre-existing `challengeLike` signal is positive. Never call a URL-fetching extraction API and make no extra publisher request. Keep extraction serial with a five-second worker bound. Preserve all 100 planned rows in the denominator; report fetch/robots/gate exclusions and extraction outcomes separately.

## Exact proxy rule

Use `experiments/04-hosted-readability/src/readability-proxy.mjs` unchanged. For output <=1,048,576 characters it removes comments, scripts, styles, noscript and hidden text; normalizes/segments; then returns `accepted_proxy` only with >=100 English-letter words, >=2 substantive segments each >=20 words, and distinct consecutive five-gram ratio >=0.80. Its implemented statuses include `empty`, `oversize`, `too_short`, `quality_rejected`, `accepted_proxy` and `error`.

The Iteration 4 plan additionally declared a navigation/chrome token ratio `<0.35`, but the helper never implemented that rule. The historical erratum is recorded in the Iteration 4 experiment artifact. Iteration 7 deliberately uses the existing helper without a navigation/chrome filter and labels its result an **optimistic structural proxy**. A proxy pass is not Issue #5 acceptance or `fullTextStatus: success`. >=50/100 meets only this proxy threshold; <50/100 falls short under this proxy.

## Gate/proxy comparison

For each eligible attempt, cross-tab the existing gate signal with extraction/proxy outcome into descriptive aggregate classes:

- gate-positive + accepted proxy;
- gate-positive + scored but not accepted;
- gate-positive + timeout/error/not scored;
- gate-clear + accepted proxy;
- gate-clear + scored but not accepted;
- gate-clear + timeout/error/not scored.

These are discordance/agreement counts only. A gate-positive row passing the proxy is a discordant candidate, not a verified classifier false positive. No human review or content-quality claim is included.

## Retained data and privacy

Persist only aggregate counts by opaque cohort cell: planned rows; destination/feed outcomes; robots, HTTP and transport classes; eligible 2xx HTML; gate signal counts; extraction and proxy status counts; gate/proxy comparison counts; coarse timing and response-prefix-size bins; and run/build/runtime/cost/memory metadata. No row-level records are persisted. Keep URLs, hostnames, titles, HTML, article text, cookies, exception text and raw logs transient only; do not write them to files, datasets or PR artifacts. Use no temporary human review surface.

## Operational bounds and stop conditions

- Exactly one private disposable Actor build/run if approved; Node 20, server-enforced user-set `$1` maximum charge, 256 MiB, 900 seconds, restart disabled. Verify private visibility and each setting before start.
- Exactly 100 complete rows; no retry of the cohort or hosted run. Preserve existing HTTP/robots/DNS/prefix/retry/row-isolation bounds.
- No browser, paywall bypass, proxy, managed unblocking, paid external service or new dependency.
- Stop if privacy allow-list fails, raw fields could be persisted/logged, a cap/private-visibility setting cannot be verified, cohort is incomplete, or an unexpected access service is required. Do not retry.

## Local-only preflight

`src/preflight.mjs` is an offline synthetic check only. It verifies the exact implemented proxy behavior, ten-cell/100-row denominator accounting, gate/proxy cross-tabs and aggregate-only serializer. It injects raw-field sentinels in memory to confirm they never appear in output, and statically uses no network client. It does not build an Actor, access a feed, request a publisher page or contact Apify.

## Expected interpretation

Report aggregate counts and conditional ceilings with the full 100-row denominator. A gate-positive accepted proxy is only a discordant candidate; the proxy is optimistic because it has no implemented navigation/chrome test, and its pass rate is not human-readable-text evidence. This experiment can update the sampled access/eligibility and gate/proxy relationship; it cannot prove false-positive rates, population success, fullTextStatus success, or satisfy Issue #5.

## Result

Not run. Waiting for explicit approval of this exact Iteration 7 only.

## Next checkpoint

After the one approved run, update the sampled access ceiling and recommend the next highest-value investigation. Do not infer production adoption or authorize another hosted run.

## Learning checkpoint

Pending execution.
