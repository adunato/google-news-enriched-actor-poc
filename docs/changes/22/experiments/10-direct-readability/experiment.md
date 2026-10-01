# Iteration 10 — direct Mozilla Readability (offline preflight)

**Status:** Corrected candidate offline preflight passed (17/17 checks) on 2026-10-01. The hosted publisher cohort has not run. This checkpoint stops before Actor/build/run activity so the exact candidate can receive independent review first.

## Question and hypothesis

Can direct `@mozilla/readability` parsing in the intended Node 20 Actor runtime extract useful article text from a representative set of permitted public publisher HTML pages, within a strict five-second per-row worker deadline and the approved memory, input, DOM, output and privacy limits?

The hypothesis is that Readability can return strict non-empty cleaned text for at least 50 of the 100 requested slots. Interpret this threshold only when the cohort contains 100 unique Google News URLs; a shorter unique cohort is non-decisive. Publisher eligibility and the number of eligible 2xx HTML rows are reported separately. This package does not test the hypothesis against publishers. It tests that the exact locked parser integration and measurement controls work locally without network access.

## Ranked option context

The living Issue #22 Spike artifact records the proportionate extraction option scan. Direct Mozilla Readability is the selected next candidate; Extractus is deprioritized after hosted timeouts, and Trafilatura and a Mercury-style parser remain alternatives. This iteration tests only Readability. It does not compare the options experimentally or resolve the separate Google access question.

## Bounded hosted cohort design

- Request five fixed Google News searches (`world news`, `politics`, `business`, `technology`, `climate change`), each in GB and US editions, for the first ten feed items per cell. This defines 100 fixed slots. Do not backfill missing or duplicate rows.
- Deduplicate on the original Google News URL, keeping the first slot. Retain source and publisher URLs only in memory. Report requested, returned, duplicate and unique counts; fewer than 100 unique rows is non-decisive.
- Resolve publisher URLs using the bounded Google News page/RPC path. For publisher requests, resolve and pin public DNS, check robots.txt conservatively, permit at most five redirects, use concurrency four, 250 ms per-host spacing and zero retries.
- For permitted publisher responses, accept 2xx HTML only and read at most a 512 KiB identity-encoded prefix. Run structured `ArticleBody` detection and direct Readability against the same HTML in a fresh worker.
- Include worker startup/import, parse and result delivery inside a 5,000 ms deadline. Terminate the worker at the deadline. Cap cumulative JSON-LD script text at 64 KiB, DOM elements at 10,000 and cleaned output at 100,000 characters.
- A strict Readability success requires a successful parse and non-empty cleaned text counted after whitespace normalization. Structured article-body evidence is counted separately so overlap can be measured.
- Stop scheduling new work at 780 seconds. Keep the Actor run capped at 900 seconds, 256 MiB and a user-set $1 maximum charge, with restart disabled. Before any hosted run, independently verify private visibility, `LIMITED_PERMISSIONS`, the exact build, and every run option. No hosted run is part of this offline preflight.

## Aggregate and privacy contract

Persist one aggregate only after the complete 100-slot cohort reconciles. It contains fixed cell identifiers, fixed status/timing/size bins and safe integer counts. It includes the strict Readability success total and reports whether it meets the 50/100 threshold only for a 100-unique-row cohort, plus access and extraction outcomes, structured-vs-Readability overlap, prefix/output/DOM caps and worker/publisher timing bins. No URL, hostname, title, row identifier, HTML, article text, exact timing, or exception string is retained or logged. Invalid, incomplete or privacy-tainted observations must result in zero sink calls.

## Offline preflight

Run `npm ci`, then `npx --yes --package=node@20.19.0 -- node src/preflight.mjs` from this experiment directory. The preflight runs under Node 20 with the exact pinned Mozilla Readability and LinkeDOM versions. It blocks parent network APIs and exercises DNS-publicness/pinning, robots decisions, redirect limits, deduplication, pacing, concurrency, prefix size, direct parsing of authored synthetic HTML, cumulative structured-data size, DOM/output limits, worker timeout termination, aggregate reconciliation/privacy, and a pure hosted-run gate verifier. Synthetic HTML uses only `fixture.invalid`; it is not retained. The sanitized `preflight-report.json` contains fixed check IDs and environment/configuration hashes only.

## Result

The reviewed candidate had three defects: robots group selection ignored the probe's product token, the request timer did not cover DNS and the response body as one wall-clock bound, and worker startup failure could be counted as empty. The corrected offline preflight passed 20 checks under Node 20.19.0, including matching-agent precedence, stalled-DNS and stalled-body deadlines, startup-error classification, the pre-`Actor.init` hosted runtime gate, and a mocked exact-build controller flow. It recorded zero probe network attempts and zero privacy-violation writes. See [`preflight-report.json`](preflight-report.json) for the sanitized check list, configuration, dependency lock hash, source-manifest hash, elapsed time, peak RSS and sink/network counters. This supports only the tested local parser adapter, guards, and dry-run/mock controller. It does not demonstrate readability on publisher sites, Google access reliability, hosted timing/cost, or Issue #5 feasibility.

## Hosted launch preparation and boundary

`src/hosted-run-controller.mjs` computes a deterministic manifest over the exact Actor source files and prints a dry-run plan only. Its adapter-driven sequence is covered with a mocked API in preflight: create/read back a private `LIMITED_PERMISSIONS` Actor; upload and compare the fixed version source snapshot; build that version and require `SUCCEEDED`; reread actor privacy/permission; then issue exactly one request pinned to the returned build number with 256 MiB, 900 seconds, $1, restart disabled, and `LIMITED_PERMISSIONS`. If the run POST response is ambiguous, the controller reconciles runs created after that attempt and does not retry the POST. It does not bundle an authenticated Apify API adapter or credential flow, and no Actor create/update/build/run API call has been made.

The probe calls `Actor.getEnv()` and checks raw Apify environment values before `Actor.init()` or any probe request. It fails closed unless the hosted run ID and build ID/number are present and agree between SDK/raw environment, effective permission is limited, memory is 256 MiB, the start-to-timeout window is exactly 900 seconds, the user-set charge cap is $1, and restart is `0`. Apify creates the run ID as part of the run-start request, so no caller can know/pin that ID before POST; the gate checks its presence and SDK/raw consistency, and the controller reconciles the returned ID after the request. Apify's documented run readback includes the build and resource/cost options, but does not expose permission/restart settings in the run `options` shape; the request sends them, actor configuration is read back before launch, and the runtime checks the effective permission/restart values before Actor initialization. Privacy readback also cannot be atomic with run start; the runtime gate prevents probe egress when the effective runtime values do not match.

## Decision boundary

No Actor was created or built, no hosted run started, and no publisher or Google News request was made during offline implementation or preflight. The checked-in controller is not launch-enabled because it has no authenticated API adapter; completing and independently reviewing that credential-safe adapter is still required before any hosted run. Any hosted run must use the exact reviewed build and pass the private `LIMITED_PERMISSIONS`/cost/memory/time/restart gates first. Results from this iteration are a signal only: at least 50 strict Readability successes among 100 unique requested rows is promising evidence for further Issue #5 validation, not production adoption or a completed Spike.

**Learning checkpoint:** None identified in offline preparation.
