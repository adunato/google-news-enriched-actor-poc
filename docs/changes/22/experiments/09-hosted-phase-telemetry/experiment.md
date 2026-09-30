# Iteration 9 — hosted worker phase telemetry (prepared offline; not run)

**Status:** Offline implementation and preflight are complete for review. This does not authorize an Actor, build, hosted run, publisher request, or production change.

## Current understanding

Iteration 7 completed one fresh hosted 100-row cohort: 78 rows were eligible for extraction and all 78 hit the five-second worker deadline, including the one eligible HTML prefix below 16 KiB. The run had no per-row lifecycle timings, so startup/import, extraction, result delivery, and exit cannot be distinguished. Iteration 8 measured seven of ten local synthetic cases to completion and three extraction-phase timeouts. Larger and more nested fixtures consumed more time, but both local 8 KiB cases finished below 0.5 seconds total. This does not explain I7's hosted result.

## Hypothesis

If the I7 worker protocol emits a validated monotonic phase sequence and the parent assigns one terminal classification exactly once for every eligible row, then a future, separately approved hosted cohort can distinguish startup/import, extraction, result-transfer, and exit delays without retaining row-level data. Offline complete/partial/privacy tests can establish whether only a complete, internally reconciled 100-row cohort reaches the aggregate sink.

## Why this is the next useful test

The remaining uncertainty is the target-runtime stage responsible for the I7 timeouts. Another synthetic ladder cannot answer it. The highest-value next step is a reviewable offline implementation and adversarial preflight of the exact phase and aggregate protocol that a future hosted run would use. It is not evidence that any stage caused the I7 failures; only a separately approved future hosted run can measure those phases in the target runtime.

## Future hosted cohort proposal (not authorized here)

- Fresh 100 rows: five existing queries × GB/US editions × ten rows per cell, ten fixed cells, no URL-bearing input manifest.
- Preserve I7's bounded direct HTTP flow: concurrency 4, 10-second request timeout, at most five redirects, 256 KiB publisher prefix, 250 ms per-host spacing, public DNS validation/pinning, conservative robots skips, and row-level failure isolation.
- On permitted 2xx HTML only, invoke the exact locked `@extractus/article-extractor@9.0.1` once in a fresh serial worker with a five-second deadline. No `extract(url)`, extra publisher fetch, retry, browser, proxy, or paid service.
- A future hosted Actor must remain private and LIMITED_PERMISSIONS, with user-set server cap $1, 256 MiB, 900-second timeout, restart disabled. Before it starts, verify nested run detail for exact build, cap and user-set flag, memory, timeout, and restart setting. Do not build or run until separate explicit owner approval.
- Persist exactly one aggregate after full cohort reconciliation. If incomplete, malformed, inconsistent, late/duplicate phase messages, or any privacy validation fails, make zero dataset writes.

## Exact phase protocol

The worker may emit only this ordered protocol: `worker_ready`, `import_complete`, `extract_started`, `extract_complete`, then exactly one `result` or fixed-class `result_error`; normal process exit follows the terminal message. Stage events carry only finite nonnegative elapsed milliseconds and fixed enum labels. Extracted content is transient in the parent for the existing structural proxy and is never logged or persisted. The monotonic deadline begins before worker construction; every received message, `error`, `messageerror`, and `exit` checks its receipt time against that deadline before processing, so a blocked parent loop cannot accept a late result. Receipt at or after the deadline takes precedence and produces a timeout attributed to the last valid phase (or `worker_exit_timeout` when a result is pending), regardless of the event payload. Before the deadline, malformed, duplicate, or out-of-order messages produce `protocol_error`. Event handlers route through one idempotent terminal function. After a valid result, a clean exit code 0 completes that result; a worker error or `messageerror` received before the deadline wins as a worker lifecycle failure; a nonzero exit received before the deadline is `worker_exit_error`. No event after finalization can revise the observation. Error text and message payload strings are never retained. Eligible attempts must each have exactly one terminal phase/outcome, including timeout and protocol failure.

The phase counters distinguish: `startup`, `import`, `extract`, `result_delivery`, and `worker_exit`. A worker exit before valid result is `worker_exit`; timeout is attributed to the last valid phase. A valid result with no natural exit before five seconds is `worker_exit_timeout`. A malformed, duplicate, or out-of-order message received before the deadline is `protocol_error`; receipt at or after the deadline is classified as timeout before inspecting the event. No late message can revise a terminal observation. Timing is retained only in fixed bins; never retain raw per-row timing, row ID, URL, title, HTML, extracted text, exception text, or cookies.

