# Iteration 4 — hosted readability proxy evaluation

## Purpose and approval

Measure whether owner-approved `@extractus/article-extractor@9.0.1` can produce substantial, structured, nonrepetitive text from a fresh 100-row publisher cohort in Apify Node 20. Approval covers this one hosted Spike evaluation only; it does not approve production adoption. The extractor receives already-fetched bounded HTML and is never asked to fetch a URL.

## Pre-run hypothesis and cohort

On a fresh cohort with ten rows in each of five existing Google News query × two locale cells, at least 50 of the planned 100 rows will pass a predeclared in-memory extraction proxy. This tests whether Iteration 3's four authored positive fixture results on local Node 24 transfer to the target runtime and live HTTP cohort.

Exactly one private Actor build/run acquired fresh RSS data in-run. The cohort must be exactly 100 rows with ten per cell; no second run or retry of an incomplete run was authorized. The direct HTTP procedure kept concurrency four, ten-second request timeout, manual redirects capped at five, 256 KiB publisher response prefix, 250 ms per-host request spacing, public DNS validation/pinning, robots skip on disallow or unknown/truncated robots, bounded retry policy and per-row failure isolation.

## Predeclared eligibility and proxy

Eligible extraction input is a final HTTP 200 HTML response already fetched under the probe's robots policy and without the obvious challenge/access-gate signal. Call `extractFromHtml(htmlPrefix, publisherUrl)` once; never call the package's URL-fetching API. The input prefix is capped at 256 KiB. Extraction is globally serial in a worker thread, with the five-second timer covering worker startup, dynamic import, extraction, message transfer and parent scoring. Exceptions, timeouts and oversized output are isolated per row.

For in-memory output up to 1,048,576 characters, parse the markup, discard comments, script/style/noscript and hidden text (`hidden`, `aria-hidden=true`, or inline `display:none`/`visibility:hidden`), decode entities, collapse whitespace, and segment paragraphs, headings, list items and `<br>`. Tokenize English-letter words with optional straight/curly apostrophes. `accepted_proxy` requires at least 100 words, at least two segments each containing at least 20 words, a distinct consecutive five-word-sequence ratio of at least 0.80 within those substantive segments, and a navigation/chrome token ratio below 0.35. The navigation/chrome list is `home, news, world, local, business, technology, climate, latest, most, read, watch, live, subscribe, sign, in, account, search, newsletters, podcasts, events, advertise, contact, follow, download, app, weather`. Empty output is `empty`; fewer than 100 words is `too_short`; other proxy failures are `quality_rejected`; worker deadline and exception classes are `timeout` and `error`.

The denominator is all 100 planned rows. A passing proxy rate is only a structural signal; it cannot establish intended-article match, absence of subtle boilerplate, coherence, or human readability. It does not establish `fullTextStatus: success` or Issue #5 acceptance.

## Operational and privacy bounds

Use one private disposable Actor and one hosted run; Node 20; 256 MiB; 900-second timeout; restart disabled; server-enforced maximum total charge `$1`. Verify Actor visibility/permission and the run options before starting. Stop on a cap mismatch, unexpected paid access service/proxy, URL-bearing persistence/log output, incomplete cohort or material scope conflict. No browser, paywall bypass, proxy, managed unblocking or paid external service. Never retain publisher URLs, names/hosts, titles, HTML, article text, cookies or raw logs. Hosted mode sends only sanitized per-row items to the default dataset and does not write `local-results.json`.

## Hosted execution evidence

- Actor `u7Arb7xwwXT4L7UFM` was private with `LIMITED_PERMISSIONS`; build `JixHitVDKLI84WNqm` / `0.4.1` succeeded from the Node 20 image.
- Exactly one run was started: `SkzjjjnVbnDgxIVtk`. It succeeded with exit code 0 on Node `v20.20.2`; elapsed `323.164` seconds; no restart; finished `2026-09-29T18:37:13.536Z`. Run API metadata confirmed 256 MiB, 900 seconds, `maxTotalChargeUsd=1`, `isMaxTotalChargeUsdSetByUser=true`, and `restartOnError=false`.
- Final run metadata after evidence retrieval recorded usage total `$0.0052094971533649505`, `0.0224419444` compute units, average/peak memory `71,089,291` / `109,015,040` bytes, average/peak CPU `4.887` / `125.711`, and network receive/send `33,354,949` / `919,972` bytes.
- Candidate resolution succeeded for `100/100`. Access results: HTTP 200 HTML `75`, HTTP 403 `11`, HTTP 406 `1`, robots unavailable/skipped `9`, robots disallowed/skipped `4`.
- The dataset API returned 100 unique rows with ten in each cell. All 44 eligible rows reached the five-second full-worker timeout. The 31 gate/challenge rows were skipped before extraction; the probe persisted these as extraction status `quality_rejected`, which is a misleading code label for a pre-extraction skip. They are counted here as challenge skips, not extractor-quality results. Twenty-five other rows were not attempted due to robots, HTTP denial or transport status. No row returned extracted output for proxy scoring; `accepted_proxy=0/100` is therefore not a candidate readability verdict.

| Cell | Rows | HTTP 200 HTML | Timeout | Challenge skip before extraction* | Other not attempted | Accepted proxy |
| ---- | ---: | ------------: | -------: | ---------------------------------: | ------------------: | -------------: |
| q1-gb | 10 | 8 | 7 | 1 | 2 | 0 |
| q1-us | 10 | 8 | 7 | 1 | 2 | 0 |
| q2-gb | 10 | 7 | 3 | 4 | 3 | 0 |
| q2-us | 10 | 7 | 1 | 6 | 3 | 0 |
| q3-gb | 10 | 7 | 3 | 4 | 3 | 0 |
| q3-us | 10 | 6 | 4 | 2 | 4 | 0 |
| q4-gb | 10 | 9 | 6 | 3 | 1 | 0 |
| q4-us | 10 | 7 | 4 | 3 | 3 | 0 |
| q5-gb | 10 | 8 | 5 | 3 | 2 | 0 |
| q5-us | 10 | 8 | 4 | 4 | 2 | 0 |

