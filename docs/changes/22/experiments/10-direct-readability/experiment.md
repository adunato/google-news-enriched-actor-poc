# Iteration 10 — direct Mozilla Readability (offline preflight)

**Status:** Corrected owner-approved candidate offline preflight passed 33/33 checks on 2026-10-01 under Node 20.19.0. The exact-name read-only Actor listing found no match among two listed Actors. The hosted publisher cohort has not run; no Actor, build or hosted run was created.

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
- Stop scheduling new work at 780 seconds, abort active operations, and flush the single aggregate by 840 seconds, leaving 60 seconds before the 900-second Actor cap. Keep the run capped at 256 MiB and a user-set $1 maximum charge, with restart disabled. Before any hosted run, independently verify private visibility, `LIMITED_PERMISSIONS`, the exact build, and every run option. No hosted run is part of this offline preflight.

## Aggregate and privacy contract

Persist one aggregate only after the complete 100-slot cohort reconciles. It contains fixed cell identifiers, fixed status/timing/size bins and safe integer counts. It includes the strict Readability success total and reports whether it meets the 50/100 threshold only for a 100-unique-row cohort, plus access and extraction outcomes, structured-vs-Readability overlap, prefix/output/DOM caps and worker/publisher timing bins. No URL, hostname, title, row identifier, HTML, article text, exact timing, or exception string is retained or logged. Invalid, incomplete or privacy-tainted observations must result in zero sink calls.

## Offline preflight

Run `npm ci`, then `npx --yes --package=node@20.19.0 -- node src/preflight.mjs` from this experiment directory. The preflight runs under Node 20 with the exact pinned Mozilla Readability and LinkeDOM versions. It blocks parent network APIs and exercises DNS-publicness/pinning, robots decisions, redirect limits, deduplication, pacing, concurrency, prefix size, direct parsing of authored synthetic HTML, cumulative structured-data size, DOM/output limits, worker timeout termination, aggregate reconciliation/privacy, the launch tuple and I10_GATE polling. Synthetic HTML uses only `fixture.invalid`; it is not retained. The sanitized `preflight-report.json` contains fixed check IDs and environment/configuration hashes only.

## Result

The corrected preflight passed all 33 planned checks under Node 20.19.0. Alongside the existing network, robots, parser, worker, aggregation and privacy checks, it validates the run-launch tuple, delayed and missing/mismatched approval records, runtime call ordering before probe execution, controller readback before approval, mismatch aborts without a gate write, one-attempt ambiguous POST handling with abort confirmation, run input/KVS endpoint wiring, waiting for child process close after timeout, the documented initial version in the Actor-create body, omission of unsupported permission fields, no follow-up version mutation, and sanitized create-failure diagnostics. It recorded zero probe network attempts and zero privacy-violation writes. The read-only reconciliation queried `GET acts?my=true&limit=100`, returned two own Actors and zero exact-name matches. The dry-run launcher started no Actor/build/run. See [`preflight-report.json`](preflight-report.json) for sanitized checks, configuration and dependency/source hashes. This supports local parser and mocked handshake behavior; it does not measure publisher readability, Google access, hosted timing/cost or Issue #5 feasibility.

## Hosted launch preparation and boundary

`src/hosted-run-controller.mjs` computes a deterministic manifest over a fixed Actor source allowlist. Before each API mutation, the launch path requires an externally supplied reviewed HEAD hash and exact experiment-root path, a clean Git worktree, and filesystem checks rejecting payload symlinks, escapes and untracked/ignored files. The `src/apify-cli-adapter.mjs` adapter uses `shell: false`, sends API JSON through stdin, bounds stdout, returns only allowlisted metadata and waits for child close after timeout/output termination. It does not read or print the API token. After a successful exact source build, the controller generates a unique marker and passes it with expected actor/build identifiers in the run input while pinning the run to the returned build number. It reads back the actual run/build/options, run input and private `LIMITED_PERMISSIONS` actor state; only then does it write the exact `I10_GATE` record to the run default KVS and verify that record became visible. Any readback mismatch prevents the approval write, aborts the run by ID and confirms terminal status. An ambiguous POST is never retried; recent runs are reconciled against their start time and the expected marker, then all candidates on the fresh private Actor are aborted and confirmed. Any unlocated run fails closed at its runtime gate.

Before `Actor.init()` the probe checks hosted permission, memory, timeout, charge cap, restart setting, run ID and build ID/number consistency. After initialization it reads `Actor.getInput()` and `Actor.getEnv()` again, validating the unique marker and expected actor/build tuple against runtime values. It polls the run default KVS record `I10_GATE` for up to 30 seconds and makes no Google or publisher request until every field matches. The handshake uses the documented [Run Actor input body](https://docs.apify.com/api/v2/actors-runs-post), [Actor SDK input/KVS helpers](https://docs.apify.com/sdk/js/reference/3.6/class/Actor) and [run default KVS record API](https://docs.apify.com/api/v2/default-key-value-store).

Official API references: [Create Actor](https://docs.apify.com/api/v2/actors-post) requires at least one source version; [Update Actor](https://docs.apify.com/api/v2/actor-put) documents `actorPermissionLevel` on updates and `defaultRunOptions.forcePermissionLevel` for the run permission setting.

### Create-request correction

After two create attempts failed, the request was checked against the official [Create Actor API](https://docs.apify.com/api/v2/actors-post), which requires at least one source version in the initial POST. The corrected plan puts the byte-manifested source snapshot in `versions`, reads it back byte-for-byte before building, and removes the separate post-create version PUT. It omits response-only `actorPermissionLevel` from the request and sets the documented `defaultRunOptions.forcePermissionLevel` to `LIMITED_PERMISSIONS`. Safe error reporting retains only request stage/context, HTTP or CLI status, and validated Apify error type/request ID/timestamp; it drops raw stderr, response text, and secrets. Corrected offline validation passed. A read-only own-Actor listing found no exact-name match.

## Decision boundary

No Actor was created or built and no hosted run started. No publisher or Google News request and no Apify API call occurred during this offline-only update. The credential-safe adapter and gated launcher require independent review and verification against the exact reviewed build and private `LIMITED_PERMISSIONS`/cost/memory/time/restart gates. A future hosted invocation also requires the explicit trusted HEAD and experiment-root environment anchors and a clean worktree. Results from the publisher cohort, once run, are a signal only: at least 50 strict Readability successes among 100 unique requested rows is promising evidence for further Issue #5 validation, not production adoption or a completed Spike.

**Learning checkpoint:** The Actor create endpoint requires source code to be present in the initial request. A separate version update after create adds an avoidable mutation and version-consistency risk; the corrected flow creates with the reviewed snapshot and verifies its readback before building.