## Proposed aggregate schema

One allow-listed aggregate for exactly 100 rows and ten cells. Counts are indexed only by fixed cell ID, eligible prefix-size bin (`lt_16KiB`, `16_to_lt_64KiB`, `64_to_lt_128KiB`, `128_to_lt_256KiB`, `256KiB_cap`, `unavailable`), phase, terminal class, extraction proxy outcome, and phase timing bin (`lt_100ms`, `100_to_lt_500ms`, `500ms_to_lt_1s`, `1s_to_lt_2s`, `2s_to_lt_5s`, `unavailable`). Include planned/observed/eligible counts and an explicit completion/schema version. All strings must come from enums/allow-listed cell IDs; all numbers are safe nonnegative integer counters. Do not include per-row arrays, exact times, hosts, arbitrary strings, or source content. Enforce cohort size 100, ten rows per cell, eligibility/terminal reconciliation, one terminal per eligible row, valid phase order, timing counts, and the aggregate recursive allow-list before a single sink call.

Every resolved candidate must have exactly one checked-row record before observations are constructed; missing, duplicate, or unexpected checked IDs reject the cohort before any sink call. After the single aggregate `pushData` resolves, completion logging is best-effort and Actor-exit errors do not mark the already-persisted application result as retryable. A platform-level status may still reflect an exit failure; the run evidence must distinguish aggregate persistence from platform completion, and no application retry is permitted.

## Offline preflight plan

Use local Node `v20.19.0` and the I7 resolved dependency set with package metadata renamed for I9. Compare the complete transitive package records and dependency versions to I7's lock and use its already installed Extractus 9.0.1; do not install or change dependency versions. Keep network entry points blocked and counted in parent and worker. No publisher data or credentials are read. Run exactly 27 named checks with a 90-second total limit:

1. Six stage success/stall cases: complete normal success; startup stall; import stall; extraction stall; result/post stall; worker-exit stall after result.
2. Six failure cases: fixed worker error result; parent worker `error`; premature exit before ready; exit after ready without result; `messageerror`; five-second timeout with cleanup.
3. Nine protocol/race cases: malformed phase; duplicate phase; late phase; out-of-order phase; duplicate result; timeout/exit/result race; worker-construction delay followed by late messages; result followed by error/messageerror/nonzero exit or duplicate phase; missing checked candidate result. Each must produce one fixed protocol/terminal class and exactly one finalization, with zero aggregate writes for incomplete candidate results.
4. Two real worker smoke cases using authored synthetic HTML and `fixture.invalid`, each exercising the exact locked extractor and I9 phase path under the five-second production deadline.
5. Four sink/reconciliation cases: valid complete 100-row aggregate (one sink call); partial cohort (zero); internally inconsistent terminal counts (zero); privacy/unknown-field violation (zero).

The fake-worker stage tests use an injected short deadline to test timeout/cleanup quickly; a configuration assertion separately verifies the hosted/default deadline is exactly 5,000 ms. The parent-loop stall case blocks worker construction beyond its injected deadline, then verifies queued success events are rejected at receipt. The two extractor smoke cases use five seconds each. All 27 checks must complete within 90 seconds. Check that the lock's complete transitive package records match I7 after excluding only the renamed root package metadata; record both lockfile hashes, the Git commit and a deterministic hash manifest over I9 Dockerfile, package metadata/lock, and runtime source. Do not claim an Apify image digest or hosted build digest exists before an actual later build.

## Expected evidence and interpretation

Retain preflight report only: check IDs/statuses, counts by simulated terminal phase/outcome, zero network attempts, sink-call counts, timeout/cleanup flags, Node/package/lock identity, source-manifest digest, elapsed total, and validated configuration. No per-row case data, raw fixture, output, URL, exception, or log string is retained. Passing supports only that the offline protocol classifies tested event sequences and guards the aggregate sink. It does not establish hosted phase timings, publisher quality, actual future run completion, or Issue #5 readability.

## Stop conditions

Stop if Node 20 or the exact installed dependency cannot be verified, any blocked network entry point is attempted, any raw field reaches retained results/logging, one eligible synthetic attempt lacks exactly one terminal class, malformed/late protocol cannot be safely rejected, a partial/inconsistent cohort can write, cleanup fails, RSS exceeds 256 MiB, or the 90-second preflight limit is exceeded. Do not fix by weakening the protocol/privacy gate or retrying a hosted operation. A design conflict blocks the future hosted proposal and must be reported before any owner approval request.