*The retained dataset used the `quality_rejected` label for these 31 pre-extraction challenge skips; it did not invoke the extractor for them.

Sanitized dataset SHA-256: `0ef3bfa1878d5495486c0ad8742098d348d3c057f33cb3112196b3a6a9edd54a`. Its allow-list check found no unexpected fields and zero URL patterns. Run logs were scanned in memory, with zero URL patterns and no `probe_failed` signal, then discarded. The private disposable Actor was deleted after evidence collection; run and dataset remain retrievable. No raw publisher values or logs were retained.

## Local Node 20 timeout diagnosis

To distinguish worker startup cost from large-input parsing, a local-only diagnostic used the same locked package with authored fixtures and an in-memory generated synthetic HTML prefix. It made no publisher requests, retained no fixture/extracted text and added no hosted run. Local Node was `v20.19.0` (the hosted patch version was `v20.20.2`).

Four authored positive fixtures (997–1,352 input bytes) completed the full worker/import/extract/post/proxy path in `442.5–674.3` ms. Dynamic imports took `358.0–566.6` ms; extraction took `21.9–44.9` ms; parent proxy scoring took `1.6–10.1` ms. All four passed the structural proxy. An in-memory synthetic input of `262,088` bytes hit the same five-second worker deadline while the last observed phase was `extract_started`; it returned no output. The worker startup message arrived after about `39–52` ms on the authored fixtures and the content post took at most `0.2` ms when extraction completed. Sanitized phase results are retained in [`timeout-diagnosis.json`](timeout-diagnosis.json), and the local-only reproducer is [`src/diagnose-timeout.mjs`](src/diagnose-timeout.mjs).

For the 44 hosted timeout rows, sanitized response-prefix lengths were `23,756–262,144` bytes (median `162,419`); 15 prefixes were capped at 256 KiB. This supports large-input parsing as a plausible timeout contributor but does not diagnose the publisher rows: their HTML was not retained and hosted phase timings were not collected. The dependency's `extractFromHtml` API was inspected as extraction-only, with no URL fetch. The exact timeout phase for each hosted row remains unknown.

## Result and checkpoint

**Iteration result: Inconclusive.** The 100-row hosted operational test completed within its bounds, but the five-second full-worker deadline prevented meaningful proxy scoring. The observed `0/100` accepted count does not distinguish extraction quality from timeout behavior. The original Technical Question remains unresolved; no production dependency is approved and no full-text success claim is supported.

**Current understanding:** The existing direct HTTP path retrieved HTTP 200 HTML for 75/100 rows in this fresh cohort. The approved dependency tree ran under hosted Node 20.20.2. All 44 eligible live rows timed out; the diagnostic shows small authored fixtures complete within the deadline but one large synthetic fixture does not. This is evidence about the current measurement bound, not the quality of the unreturned live extraction output. Privacy, cohort completeness and cost/memory controls passed.

**Recommended next action:** Run a bounded local Node 20 input-size scaling diagnostic on authored/synthetic fixtures with phase timings to map where extraction exceeds five seconds. This is the highest-value next step because 15 live prefixes were capped and hosted timeouts ranged up to 256 KiB. Use no publisher requests; do not start another hosted run until a defensible worker deadline/memory bound is identified and separately approved.

**Prerequisite/blocker status:** The timeout affected the extraction measurement and blocks proxy interpretation and a further hosted cohort. Root cause is partially narrowed but not resolved: worker startup and message/proxy handling are well below five seconds on small fixtures; a 262,088-byte synthetic page timed out during extraction. The live page complexity/size contribution remains unknown. Recovery is size-scaling diagnosis with the exact lock, then a revised experiment design. No extra hosted run was started.

**Owner decision requested:** **Approve Iteration 5: a bounded local Node 20 input-size scaling diagnostic using only authored/synthetic HTML and the locked dependency, with no publisher requests or hosted Actor run.** If approved, identify a defensible per-row deadline and return a proposed hosted follow-up for a separate decision. If declined or redirected, Issue #22 and Issue #5 remain unresolved; the present evidence supports only direct-access observations.

## Validation and learning

Local `npm ci --ignore-scripts`, Node syntax checks for Actor/helper modules, and `apify validate-schema` passed before the hosted run. Node 20.19.0 syntax checks and the local timing diagnostic passed. The dataset was downloaded through the normal API and checked for 100 unique rows, ten per cell, allowed fields and URL patterns. Run settings, cost, runtime, memory, logs, dataset and Actor deletion were verified. No raw publisher content or logs were retained.

**Issue #22 completion validation:** Hold / Inconclusive. No Product/Architecture boundary changed. `Learnings: None`.

## Historical proxy implementation erratum

An implementation audit found that the pre-run proxy specification above included a navigation/chrome token-ratio threshold `<0.35`, but [`src/readability-proxy.mjs`](src/readability-proxy.mjs) does not calculate that ratio. The helper implements the output-size limit, text normalization/segmentation, minimum word and substantive-segment counts, and distinct five-gram threshold only. Therefore Iteration 4 did not measure the declared navigation/chrome criterion. The recorded `accepted_proxy=0/100` remains accurate: no row returned output for scoring, so no row passed or failed any output-quality criterion. Do not describe the navigation/chrome filter as evaluated.
