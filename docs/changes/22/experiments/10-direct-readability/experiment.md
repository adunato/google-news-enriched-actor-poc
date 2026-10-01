# Iteration 10 — direct Mozilla Readability (offline preflight)

**Status:** Offline preflight passed (15/15 checks) on 2026-10-01. The hosted publisher cohort has not run. This checkpoint stops before Actor/build/run activity so the exact candidate can receive independent review first.

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

The offline preflight passed all 15 planned checks in 1,955 ms under Node 20.19.0. It recorded zero network probe attempts and zero privacy-violation writes. See [`preflight-report.json`](preflight-report.json) for the exact sanitized check list, configuration, dependency lock hash, source-manifest hash, elapsed time, peak RSS and sink/network counters. This supports only the tested local parser adapter and guards. It does not demonstrate readability on publisher sites, Google access reliability, hosted timing/cost, or Issue #5 feasibility.

## Decision boundary

No Actor was created or built, no hosted run started, and no publisher or Google News request was made during offline implementation or preflight. A hosted run must use the exact independently reviewed build and pass the private `LIMITED_PERMISSIONS`/cost/memory/time/restart gates first. Results from this iteration are a signal only: at least 50 strict Readability successes among 100 unique requested rows is promising evidence for further Issue #5 validation, not production adoption or a completed Spike.

**Learning checkpoint:** None identified in offline preparation.