## Owner decision boundary

The present task authorizes only offline implementation/preflight. It does not authorize an Actor, hosted build/run, publisher request, or live cohort. After independent review of this package, request explicit approval for exactly one fresh bounded hosted I9 cohort using the future-run controls above. Approval of I9 would not authorize extending the worker deadline, production adoption, or any second hosted run.

## Result

**Offline preflight:** After review fixes, all 27 checks passed under Node `v20.19.0` in 922 ms, below the 90-second bound. Peak RSS was 74,076,160 bytes, below 256 MiB. Parent network attempts were zero; both real synthetic extractor workers completed with natural exit. The deadline began before worker construction, and a blocked-constructor test confirmed queued results received after the deadline are rejected as startup timeouts. The result/error/messageerror/nonzero-exit/duplicate-phase precedence cases each produced their specified single terminal outcome. Missing checked-candidate results rejected before the sink. The complete synthetic 100-row/ten-cell aggregate wrote once; partial, missing-candidate, inconsistent-terminal and privacy-invalid cases wrote zero times. Exact check IDs and sanitized metrics are in [`preflight-report.json`](preflight-report.json).

**Identity:** I7 baseline lock SHA-256 `7853c09187e1687763b4678f02a7aa516e86737f1149f52b200185854323f370`; I9 lock SHA-256 `c157a45248319abe8b3d51031f0bd64bf801cf28168d804b49b9e031c180b858`; transitive package records match. Corrected runtime source manifest SHA-256 `21707378d1197e9fd34e848cbc6ed393ec5173edc2d06bd17cbf39b40eb9439e`; report records preflight base commit `4254edae108ecf0fb7d674ebb3d50058fd948dda`. No Apify image digest or hosted build ID exists because no build/run occurred.

**Post-persist status:** The application marks success once its single aggregate `pushData` call resolves. Completion logging is best-effort, and an Actor-exit exception does not cause an application-level retry or change the persisted result into a failed application outcome. Platform-level completion may still reflect exit failure; any future run report must distinguish successful aggregate persistence from platform status. No retry mechanism is included.

**Interpretation:** `Supported` only for the tested offline protocol and aggregate-sink invariants. The preflight establishes no hosted phase measurements and cannot attribute or resolve the I7 timeouts, prove publisher extraction quality, or answer Issue #5. I9's hosted run remains a proposed next iteration and requires separate explicit approval after independent review.

**Hosted activity:** None. No Actor was created, no build/run launched, no publisher request made, and no external network attempt occurred. No production code or dependency version changed.

## Review and owner decision boundary

**Recommended next action:** Independently review this I9 implementation and its offline evidence. If it passes review, request explicit approval for exactly one private hosted 100-row phase-telemetry cohort with the bounds in “Future hosted cohort proposal”.

**Why this is next:** The local protocol is now exercised through success, failures, timeouts, races, actual synthetic extraction, and sink privacy. Only target-runtime phase counters can resolve whether the I7 timeouts came from startup/import, extraction, result delivery, or worker exit. Review is the next control before a new hosted action because I7 had no phase telemetry and the prior run approvals are consumed.

**Prerequisite/blocker status:** No blocker affected I9 offline preparation. No hosted run is currently authorized. The authorization prerequisite blocks only a future hosted measurement; recovery is independent review followed by a separate owner decision. No test result is being treated as production adoption authority.

**Owner decision requested:** After review, **Approve one hosted Iteration 9 phase-telemetry run** with the exact fresh 100-row cohort, existing bounded HTTP controls, five-second serial workers, aggregate-only sink, private LIMITED_PERMISSIONS build, user-set $1 cap, 256 MiB, 900-second timeout, restart disabled, and no retries—or decline/redirect. This does not request approval now to create/build/run an Actor.

**Consequence of approval:** Execute only that single future cohort after verifying exact build and detailed nested server options before launch; validate the full 100/ten-cell aggregate, sanitize run/cost/memory evidence, delete the disposable Actor, and stop at the next checkpoint.

**Consequence of decline or redirect:** Issue #22 remains Inconclusive and open. The I7 hosted timeout phase and Issue #5 readability remain unresolved; I9 evidence remains limited to offline pipeline behavior.

**Learning checkpoint:** None. The protocol review produced no reusable cross-project lesson beyond the findings in this Spike.
