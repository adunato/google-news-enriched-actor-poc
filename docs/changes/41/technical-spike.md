# Technical Spike: Google News publisher resolution and full-text viability

> Living execution/evidence record for Technical Spike [**Prove Google News publisher resolution and full-text viability (#41)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/41). The Issue defines the stable question and the approved TID defines the experiment sequence, routing, evidence criteria and boundaries.

**Artifact ID:** `spike-41-google-news-resolution-full-text`  
**Status:** `Open`  
**Owner:** `Project owner`  
**Created:** `2026-10-04`  
**Updated:** `2026-10-09`
**GitHub Spike Issue:** `Prove Google News publisher resolution and full-text viability (#41)`  
**Technical Investigation Design:** `docs/changes/41/technical-investigation-design.md` / `tid-41-google-news-resolution-full-text` — **Owner-approved 2026-10-09 B2-I parent/child isolation experiment is the sole current execution route (I1 → gated I2 → gated I3). R6 and the unapproved replay are superseded; earlier investigations are retained as evidence, not authority.**
**Spike branch:** `spike/41-google-news-resolution-full-text`  
**Blocked downstream Issues:** `Resolve Google News links to publisher URLs with fail-soft status (#4)`; `Add optional best-effort article full-text extraction (#5)`

## 1. Technical Question and Required Outcome

Establish whether the approved lightweight hosted Actor can:

1. satisfy the publisher-URL feature's **95/100** live resolution target; and
2. satisfy the full-text feature's **50/100** readable-text target.

If either cannot be achieved within the approved constraints, identify the exact Product/Architecture boundary preventing it.

## 2. Current Understanding

### Established facts

- A1 reached the resolver-ready Google News page state using ordinary hosted HTTP.
- A4 resolved **100/100** rows in the frozen representative sample to valid non-Google publisher URLs. Area A is supported.
- B1 subsequently fetched **53/100** rows as usable publisher HTML. This demonstrated that, at that time, the representative sample contained enough accessible HTML to make the **50/100** full-text target possible.
- The original B2 candidate did not produce row-level extraction evidence.
- B2-D1, B2-S1 and B2-P1 then investigated a cross-run design in which a later Actor tried to reopen B1's retained HTML from an earlier run.
- B2-S1 observed HTTP 403 `insufficient-permissions` while inspecting the prior B1 store. That is evidence about the **diagnostic storage path**, not about the application's normal publisher fetch → extraction flow.
- The intended application architecture does not require a later Actor run to reopen an earlier run's publisher HTML. Fetch and extraction are one normal enrichment flow inside the same Actor execution.

### Owner decision — 2026-10-06

The cross-run cached-HTML/KVS troubleshooting route is superseded.

Area B is reset to the mainstream product flow:

`resolved publisher URL → ordinary HTTP fetch → in-memory structured-data/Readability extraction → row output`

The active experiment must remain as close as possible to normal hosted Apify operation. Do not continue permission/grant investigation, prior-run KVS access, Console diagnostics or other special harnessing solely to preserve the previous experimental separation.

### Remaining uncertainty

The unresolved product question is now simply whether the normal one-run hosted flow can:

1. execute fetch → extraction → row output correctly; and
2. produce readable article text for at least **50/100** rows in the representative sample.

If the normal flow fails, evidence must identify the actual business-flow stage: Actor startup/row processing, publisher fetch, extraction, or row output.

## 3. Current Investigation Position

**Area A: Supported.** A4 resolved 100/100 publisher URLs on the frozen representative sample.

**Area B: unresolved.** The prior B2-I3 process-isolation candidate was rejected at 5/100 independently readable texts; it did not establish why 93 rows timed out. The controlled R2-baseline candidate completed all 100 rows but produced only 8 readable texts, below the 50/100 target. Independent content review classified all eight extracted texts as readable; the other 92 rows had empty article text. Its timing evidence shows 89 timeouts had no child-stage marker received by the parent and two last reported `extract_start`; it does not establish why most markers were absent or identify a cause for the timeouts. R4 observed 97/100 completed rows and missing results after the configured 10-second abort; exact HTTP-library root cause remains unproved. R6's attempted additional internal-HTTP diagnostics yielded no hosted publisher evidence after an access-gate failure. Those outcomes remain historical evidence.

**Owner decision 2026-10-09:** After reviewing B2-I3, the owner directed a controlled candidate that uses the exact R2 publisher HTTP and extraction implementation inside ordinary Node.js child processes. The parent records startup/phase timing, owns dataset writes, and enforces a 24-second deadline plus two seconds to confirm kill/reap. This is a limited feasibility approval only, not a final architecture amendment.

**Current authorised experiment:** The approved [baseline-controlled process candidate](technical-investigation-design.md#approved-baseline-controlled-process-experiment-b2-controlled-process) completed its single fixed 100-row run on the one authorized build. Run/build gates passed within the approved bounds. Independent row validation confirms 100 distinct rows, all children reaped, and matching hashes for all eight extracted texts. Independent content review found 8/100 readable texts; the other 92 rows had empty article text. The tested candidate is below the 50/100 target and is rejected under its stated limits. The restricted dataset is retained. No follow-on experiment is authorized; Issues #4 and #5 remain blocked and the overall Spike remains Pending.

## 4. Current Experiment Execution

**Controlling execution authority (2026-10-09):** The owner superseded the unexecuted D0–D2 diagnostic draft and approved one baseline-controlled process experiment. Its scope was exact R2 HTTP/extraction behavior behind a child process, local direct-versus-child parity gates, and one conditional hosted comparison. The independent pre-build gate passed, the single build succeeded, and the single 100-row run completed within its run, cost, and memory bounds. The run-start marker recorded Node `v20.20.2` / Undici `6.24.1` before child work began; the operator read it after the privacy readbacks. Because the run starts immediately, publisher requests may have begun before the operator completed the post-create access readbacks. Prior B2-I1/I2/I3 results remain complete historical evidence; the one authorized build and run are consumed, and no extra B2-I replay, R6 work, or follow-on experiment is authorized.

**TID authorisation:** The original `tid-41-google-news-resolution-full-text` approved the Area B mainstream-flow reset and B2 smoke → conditional acceptance route on 2026-10-06. The owner issued a new controlling approval on 2026-10-09 for the baseline-controlled process route recorded in the TID's [current experiment](technical-investigation-design.md#approved-baseline-controlled-process-experiment-b2-controlled-process).

**Historical execution status (prior routes):** B2-M3, B2-R2 and the R3a/R3b sequence have reached their recorded stops. B2-R1 was never approved or executed. R3a is Inconclusive / Hold and R3b is not eligible. B2-R4 timed out and its authority is exhausted. R5 completed a valid exact-runtime source assessment but left the mechanism unresolved. R6 first had a premature monitor abort; the separately approved additional build then succeeded and passed exact-runtime and offline observer gates, but its sole conditional run was aborted after initial run-access verification failed. No publisher diagnostic evidence was produced. The approved R6 build/run authority is consumed; another run-only attempt on the exact verified build is only proposed and requires owner approval. Downstream Issues #4 and #5 remain blocked.

### B2 controlled process — candidate preparation and local parity (2026-10-09)

**Status:** Local parity and process gates are **Supported**. The single hosted run completed `SUCCEEDED` within time, spend and memory limits and wrote 100 distinct rows. It returned 8 `eligible_html`, 1 `http_denied`, and 91 `child_timeout`. Independent content review found all 8 extracted texts readable, for 8/100 overall; the other 92 rows had empty article text. The candidate is rejected against the 50/100 target. All 100 child processes were confirmed reaped, and all eight extracted-text hashes match the restricted dataset. The default dataset remains RESTRICTED and retained.

**Candidate:** `experiments/b2-controlled-process/actor/`, existing private Actor `JIogcgdHyCqAMHQ1P`, version `0.10`, build `0.10.8` / tag `issue41-b2-controlled` / ID `avU2E2IHAe5wlAWS1`. The shared `baseline.mjs` is copied from R2 vanilla `main.mjs` through its `processRow` implementation; it exports that exact row function and adds timing callbacks at the fetch, first request, body-read, extraction and terminal boundaries. The new worker invokes that shared row function. The parent starts at most two children, owns every Actor dataset write, and records parent/child timing messages. It waits for child exit plus IPC close/reap before freeing the slot. Children inherit the parent's environment so request-affecting TLS, proxy and Node options match; evidence stores no environment values. A 24,000 ms T0 timer triggers SIGKILL, followed by up to two seconds to confirm exit/close/reap; the measured timer can fire late due to event-loop scheduling and the exact observed times are recorded. The inner 10-second HTTP timeout is unchanged. R2 used concurrency four; this candidate uses two, a known throughput difference which prevents this local parity result from being a throughput-equivalence claim.

**Local controls:** Node `v20.19.0`, bundled Undici `6.21.1`, same for direct and child execution. This local runtime is not the hosted acceptance runtime. The hosted run-start marker recorded Node `v20.20.2` / Undici `6.24.1` before child work began. The final suite ran with the ordinary inherited parent environment and passed 11/11: eight direct-versus-child parity cases, startup-hang cleanup, and four-row scheduler cap. No Google News or publisher request was sent. Case outcomes matched exactly: `/redirect` → eligible HTML via two GETs/one redirect and structured JSON-LD extraction (17 words); `/denied` → HTTP denied (403); `/non-html` → non-HTML; `/chunked` → eligible HTML with structured extraction; `/oversize` → body limit; `/charset` → eligible Windows-1252 HTML with Readability extraction (301 words); `/abrupt` → request error; `/stall` → body-read timeout at approximately 10.0 seconds. The exact per-case sanitized outcomes, body/text hashes, request traces, and parent/child times are in `experiments/b2-controlled-process/evidence/local-parity-results.json`; the full TAP transcript is `local-parity-inherited-env.tap`.

**Hosted run and privacy:** Run `8Y49Z8FgdH8XS3C5b` used the exact build `avU2E2IHAe5wlAWS1` / `0.10.8`, the frozen input SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`, and the authorized 1500-second, 512 MiB, `$0.10`, `restartOnError=false` settings. Immediately after creation, run and default-dataset access were set/read back as RESTRICTED; an unauthenticated no-follow request to the exact dataset-items URL returned 403. The run completed `SUCCEEDED` in `1130.443` seconds, used `$0.03182645542874768`, reached `memMaxBytes=207319040` (about 198 MiB) and `memAvgBytes=105036289.7`, with `restartCount=0`; CPU peak was `351.27` and average `9.96`. These are utilization observations only, not a cause finding. The startup marker recorded Node `v20.20.2`, Undici `6.24.1`, `sample=acceptance`, `rows=100`, and concurrency two before child work began. The operator read the marker after the privacy readbacks; publisher requests may have started before the post-create access readbacks completed. The private default dataset `oS68zBD3k82fX84OM` remains RESTRICTED and is retained.

**Final row outcomes and telemetry:** Independent row validation confirms 100 unique dataset rows matching the frozen 100 input rows: 8 `eligible_html`, 1 `http_denied`, and 91 `child_timeout`. All 100 children were reaped. Of the timeouts, 89 had no child-stage marker received by the parent and 2 last reported `extract_start`; the absence of a marker does not prove the child had not started an unreported operation. The other 9 rows reached `result_received`. For the 11 rows with a ready marker, parent T0-to-ready receipt was 749.181 ms minimum, 804.117 ms median, 15,978.450 ms P95 and maximum. For those same 11 rows, T0-to-first-HTTP-request-marker receipt was 752.505 ms minimum, 808.518 ms median, 16,368.831 ms P95 and maximum; the paired ready-to-HTTP receipt delta was 4.144 ms median. These are parent-clock observations including IPC delivery, not a packet-level measurement. Child-local body-read and extraction durations are summarized separately in `experiments/b2-controlled-process/evidence/hosted-run-timing-summary.md`; clocks were not mixed. Exact sanitized per-row outcomes, stage markers and hashes are in `validated-row-projection.json`; validation and integrity checks are in `validation-controlled.json`. No article text is stored in Git.

The startup-hang child was PID `43324`: parent timer requested SIGKILL at `24,011.604 ms` from T0; exit was observed at `24,022.484 ms`, IPC close/reap at `24,022.573 ms`, and kill-to-reap was `10.970 ms`. The parent recorded no ready, HTTP, or terminal-result event. The concurrency control processed four local rows with maximum active child count two; all four children were reaped. Evidence is in `local-parity-results.json` and `local-parity-inherited-env.tap`.

**Lineage and build evidence:** The frozen 100-row input remains SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`. The source manifest records 11 candidate/packaging files, and all 11 remote build source files match their local SHA-256 values. R2 `body-stream.mjs`, `dom-content-type.mjs`, and `Dockerfile` are byte-identical (SHA-256 `40505db4afeBD8d5125f596864dc98807252a9e3923b3a70284dea39ee10ee14`, `bbd01cc6c1b59b399e4e61b25efa2154cb5f90f88afb3e79c39e5005d3f45d9d`, and `72f0dfb10a56e715395935531e0008fbd087fb806a307ebbea90426c111097fc`). Package lock pins Apify `3.7.2`, Readability `0.6.0`, and JSDOM `29.0.1`; `npm ls --depth=0` confirms those versions. Local `npm ci` hit Windows `ENOTEMPTY` cleanup errors; the test dependency tree was restored from the existing R2 install, then versions and candidate lock were checked. The one build is `avU2E2IHAe5wlAWS1` (`0.10.8`, tag `issue41-b2-controlled`, image digest `60c95d076e1344f3411d1fc732b51f5b97710f55b97f3ebce78e095e00d0a68d`, status `SUCCEEDED`). The build used the unchanged R2 Dockerfile and pinned package set. The build API exposes the final image digest but no registry URL, base-layer digest, or Node/Undici version. Runtime will be observed from the single run's startup marker, subject to the stated startup-order limitation. Exact hashes and the sanitized build receipt are in `experiments/b2-controlled-process/evidence/candidate-manifest.json`.

**Conditional hosted bounds:** The single authorized run uses build `avU2E2IHAe5wlAWS1`: 1500-second timeout, 512 MiB, `$0.10` run cap, `restartOnError=false`, two children, 10-second HTTP chain, 2 MiB body, at most five redirects/six GETs per row (600 maximum), and a 24-second outer child timer plus two seconds for reap. Preserve Actor-level defaults and history. Immediately after creation, set/read back RESTRICTED access on the same run and its default dataset, then require a token-free direct 401/403 dataset-items response with redirects disabled. Read the run-start Node/Undici marker as soon as the privacy gates finish. The Actor may process publishers before that marker is observed; a missing or mismatched marker requires abort and Hold, not retry. Stop on any gate failure.

**B2-R4 approval and preparation record (2026-10-07; state at end of preparation):** Owner approval covered the complete TID sequence, including the monitored single build attempt and conditional single private hosted run with the run-only API charge cap. The candidate source was prepared from historical R2 commit `2694b1162c90bf93a4e36db4fa3cb0d4e0800a7e` in `experiments/r4-hosted-body-read/`; the baseline `main.mjs` SHA-256 `b87e8635caf895181a406c4a103aaa57ab81193ce3a3f4477728ab568bffc47c` matched the TID. `provenance-r4.json` and `prebuild-integrity-r4.json` record source/input hashes, the R4-only deltas, and the prebuild gate. Static checks passed: Node syntax, Apify input-schema validation, package/lock and frozen-input integrity (100 unique row IDs, 95 unique publisher URLs), and `git diff --check`. At that point the candidate had not been built, pushed to Apify, or run, and no publisher requests had been made. The later single build/run and result are recorded below. R3a remains Inconclusive / Hold and R3b remains ineligible.

The owner approved the current vanilla sequence on 2026-10-06. The approval covered one smoke run and, only if its gate passed, one 100-row acceptance run on the same build; both authorizations are exercised. After the acceptance run reached a TID boundary, the user separately approved exactly one B2-M1 run requesting 512 MiB as recorded below. That approval is exercised and exhausted. Later B2-M2 and B2-F1 approvals were also exercised and exhausted. B2-D1/B2-S1/B2-P1 permissions and cache-replay authorizations are historical and exhausted.

### Historical execution — B2 vanilla-flow smoke test (completed)

Use a very small deterministic set of publisher URLs from the representative sample that B1 previously classified as usable HTML. The retained B1 evidence may be used only to select the row IDs / publisher URLs; **do not read B1's cached HTML or B1 KVS at runtime**.

For every smoke-test row, the hosted Actor performs the normal application sequence in one run:

1. row processing starts;
2. ordinary bounded HTTP fetch of the resolved publisher URL;
3. if eligible HTML is returned, structured article data / Mozilla Readability runs immediately on that in-memory response;
4. fetch status, extraction status and word count/failure class are recorded;
5. the row is written to the normal dataset.

**Prepared candidate and samples:** The isolated candidate is `experiments/b2-vanilla/actor/`. It uses the existing pinned Apify `3.7.2`, Mozilla Readability `0.6.0` and jsdom `29.0.1` dependencies on Node.js 20. The smoke fixture `experiments/b2-vanilla/input-smoke.json` contains 3 unique rows. The acceptance fixture `experiments/b2-vanilla/input-acceptance.json` contains 100 unique row IDs and 95 unique publisher URLs; five repeated URL occurrences remain separate rows, without deduplication. Both fixtures were derived by joining A4 resolved rows to B1 input provenance; only URLs/provenance and row metadata were used. Neither fixture contains B1 cache keys, HTML bytes or body hashes. Their SHA-256 values are recorded in `experiments/b2-vanilla/approval.json`.

**Bounds and evidence:** Both runs use concurrency 4, a 10-second per-row HTTP chain timeout, 2 MiB body limit, five redirects after the initial request (maximum six GETs per row), 256 MiB and an explicit 900-second Actor timeout. This means at most 18 publisher GETs in smoke and 600 in acceptance; no Google News requests are made. The estimated compute for a full 900-second allocation is about 0.0625 CU / $0.0125 at the previously referenced $0.20/CU standard rate. This is not an all-in limit: actual account rates, bandwidth, build, storage and API charges can differ. Actual hosted usage will be recorded. Extracted article text is a normal private dataset output needed for quality review; no full text or HTML is retained in Git, and logs contain no URLs or article text.

**Local readiness:** Syntax, dependency import/version, sample mapping/count/hash, Apify input-schema, and a local Windows-1252 response-decoding check pass. The charset from the publisher HTTP content type is preserved when JSDOM decodes response bytes.

**Smoke result (2026-10-06):** Build `s7Np4qeIg5sXxAdti` / version `0.8.1`, tagged `issue41-b2-vanilla`; run `ydot4zQVlwhb5BFmz`; dataset `JbO5AUmkA6FxO5sHA`. The run succeeded on Node `v20.20.2` / Apify `3.7.2`, used configured 256 MiB and 900 seconds, ran for 5.776 seconds, and cost `$0.00015115540744198693`. The frozen smoke input hash was `ff90a06c2e45bb2ef3cd2ce06e3d8ba6b7993b106ed5b13897ab10992bf83128`. All 3 rows returned eligible HTML (HTTP 200; one publisher GET per row), produced nonempty Mozilla Readability outputs (368, 1,012 and 584 words), and were written to the normal dataset; 3/3 rows had extraction status `success`. The smoke gate passed independent review. Platform usage also reports one key-value-store read and one write. The candidate made no cross-run store calls; it used the normal Actor input/output methods and default dataset.

**Retained smoke evidence:** Sanitized per-row outcomes and content hashes are in `experiments/b2-vanilla/results-smoke.json`; sanitized run/build identity, resource, runtime and usage metadata are in `experiments/b2-vanilla/run-metadata-smoke.json`; the safe hosted log is `experiments/b2-vanilla/private/smoke-run-log.txt`. Full text for independent content-quality review is retained only in ignored `experiments/b2-vanilla/private/smoke-dataset.json`; it is not included in Git.

**100-row acceptance result (2026-10-06):** The one authorized acceptance run used the same build `s7Np4qeIg5sXxAdti` / `0.8.1` and exact acceptance input SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`. Run `HjdQa5oV2GD4dS4VY` ended `FAILED` with exit code 1 after 8.857 seconds, at configured 256 MiB / 900 seconds; the run-info response reported `$0.0002400319082223707`, while a subsequent CLI run listing reported `$0.00024049202814035948`. Both values are retained because they differed. Maximum observed memory was 255,164,416 bytes. The retained dataset contains 10 rows for 10 distinct input IDs. The stage log records 11 publisher GETs: 10 eligible HTTP 200 responses and one HTTP 403; nine rows have logged successful Readability extraction and dataset writes, while `q1-us-01` has an eligible-fetch result but no extraction or dataset result before termination. Three further started rows have no fetch result, and the remaining 86 inputs have no row-start event. The hosted log ends with `npm error signal SIGKILL`; this observation does not by itself establish the cause. The single acceptance run is consumed; no rerun or deeper diagnosis was performed.

**Experiment classification:** `Inconclusive — valid partial execution, acceptance incomplete.` This run does not establish a below-50/100 result, and it does not make B3 eligible. Area B remains on Hold and the overall Spike remains open with conclusion `Pending`.

**Retained acceptance evidence:** Sanitized row outcomes and hashes are in `experiments/b2-vanilla/results-acceptance.json`; sanitized same-run resource/runtime/usage metadata is in `experiments/b2-vanilla/run-metadata-acceptance.json`; the full hosted log and partial dataset, including article text for the 10 emitted rows, remain only in ignored `experiments/b2-vanilla/private/`. No full text is retained in Git.

**Historical boundary after the 256-MiB acceptance run, before B2-M1 (2026-10-06):** The run reached the normal publisher-fetch, extraction and dataset-output path for a partial set before the process was killed. The exact termination cause is not established; proximity to the configured memory allocation is an observation, not a confirmed cause. No simple mechanical defect was established from the retained evidence. At that point, the vanilla smoke and original acceptance authorizations were exercised. The later B2-M1 owner approval and its completed invalid-bound outcome are recorded below.

## Owner checkpoint — B2-M1 one higher-memory acceptance run (approved 2026-10-06)

**Decision state:** The earlier vanilla smoke and one 100-row acceptance approval are exhausted. B2-M1 was first presented as a pending proposal; on 2026-10-06 the user replied “ok” to the explicit request to approve exactly one same-build 100-row run requesting 512 MiB. That approval was exercised once and is exhausted. No other build, run, resource change or investigation is authorized by it.

### Issue context and current evidence

Issue #41 asks whether the Node.js 20 Apify Actor can resolve at least 95/100 representative Google News rows to publisher URLs and produce readable article text for at least 50/100. A4 supports 100/100 publisher URLs for the fixed sample. Historical B1 retained 53/100 usable publisher HTML responses. The same-build vanilla smoke run passed independent review: all three selected rows fetched HTML, produced reviewed text and reached the normal dataset. The single 100-row acceptance run used frozen input hash `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`, 256 MiB, and build `s7Np4qeIg5sXxAdti`; it failed after partial processing with 10 dataset rows and 11 logged publisher GETs. Nine completed rows have extraction candidates and one row's request returned HTTP 403; `q1-us-01` fetched eligible HTML but has no extraction/output event. Three more rows started without fetch results, and 86 rows never started. The log ends with `SIGKILL`; max observed memory was 255,164,416 bytes. The cause is undetermined, so the run does not establish a below-50/100 result or make B3 eligible. Area B remains on Hold and the Spike conclusion remains Pending.

### Approved question and bounded run (now exhausted)

Would the unchanged normal 100-row flow complete when run with 512 MiB? Memory pressure is a plausible hypothesis from the observed peak and process termination, but it is not a confirmed cause. The approved run uses the existing private Actor `JIogcgdHyCqAMHQ1P`, same existing build `s7Np4qeIg5sXxAdti` / `0.8.1` / `issue41-b2-vanilla`, and the same frozen 100-row fixture with 100 unique IDs and 95 unique publisher URLs. **Change only the run memory allocation from 256 MiB to 512 MiB.** Do not rebuild or change code, dependencies, input, actor identity or runtime.

Keep Node.js 20, timeout 900 seconds, concurrency four, 10-second per-row HTTP chain timeout, 2 MiB response limit and five redirects after the initial request (maximum six GETs per row). Continue using ordinary publisher HTTP, same-response in-memory extraction, normal row output and safe stage logs. Do not access prior-run cache/KVS, fetch Google News, change permissions/credentials, use browser/proxy/another runtime, add diagnostics, or extend the run beyond the approved bounds.

### Evidence, outcomes and stop rule

Retain the exact run/build identity, frozen input hash, configured/observed resources, platform status/exit, duration, usage, peak memory, per-row fetch and extraction outcomes, HTTP statuses/request counts, output completeness, hashes/word counts, and sanitized stage log. Keep complete article text out of Git and retain it only in ignored/private hosted dataset evidence for independent quality review.

- A completed run with at least 50 independently reviewed coherent article texts supports Area B for this sample.
- A completed run with fewer than 50 eligible HTML rows is access-limited evidence; stop and do not label full-text feasibility from it alone.
- B3 remains eligible only if a completed run fetches at least 50 eligible HTML rows and independent review shows extraction quality is the remaining blocker.
- Any failed or incomplete run is Inconclusive; preserve it and stop. No second run, further memory increase, rebuild, code correction, diagnostic expansion or B3 follows B2-M1.

At 512 MiB for a full 900 seconds, compute is modeled at 0.125 CU / approximately `$0.025` using the previously cited `$0.20/CU` standard rate. This is compute-only, not a guaranteed total or enforced spending cap; actual account rates, transfer, storage, build/API usage and duration can change charges.

**Approval recorded:** The user explicitly approved exactly this one same-build, same-fixture acceptance run requesting 512 MiB on 2026-10-06. The approval is exercised and exhausted. The actual run used 256 MiB, so the approved memory hypothesis was not tested. Preserve the evidence and stop. The overall Spike remains Pending until the original full-text question is resolved.

### B2-M1 execution result (2026-10-06)

The single sanitized invocation was `apify call JIogcgdHyCqAMHQ1P --build issue41-b2-vanilla --input-file ..\input-acceptance.json --memory 512 --timeout 900 --silent --json`. Local CLI evidence is `apify-cli/1.10.0`; its `call --help` describes `--memory` as the amount allocated in megabytes. The command returned failure, but run `68bftskIZe5eABnuO` exists and identifies exact build `s7Np4qeIg5sXxAdti` / `0.8.1` and the approved fixture hash. The request specified 512 MiB; same-run metadata and the startup log both show actual 256 MiB and a 900-second timeout. No cause for the memory mismatch is established or inferred.

The run ended `FAILED`, exit code `1`, after 7.660 seconds; the hosted log ends with `npm error signal SIGKILL`, without establishing its cause. Peak memory was `215339008` bytes and reported usage was `$0.0002176187299274736`. Dataset `gvwkEaUKCsnDPCONo` contains 9 rows. The sanitized log records 13 row starts, 10 publisher GETs (9 eligible HTTP 200 and one HTTP 403), 10 extraction outcomes (9 successes and one fetch-ineligible skip), 9 writes, and 87 input rows without a row-start event. The private dataset has 8 rows with successful extraction and one denied-fetch row; article quality was not independently scored because the run was incomplete and invalid-bound. These partial counts do not establish a complete 50/100 result, a below-50 result, or B3 eligibility.

**Classification and boundary:** `Invalid-bound / Inconclusive — valid partial execution, approved 512-MiB hypothesis not tested.` Actual memory remained 256 MiB. Do not interpret the outcome as evidence for or against the 512-MiB hypothesis, infer a resource-configuration cause, or claim an out-of-memory diagnosis. The single B2-M1 approval is consumed; no retry, rebuild, configuration change, further diagnostic or B3 is authorized. Area B remains on Hold and the overall Spike remains Pending.

**Retained B2-M1 evidence:** `experiments/b2-vanilla/results-b2-m1.json`, `run-metadata-b2-m1.json`, and `approval.json`; ignored `private/b2-m1-run-log.txt` and `private/b2-m1-dataset.json` retain sanitized run evidence and the private output needed for any later authorized review. No full text is in Git.

### B2-M2 owner approval record — configuration-only 512-MiB candidate (2026-10-06)

**Decision state:** The user replied “Okay, go ahead” after receiving the bounded proposal. B2-M1's one-run approval remains exhausted. B2-M2 is approved for one configuration-only Actor definition change and one candidate build, followed by at most one hosted run only if the new build metadata passes the exact 512-MiB gate. This record does not authorize retry or scope expansion.

**Issue context:** Issue #41 asks whether the Node.js 20 Apify Actor can resolve at least 95/100 representative Google News rows to publisher URLs and produce independently readable article text for at least 50/100 rows. A4 supports the publisher-resolution target on the fixed sample. The B2 smoke passed independent review, but both 100-row acceptance attempts were incomplete. Full-text feasibility remains unresolved; Area B is on Hold and the overall Spike conclusion is Pending.

**Observed evidence:** B2-M1 requested 512 MiB on exact build `s7Np4qeIg5sXxAdti`, but run metadata and startup log show 256 MiB. Read-only metadata for that exact deployed build confirms actor definition default/min/max memory were each 256 MiB, with timeout 900 seconds. This establishes the build's memory maximum; it does not establish which component handled the CLI's 512-MiB request or explain the run termination. B2-M1 is Invalid-bound / Inconclusive, and the 512-MiB hypothesis was not tested. See `experiments/b2-vanilla/build-definition-b2-m1.json` and the M1 run evidence above.

Keep concurrency four, 10-second HTTP-chain bound, 2 MiB response-body cap and five redirects after the initial request. Use ordinary publisher requests, same-response extraction and the normal dataset only. No Google News requests, prior-run cache/KVS, new dependencies, diagnostics, credentials, permissions, browser, proxy or alternate runtime are in scope. If the valid run completes all 100 rows, independently review text against the full denominator: at least 50 coherent readable article texts supports the tested target. Fewer than 50 eligible HTML rows is access-limited evidence and stops. B3 is eligible only if at least 50 eligible HTML rows are present and review confirms extraction quality is the blocker. Any build mismatch, failed/incomplete run or resource mismatch stops the amendment without retry, rebuild, resource ladder or B3.

The compute estimate at 512 MiB for 900 seconds is 0.125 CU / approximately `$0.025` at the previously cited `$0.20/CU` standard rate; this is compute-only, not a guaranteed total or spending cap. Record actual usage and cost. **Approval recorded:** The user explicitly approved this one configuration-only build and conditional one-run sequence on 2026-10-06. Complete the local hash/configuration/schema gate and wait for internal readiness confirmation before building; this approval does not cover retries or any changes beyond the specified Actor definition and identity.

**Pre-build integrity and local checks (historical pre-run record, 2026-10-06):** The only configuration edit was `experiments/b2-vanilla/actor/.actor/actor.json`: default/min/max memory changed from 256 to 512 MiB, timeout remains 900 seconds, and candidate identity is version `0.9` / tag `issue41-b2-m2-512`. The pre-change definition SHA-256 was `336b3821536702caac4513d9898d5f3f6feb84cb9389464c01f646ad86ef3f9d`; the candidate definition hash is `f7e0be5e43d10a274f13a9730f01df86bab98f632afb330504b671f4cf5d352f`. Entry point, helper, package/lock, input schema and frozen input hashes match the reviewed build/fixture; the input remains 100 unique IDs, 95 unique publisher URLs and five repeated URL occurrences. See `experiments/b2-vanilla/prebuild-integrity-b2-m2.json`. `apify validate-schema` and `npm run format:check` passed. `npm run validate` did not pass: lint stopped with 36 `no-undef` errors in Issue 41 experiment files and did not reach typecheck, tests or build; no baseline comparison was made. The single approved build succeeded as `RAwgvVrKuREgjFr2D` / `0.9.1`. Read-only metadata verifies the exact Actor ID, version/tag, default/min/max memory 512 MiB and timeout 900 seconds; see `experiments/b2-vanilla/build-definition-b2-m2.json`. At the time of this pre-run record, internal build-metadata confirmation was pending and no publisher request had started. The gate was subsequently confirmed and the single approved run was executed; see the B2-M2 result below.

### Evidence

Use ordinary stage evidence only:

- row started;
- fetch succeeded / failed;
- extraction succeeded / failed;
- row write succeeded / failed.

No diagnostic subsystem, cross-run store access, alternate credentials, permission/grant changes, Console inspection or custom hosted harness is part of this experiment.

### Approved TID decision rule (executed for this candidate)

- If the smoke run processes the complete small sample, emits a row result for every input and demonstrates that successfully fetched HTML reaches extraction and normal row output, proceed to the **100-row B2 acceptance run**. The smoke gate passed independent review, and the one permitted acceptance run was executed; its outcome is recorded below.
- If it fails before row processing, investigate the normal Actor entrypoint/configuration.
- If ordinary HTTP fetch fails, investigate the publisher-fetch path.
- If fetch succeeds but parsing/extraction fails, investigate the extraction path.
- If extraction succeeds but row output fails, investigate normal dataset delivery.

A straightforward defect in the normal product path may be corrected and the smoke test repeated under the approved TID. No such straightforward defect has been established for the current failed acceptance run; that generic TID provision does not override the current Hold or authorize a new run. If continuing requires special storage/network/security/permission machinery that the product itself would not use, stop and return to the owner rather than constructing that machinery.

### Full B2 acceptance run after smoke success (executed; see result below)

Run the same one-run fetch → extract → row-output flow across the defined 100-row representative sample. Score readable text against the full 100-row denominator and retain separate per-row fetch and extraction outcomes.

The target remains **>=50/100** readable article-text successes. B3 becomes eligible only if valid B2 evidence shows enough publisher HTML was fetched to make the target possible but the primary extraction path is the demonstrated remaining blocker.

## 5. Experiment Log

### A1 — Reproduce and characterise hosted Google News access

**Eligibility and result:** A1 was the first mandatory experiment. It is classified **Supported** for establishing a stable stateless path to the resolver input on the bounded controls. This is not evidence for the 95/100 product acceptance target.

**Controls and provenance:** Four controls were selected from `docs/changes/18/input-manifest.json`: `q1-gb-01` (`www.bbc.co.uk`), `q1-gb-02` (`www.bbc.com`), `q1-us-01` (`www.tcu.edu`) and `q1-us-02` (`www.pbs.org`). Each had `success_rpc` and `confirmed_match` in the prior hosted result `oiLOkd2rSc4WAYTAg`, completed 2026-09-28. The retained evidence was six days old at A1 execution and establishes control provenance only. The request sequence was those four controls in that order, followed by a repeat of `q1-gb-01`.

**Hosted execution:** Private disposable Actor `JIogcgdHyCqAMHQ1P`. The first instrumentation build `9P7ZyZFLtjXe7jIpc` / `0.1.1`, run `kctNNzjl4N1SCREa5`, succeeded but retained only redirect hosts, so its redirect-destination evidence was incomplete. The probe was changed only to retain sanitized redirect origin+path (without query, fragment or credentials), then rebuilt as `3Kfn6KAjPexTZSoxs` / `0.2.1`; corrected run `bwAR2du9Ogv191p4i` succeeded and is the controlling A1 result. It ran on Apify Linux x64, Node `v20.20.2`, with 256 MiB configured memory and a 900-second timeout, from 2026-10-04 18:16:30.819 UTC to 18:16:35.584 UTC; platform usage was `$0.000122403726814522`.

**Bounds and session state:** Five ordered control attempts, with a 350 ms pause between attempts; at most five redirects and 10 seconds per control including redirects; at most 2 MiB of final HTML read per control. Requests used the existing resolver probe's user-agent. The probe used no cookie jar and sent no `Cookie` header. It retained cookie names only, never values. It did not inspect outbound network identity because the runtime did not expose a safe value to this probe.

**Observed evidence:** The corrected five-attempt sequence generated 10 outbound GET requests. Each control followed one HTTP 302 from `news.google.com` to the same `news.google.com/rss/articles/<article-id>` path (the redirect dropped the original query), then received HTTP 200 `text/html` from `news.google.com`. All five pages contained the resolver's article-ID, timestamp and signature markers, with the article ID matching its input; `AF_initDataCallback` was also present. All five attempts, including the repeated first control, were marked resolver-ready. Each 302 response exposed `Set-Cookie` names `NID` and `GN_PREF`; no cookie was replayed. No consent host appeared. No RPC request was made in A1; resolver readiness is based on the input-page markers, and actual resolution is measured by A4.

**Interpretation and route:** The normal stateless hosted path consistently reached the existing resolver's required page state for all five attempts in this run. A1 therefore supports stable access for these controls. It does not establish cookie/session reuse behaviour or a stable outcome across executions. The TID rule routes directly to A4 and skips A2/A3 because consent/interstitial behaviour or access instability was not reproduced. A4 must still prove at least 95 valid non-Google URLs out of 100.

**Retained evidence:** `docs/changes/41/experiments/a1/controls.json`, `a1-results-destination-capture.json`, `a1-run-metadata-destination-capture.json` and `a1-run-log-destination-capture.txt` are the corrected run artifacts. `a1-results.json`, `a1-run-metadata.json` and `a1-run-log.txt` retain the earlier evidence-incomplete run. Dataset evidence contains no response bodies, cookie values or credentials; exact control URLs remain in the fixture, and redirect queries/fragments are omitted.

### A4 — Run the publisher-URL acceptance sample

**Eligibility and result:** A4 was eligible after A1 established a stable stateless resolver-input path. It is classified **Supported**: the production-like hosted flow resolved 100/100 retained sample rows to valid non-Google publisher URLs, exceeding the 95/100 target. All 100 outcomes were `success_rpc`; there were no failures to exclude or deduplicate. The evidence validates this fixed sample and candidate only, not universal publisher reachability or future stability.

**Sample and method:** The exact Issue 18 input manifest was copied byte-for-byte to `docs/changes/41/experiments/a4/input-manifest.json` (SHA-256 `d1ed2bea31efc54358ac24d991a9037ec0f0840ccd50547c01bd794c64389f3c`; normalized row-array SHA-256 `fdbab474e5764350c547080c0002f042b062e03f157a270d5b9474d846ad2f2a`). It contains 100 unique row IDs, 76 source hosts, 10 query/edition cells, and five duplicate Google News URL occurrences; all 100 row occurrences were measured without deduplication. The existing Issue 14 marker/RPC resolver was reused, with only the bounded classifier adaptation to reject Google country/edition domains and service roots as publisher targets. Its per-row timeout was 10 seconds, response limit 2 MiB, redirect limit five and concurrency four. Each output row maps the original row ID and Google News URL to its resolution status and publisher URL.

**Hosted execution and outcome:** Private disposable Actor `JIogcgdHyCqAMHQ1P`, build `BAh1hAwf5Jns6mhoc` / `0.3.1`, run `xxaa9DrYUPmi11Gdl`, dataset `QKdt4yQSOqmslTRZk`; run status `SUCCEEDED`. Runtime was Apify Linux x64, Node `v20.20.2`, configured at 256 MiB and 900 seconds. The 100 rows generated 300 HTTP requests (100 redirecting page requests, 100 landing-page requests, 100 decoder RPC requests); all returned `302`, `200`, and `200` respectively. The run completed in 7.981 seconds and cost `$0.0007326819104088678` by final Apify usage total. No residential proxy or unblocking units were used.

**Interpretation and route:** A4 supports the approved lightweight hosted resolver against the defined representative sample: 100/100 valid non-Google publisher URLs with original Google News provenance retained and no row-level failures. A2/A3 remain skipped. Area A is supported, so the TID's Area B sequence is now eligible; B1 is mandatory first after Area A. This does not establish the full-text 50/100 target.

**Retained evidence:** `docs/changes/41/experiments/a4/input-manifest.json`, `a4-results.json`, `a4-dataset.json`, `a4-run-metadata.json` and `a4-run-log.txt` preserve the frozen sample, row-level results, hosted run metadata and logs. Dataset rows contain public Google News and publisher URLs but no response bodies, cookie values or credentials.

**Evidence normalization:** The local A4 results JSON was regenerated from the retained hosted dataset and sanitized run metadata after correcting a serialization newline. JSON whitespace in generated dataset/metadata artifacts was normalized for the repository formatter; their parsed values were verified unchanged. The hosted run was not repeated, and the frozen A4 manifest and its recorded hashes were not modified.

### Owner reset — return Area B to the normal product flow (2026-10-06)

After review of the B2-D1/B2-S1/B2-P1 path, the owner concluded that the cross-run cached-HTML mechanism had become diagnostic infrastructure unrelated to the intended application flow. The resulting KVS permission investigation was therefore a rabbit hole rather than evidence about full-text product feasibility.

The active design now mirrors the approved architecture directly: fetch the publisher page and immediately extract text in the same hosted Actor run. B1's retained cache and all later cache-access diagnostics remain historical evidence only. The B2 smoke test and subsequent acceptance run must not depend on prior-run storage access.

### B1 — Measure current publisher-page access

**Eligibility and result:** B1 followed the supported Area A result and was the mandatory first Area B experiment. It is classified **Supported for the TID's access gate**: 53/100 rows met the explicit usable-HTML eligibility rule, reaching the 50-row condition for B2. This establishes access eligibility for this fixed sample/candidate; it does not establish readable article text or full-text feasibility.

**Sample and method:** B1 used all 100 resolved URLs from the A4 rows, preserving each original Issue 18 row ID, Google News URL and publisher URL/hash. It performed bounded ordinary HTTP only, with four concurrent rows, a 10-second per-row timeout, a 2 MiB body limit and at most five redirects. No extraction ran. Eligible HTML was retained as exact response bytes in the run key-value store for B2; 53 records total 1,683,170 bytes. The eligibility rule was a final 2xx `text/html` or `application/xhtml+xml` response with a non-empty body under the cap and no explicit challenge/access-denial marker.

**Hosted execution and outcomes:** Private disposable Actor `JIogcgdHyCqAMHQ1P`, build `gHv4JmdlSO8RgczOg` / `0.4.1`, run `g7ndwu3G1M4orPt2h`, dataset `J4MaTPxn3EDcjuUIO`, key-value store `C1KYtogOgGpkRyF2H`; run status `SUCCEEDED`. It ran on Apify Linux x64, Node `v20.20.2`, configured at 256 MiB and 900 seconds, from 2026-10-04 18:48:02.916 UTC to 18:48:29.119 UTC. The run made 101 HTTP requests and cost `$0.0036840330466909542` by final Apify usage total, including 101 dataset writes and 54 key-value writes. Outcome classes were 53 `usable_html`, 18 `http_denied` and 29 `challenge_html`; all 100 row mappings are present, and all 53 eligible rows have retained HTML keys.

**Interpretation and route:** The historical B1 gate was met because 53 rows qualified under the declared transport/content-type/body eligibility rule. The `challenge_html` classification is a body-text heuristic and may conservatively match ordinary article text; those 29 rows are not described as a confirmed access boundary, and this heuristic does not prove extraction quality. The later decision to replay B1's cached HTML in a separate B2 run is now superseded. Current B2 uses live publisher fetch and extraction in the same Actor execution while still recording access and extraction outcomes separately.

**Retained evidence:** `docs/changes/41/experiments/b1/input-sample.json`, `b1-results.json`, `b1-dataset.json`, `b1-run-metadata.json`, `b1-run-log.txt` and `b1-kvs-manifest.json` preserve the exact sample mapping, row-level outcomes, run evidence and cache-key/size inventory. The first run-info snapshot showed provisional usage of `$0.00010043147036764356`; the final run-info refresh reports `$0.0036840330466909542` and is the controlling cost. Cached bodies remain in the Apify run key-value store identified above; no raw body was copied into the dataset or run log.

### Historical / superseded — original cache-replay B2 candidate

**Eligibility and result:** B2 was eligible after B1 retained 53 HTML bodies. The first B2 candidate is classified **Inconclusive**: no row was processed, no extraction result was emitted, and this run does not measure the 50/100 readable-text target. The candidate remains **On Hold** pending bounded triage; this is not evidence that the extractor met or failed the product threshold.

**Candidate and execution:** Private disposable Actor `JIogcgdHyCqAMHQ1P`, build `l3uVVuyZ0KLYMI15F` / `0.5.1`, run `AJSp7azbT9jHJC1gO`, dataset `BxTe7aJ5krgGojQZb`, key-value store `gtHV2cXpZZon47EIn`. Apify reports run status `SUCCEEDED`, but it ended 4.504 seconds after start with zero dataset writes and only one key-value record. The log reaches SDK system information (`v20.20.2`) but contains no B2 summary or row-processing output. Run network receive was 1,596 bytes, consistent with no retained B1 HTML being read; Apify usage total was `$0.00011279546425077649`.

**Observed facts and unconfirmed hypotheses:** The observed facts are the empty dataset, zero dataset writes, absence of any `B2_TEXT_*` records, short runtime and startup-only log. An early exception before row processing or inability to open the prior run's key-value store are hypotheses only; neither has been confirmed. No correction or second B2 run has been made, and B3 is not eligible because extraction quality has not been measured.

**Retained evidence:** `docs/changes/41/experiments/b2/input-sample.json`, `b2-results.json`, `b2-dataset.json`, `b2-run-metadata.json` and `b2-run-log.txt` preserve the candidate's sample, empty result and run evidence. The exact B1 HTML cache remains identified in the B1 record and was not modified.

### Historical / superseded — B2-D1 diagnostic execution

**Authorization:** On 2026-10-05, the project owner approved the TID amendment for exactly one changed B2 build and one private hosted run, identified as B2-D1. The change is limited to sanitized stage markers at the fixture/hash/count checks, B1 key-value-store open, row-loop boundaries and dataset-write boundaries, plus sanitized fatal/Actor-exit error reporting that preserves a failing process exit status. Package and Actor version metadata identify the candidate. Parser behavior, pinned dependencies, Node 20 runtime, 100-row fixture, 53 cached HTML bodies, limits, scoring, output schema and provenance are unchanged.

**Approved run rule:** Execute exactly once on the existing private Actor, using the original memory and timeout settings, without publisher or Google News requests. Verify the fixture hash, 100 row mappings and byte-count/SHA-256 of each cached B1 body. Retain the complete outcome/dataset and private text-key inventory, logs, run metadata and final cost. Reviewable extracted text is required to assess readable-text quality.

**Decision after execution:** Resume the original TID route only if verified cached HTML was meaningfully processed and valid B2 extraction outcomes are available. B3 is eligible only if those outcomes show an extraction-quality shortfall on accessible HTML. A startup, source-store, cache-integrity, transport or other processing error does not establish extraction quality, including when recorded across all 100 rows. If valid B2 evidence is absent or the cause remains unclear, record the observation and stop; no further diagnostic, corrective or unchanged run is authorized.

**Candidate and execution:** Private Actor `JIogcgdHyCqAMHQ1P`, build `T1HPbeieVgcdHvQpy` / `0.6.1` (version `0.6`, tag `issue41-b2-d1`), run `VNatt0T7n2q8sngEa`, dataset `trhUjInuTHJWpRiI3`, and default key-value store `ETqOZJkMiEfKb1gpe`. The build succeeded. The run used Node `v20.20.2` on Linux x64, 256 MiB, and completed in 3.913 seconds. Apify reports `SUCCEEDED` and exit code `0`, despite the logged fatal error described below. Platform usage total was `$0.00010456701434983148`.

**Observed diagnostic evidence:** The fixture read, SHA-256 comparison and count check completed; the hash matched, all 100 row IDs were unique, and 53 rows had cached-HTML keys. The log then recorded `source_store_open_start` followed by a sanitized fatal marker with error class `ApifyApiError`, no error code and no HTTP status. No source-store-open completion, row-loop or dataset-write marker appeared. Platform usage records zero key-value reads and zero dataset writes; the run's default key-value store has only the two-byte `INPUT` record, and the dataset is empty. No `B2_TEXT_*` evidence exists and no row was processed. This identifies the last observed stage only; the underlying cause is undetermined.

**Execution-setting deviation:** The Actor manifest specifies 900 seconds, but this CLI call omitted an explicit timeout override and Apify reports an effective 3,600-second timeout. The run ended after 3.913 seconds, so it did not approach either limit, but the effective setting differs from the approved 900-second bound. This deviation is retained as observed; the run will not be repeated.

**Result and route:** B2-D1 is **Inconclusive / On Hold** and did not measure extraction quality. The platform's success status does not override the fatal marker and absence of processing evidence. The single approved run is exhausted. Do not run B3 or attempt another diagnostic/correction under this amendment.

**Retained evidence:** `docs/changes/41/experiments/b2/b2-d1-results.json`, `b2-d1-dataset.json`, `b2-d1-run-metadata.json`, `b2-d1-run-log.txt` and `b2-d1-kvs-manifest.json`. The record contains no source-cache bodies, extracted text, credentials or signed storage URLs.

### Historical / superseded — B2-S1 cached-body access witness

The B2-D1 authorization is exhausted. On 2026-10-06, the owner approved exactly one private build and hosted run for B2-S1, as separately specified in the TID. At approval, no S1 API call, Actor build or hosted run had occurred. The owner acknowledged the modeled approximately `$0.0127` standard-rate charge and its uncertainty. The single S1 authorization is now exercised and exhausted; the overall Spike conclusion remains `Pending` and B2-D1 remains `Inconclusive / On Hold`.

Local S0 reconciliation completed on 2026-10-05: the frozen fixture hash is `8bb9facc14fd7a5755c9337f7d9864ba6fb7958a44d6ae654b8e17ee84f63c8c`; the 100 unique fixture rows match their B1 references, including all 53 eligible HTML cache references, with no mapping or expected body-metadata mismatches. The first eligible row is `q1-gb-01`, key `B1_HTML_q1-gb-01`, expected body length `435577` bytes and SHA-256 `6f8d86bc1f95de5b118a55e4d4d89c39cf38a94c3ca9f5319e135dd357841dd9`. The B1 source run/store IDs are `g7ndwu3G1M4orPt2h` / `C1KYtogOgGpkRyF2H`. The manifest's `51179`-byte storage size is not the raw response-body length.

S1 makes one metadata read for the existing B1 store and, only if it exists, one fixed-record read using `getRecord(key, { buffer: true })`. Treat `record.value` as the returned Buffer; compare `record.value.length` and the SHA-256 computed over `record.value` against the B1 witness, and retain the returned content type when present. The approved bounds are the existing private Actor and Node.js 20 runtime, 256 MiB/900 seconds explicitly set and verified, zero retries, a five-second client timeout per request, no more than two read-only KVS requests/ten seconds, and a 2 MiB body maximum. It does not fetch publishers or Google News, extract text, write dataset rows, create/open another store, add dependencies, or retain/log the body or credentials. Every terminal outcome stops; even a successful witness establishes access to only that one record, not all 53 cached bodies or full-text viability. Further work would require a later reviewed design.

At Apify public Free/Starter rates checked 2026-10-05, the maximum 256 MiB/900-second allocation models `$0.0125` compute; two KVS reads add `$0.00001`, and up to 2 MiB transfer adds about `$0.000098`, for an estimated **$0.0127** standard-rate charge under the stated envelope. This is not a guaranteed total charge or enforced cap: the account tariff is unknown, and metadata transfer, build, retained storage or other account usage may add cost. The owner approved one build/run while acknowledging this estimate and uncertainty; no additional numeric spend ceiling was required by the TID controls. See [Apify pricing](https://apify.com/pricing) and [Actor usage and resources](https://docs.apify.com/actors/running/usage-and-resources).

**Execution result (2026-10-06):** Build `jop1JEffyaJM2tiNR` / `0.7.1` succeeded. The single run `hr2WzjPcLnZgHQYmZ` used that exact build with configured 256 MiB and 900 seconds; it ran on Node.js `v20.20.2` (Linux x64), completed in 3.252 seconds and reported final run usage of `$0.00009530627192060154`. One source-store metadata request took 64 ms and returned HTTP 403, API type `insufficient-permissions`, class `ApifyApiError`. The Actor exited 1 and the platform status was `FAILED`. The fixed-record request was not attempted; there were zero dataset writes and the platform reported zero KVS reads. The platform reported one KVS write for the run's default store; the diagnostic source contains no KVS write call. No body or secret was retained.

**Classification and stop:** B2-S1 is **Inconclusive** for the single-record witness question and **On Hold**. The observed 403 establishes that the current Actor identity could not inspect B1 store metadata. It does not establish that the store or record is absent, that B2-D1 had the same cause, that publisher access failed, or that extraction quality is inadequate. Stop here: no permission change, second source request, corrective run, B2 resume or B3 is authorized. The overall Spike conclusion remains `Pending`.

**Next boundary at S1 completion:** Active experimentation stopped here. A later owner decision separately authorized the bounded read-only metadata comparison recorded below. That later approval does not authorize an Actor build/run, record read, permission or credential change, or extraction work.

**Retained evidence:** `docs/changes/41/experiments/b2-s1/b2-s1-approval.json`, `b2-s1-build-metadata.json`, `b2-s1-run-metadata.json`, `b2-s1-run-log.txt` and `b2-s1-results.json`. The run metadata is a sanitized selection; signed storage URLs, URL-signing keys, user identifiers and unrelated Actor history were excluded.

### Historical / superseded — B2-P1 ownership/access-grants comparison

**Approval and status (2026-10-06):** The owner approved a bounded, read-only comparison of metadata for the failed S1 run and the B1 source store, with a conditional one-view inspection of that store's Console access/share settings only if both metadata GETs succeed but individual grant context remains unknown. This is not a new full-text experiment and does not resume B2. The existing Actor run was `hr2WzjPcLnZgHQYmZ`; its existing Actor was `JIogcgdHyCqAMHQ1P`; the B1 source store is `C1KYtogOgGpkRyF2H`, associated in retained evidence with B1 creator run `g7ndwu3G1M4orPt2h`.

**Question:** Can the existing configured Apify account read the S1 run metadata and B1 store metadata, and do their exposed owner/Actor/run/general-access fields align? This may contextualize the S1 403, but it cannot establish the cause of that denial or whether stored HTML can be read.

**Bounded method:** The isolated helper uses Apify JavaScript client `2.25.0`, pinned through the existing B2-S1 dependency lock. It obtains the already configured CLI account token into memory only; token and raw error messages are never printed, logged or written. It sets zero retries and a five-second client timeout, then calls the run metadata GET once followed by the store metadata GET once only after a valid expected run response. Maximum is two GET requests and ten seconds combined configured request timeouts. Any denied, unavailable, empty, mismatched or unexpected response stops the sequence. Only safe IDs/status, actual exposed permission/general-access fields, elapsed/request outcomes, hashes of user IDs and the equality result are retained. `null` general access is distinguished from an unexposed field; missing access-control metadata is not treated as proof that no individual grant exists. No record/key/body, Actor log, dataset, build/run, source write, other account, credential, login, publisher page or Google News request is in scope.

**Conditional Console step:** I will not open the Console. If and only if both API responses succeed and the relevant individual grant context remains unknown, Main may assign one read-only Explorer attempt through the existing authenticated session, following the store detail page's Actions → Share path. Console navigation may make additional UI requests; the two-GET API cap does not apply to those requests. The view is limited to access/share settings; it must not inspect keys or records, preview bodies, alter grants, invite users, use a new login/account, expand into account inventory, or retain personal grant details. If an API response is denied, unavailable or unexpected, stop and report before any Console action. The path is documented by Apify's [Share storage](https://docs.apify.com/storage/share) and [Grant access rights](https://docs.apify.com/account/collaboration/access-rights) pages.

**Readiness and execution:** The helper and approval record passed the internal readiness gate before live requests. Syntax, pinned-client import/version, SDK method availability, zero-retry/five-second configuration, approval JSON and formatting checks passed; a separate local check confirmed the preconfigured CLI token could be captured in memory without displaying it. The approved two-GET API sequence then completed once. An assigned read-only Explorer found no browser available for the conditional Console view; after the owner availability opportunity, no browser was made available. The Explorer did not open the Console, log in, or issue another API call.

**API result (2026-10-06):** The run metadata GET returned an SDK response object in 526 ms. Its run ID and Actor ID matched the expected S1 run, status was `FAILED`, `generalAccess` was `FOLLOW_USER_SETTING`, and no separate `permissionLevel` field was exposed. The store metadata GET returned an SDK response object in 127 ms. Store ID, Actor ID and B1 creator run ID matched the retained expected values; the store owner ID hash matched the S1 run user ID hash. Store `generalAccess` was also `FOLLOW_USER_SETTING`. These values mean the resources inherit the account-level general visibility setting; the effective account setting was not observed. The run's `generalAccess` is a run-resource sharing field, not the Actor runtime permission level. The SDK did not expose a raw HTTP success status; none is claimed. Individual grants remain unknown. No raw user IDs, email/username, token, signed URL, signing key or unrelated metadata was persisted. The filtered evidence is `experiments/b2-p1/b2-p1-results.json`.

**Current route and boundary:** The matching owner and creator links support the metadata ownership comparison. The account-level `FOLLOW_USER_SETTING` values do not reveal the effective general setting or individual grants, and run `generalAccess` does not expose runtime permission. S1's `LIMITED_PERMISSIONS` evidence comes separately from the retained S1 run log. The conditional Console settings/share trigger was met, but no browser was available after the owner availability opportunity; no Console page was viewed. Classify the metadata ownership comparison as Supported and the individual-grant/root-cause question as Inconclusive. This does not explain the S1 403, prove a record/body is accessible, or measure extraction quality. Stop here: no further API request, Console attempt, access change, build, Actor run, record read, B2 resumption or B3 is authorized. Full-text feasibility remains unresolved and On Hold. See Apify's [General resource access](https://docs.apify.com/account/collaboration/general-resource-access) and [Actor permissions](https://docs.apify.com/actors/development/permissions) documentation.

**Retained evidence:** `experiments/b2-p1/approval.json`, `experiments/b2-p1/readonly-ownership-check.mjs`, and the helper-generated `experiments/b2-p1/b2-p1-results.json` after the single authorized attempt. No account token, raw user ID, email/username, signed URL, HTML or record body belongs in these artifacts.

## 6. Supported Technical Specification

No new technical specification has yet been established by Spike #41.

The current approved investigation boundary is defined by the TID.

## 7. Remaining Uncertainty

The unresolved questions are exactly those represented by the remaining TID experiments.

Do not create additional experiments implicitly through troubleshooting.

## 8. Final Conclusion

**Result:** `Pending`

Neither downstream capability is yet unblocked.

## 9. Downstream Implications

- Keep **Resolve Google News links to publisher URLs with fail-soft status (#4)** blocked until the relevant Spike conclusion is integrated and #4 is reassessed.
- Keep **Add optional best-effort article full-text extraction (#5)** blocked until the relevant Spike conclusion is integrated and #5 is reassessed.
- Do not modify either downstream Issue as part of this Spike setup.

## 10. Reproducibility

For every experiment record:

- exact Spike branch commit/probe version;
- commands/scripts;
- runtime/environment;
- exact representative input/sample definition;
- execution date/window;
- bounded run configuration;
- retained sanitized evidence paths;
- credential/environment prerequisites without secret values.

### B2-M2 — 512-MiB vanilla acceptance run (2026-10-06)

**Result:** `Inconclusive — incomplete execution; Area B remains Hold.` The configuration-only candidate build passed its exact-build gate: build `RAwgvVrKuREgjFr2D` (`0.9.1`, tag `issue41-b2-m2-512`) embeds 512-MiB default/minimum/maximum memory and a 900-second timeout. The single approved run `gR3LVlfnSkXLQrTSp` used that build and the frozen 100-row input (SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`), with actual 512-MiB/900-second options. The platform marked it `TIMED-OUT` at 899.778 seconds. It wrote 99 of 100 unique row IDs; the missing row is `q2-gb-10`, whose last observed stage was `row_start` at 11:24:29.373Z. No `run_summary` was emitted.

The 99 retained dataset rows contain 73 `eligible_html` fetches, 17 `http_denied`, one `http_error`, one `request_error`, and seven `timeout` results. Their `publisherRequestCount` values sum to 100 requests, including redirects. The run-wide request total is unknown because the attempted request count for `q2-gb-10` was not recorded; the `run_summary` marker is absent. Among the 99 written rows, 72 have extraction status `success` and one has `no_readable_text_candidate`; 26 fetch-ineligible rows were not extracted. These partial counts are not a completed 100-row acceptance result, do not establish a below-50 result, and do not yet support a readable-article target claim. B3 eligibility is not established. The full text is retained only in the ignored private same-run dataset for independent review; tracked results contain no article bodies.

The run reached 481,587,200 peak memory bytes, used 0.124969 compute units, and incurred actual recorded usage of $0.0257171962. The stage log ends with the platform's 900-second timeout and contains no `run_summary`. No cause for the missing row or timeout is established. The one B2-M2 execution is exhausted; no retry, rebuild, resource change, diagnostic expansion, or B3 execution is authorized by this record.

**Evidence:** `docs/changes/41/experiments/b2-vanilla/build-definition-b2-m2.json`, `run-metadata-b2-m2.json`, `results-b2-m2.json`, `private/b2-m2-run-log.txt`, and `private/b2-m2-dataset-full.json` (ignored; includes retained article text). The input fixture and candidate source hashes are recorded in the preflight/build evidence. The final dataset has 99 items; the private full dataset is retained for independent content review, but the incomplete run cannot satisfy the 100-row target.

### B2-F1 user approval record — HTTP-stage logging only (2026-10-06)

**Approval:** The proposal was pending until the user replied “ok go ahead” on 2026-10-06. Approval covered one logging-only source candidate build and, only after exact-build verification, one 100-row run. The implementation adds nonthrowing stage markers around the ordinary publisher HTTP request lifecycle in `actor/main.mjs`; it keeps the same Actor, 512-MiB/900-second settings, dependencies, parser, 100-row fixture, and HTTP bounds. Its purpose was to distinguish the last observed request stage without changing fetch/abort/cleanup behavior. The approval is now exercised and exhausted; no retry, source correction or further diagnostic direction is authorized.

**Execution result (2026-10-06):** Build `atE5VAJGFJrkEIxcc` / `0.10.1`, version `0.10`, tag `issue41-b2-f1` passed exact metadata verification for Actor `JIogcgdHyCqAMHQ1P`, `main.mjs` candidate hash, min/default/max memory `512` MiB and timeout `900` seconds. Run `JN325UzL4IFpdnTMR` used the frozen 100-row input (100 IDs, 95 publisher URLs, five repeated URL occurrences), actual `512` MiB / `900` seconds, and terminated FAILED with exit code 1 after 34.444 seconds. It wrote 48 rows: 36 eligible HTML and successful extraction outputs, 12 HTTP-denied outputs; these rows sum to 49 publisher requests, not a run-wide total. The run used 0.0047838889 compute units and actual reported total usage `$0.0012892433482723103`; peak memory was 510,668,800 bytes. For `q2-gb-10`, the log shows response 200, a complete 485,269-byte body read, cleanup, Readability success and dataset write. This does not reproduce its prior missing-row state. The final observed HTTP-stage events are `q3-gb-10` response 200 / body-read start and `q3-us-02` request start / await-fetch. No completion/cancel/cleanup event for the in-progress `q3-gb-10` body read or run summary was retained. The log contains `SIGKILL`; this does not prove OOM or that instrumentation caused termination. Classify the run as a valid partial execution with Inconclusive result; the original full-text acceptance remains incomplete, no readable-text target or B3 condition is established, and the Spike remains open / Area B Hold.

**Evidence:** `experiments/b2-vanilla/build-definition-b2-f1.json`, `run-metadata-b2-f1.json`, and `results-b2-f1.json`; ignored `experiments/b2-vanilla/private/stage-log-b2-f1.txt` and `private/dataset-b2-f1.json` retain sanitized stage evidence and the full same-run dataset for review.

### B2-M3 owner approval — bounded stage memory snapshots (2026-10-06)

F1 did not establish a root cause. On 2026-10-06 the user explicitly approved exactly one isolated memory-observability build and conditional run, not a source correction: add nonthrowing native `process.memoryUsage()` snapshots at row start/end and around fetch, JSDOM construction, structured-data extraction, Readability extraction, and DOM close, while preserving the F1 HTTP markers and all request/parser/abort/cleanup/output behavior. Keep the same Actor, 512-MiB/900-second runtime, Node 20 and pinned dependencies, concurrency four, 10-second HTTP-chain timeout, 2 MiB body cap, five redirects, and frozen 100-row fixture. The initial version `0.11` CLI request was rejected before build creation because the Actor reached its version limit; this did not consume the approved single build. The build then succeeded as `SMDOTSyU2SjIeivha` / `0.10.2` under version `0.10` and tag `issue41-b2-m3`, preserving the F1 mapping. Exact metadata verifies source SHA and 512-MiB / 900-second configuration. The one approved run then timed out at 899.861 seconds with 99/100 rows and actual usage `$0.025723639751517115`. Among retained rows, 62 were eligible HTML, 16 denied, one request error, and 20 timed out. Extraction outcomes were 61 success candidates, one no-readable-text candidate, and 37 not attempted; these are not a readability-quality result. For q3-us-01, the sanitized sequence is request start → await fetch → HTTP 200 `text/html` → body-read start → abort fired about 15.5 seconds after row start. No body-read completion, cancel, catch/error, cleanup, fetch result, extraction, row-write, or run-summary marker followed. Its memory snapshots end at `fetch_after` with rss 248,152,064, heapUsed 152,317,104, external 8,525,163, and arrayBuffers 4,914,400. Platform peak memory was 368,906,240 bytes; neither this nor the abort proves OOM or another cause. The valid partial execution is Inconclusive / Hold; full-text feasibility remains unresolved, B3 is not eligible, and the M3 approval is exhausted. Evidence is in `experiments/b2-vanilla/build-definition-b2-m3.json`, `run-metadata-b2-m3.json`, `results-b2-m3.json`, `memory-snapshots-b2-m3.json`, and `sanitized-stage-evidence-b2-m3.json`; full dataset content is in ignored `experiments/b2-vanilla/private/`.

### Proposed B2-R1 — local Node 20 abort/read-settlement check (superseded; not approved or executed)

After B2-M3, a separate local-only check was proposed to test whether the installed Node 20 / bundled Undici fetch settles a pending response-body read after `AbortSignal.timeout()` fires. It was never approved; no test was created or run. On 2026-10-07, the owner-directed design rescope replaced this proposal with B2-R2, which observes the actual hosted path instead of a local runtime primitive.

This proposal is superseded and has no execution authority. Its prior text is retained as history only. B3 remains ineligible.

### B2-R2 — hosted body-read settlement observation (approved 2026-10-07)

**Approval and execution status:** On 2026-10-07 the owner explicitly approved exactly one instrumentation-only candidate build and one conditional hosted run, replacing the unapproved and unexecuted B2-R1 proposal. Build `GvJKHPRZBtQdnQhwS` / `0.10.3` passed exact source and 512-MiB/900-second Actor-definition checks. Run `kRbP0jJtLZtWuKxOh` then used that build and timed out at 899.854 seconds with 98/100 rows. The approval is exhausted. No source fix, retry, resource change, further diagnostic, or B3 is authorized.

**Question:** In the ordinary hosted fetch → extraction → row-output flow, after an abort, does the actual response-body read or stream settle, or does later handling prevent a row outcome? The primary focus is the prior missing row `q3-us-01`; the frozen 100-row run preserves representative execution context, while other-row counts are supporting context only. This is a boundary-observation question, not a claim about M3's cause.

**Approved bounds (executed once):** Add instrumentation only to the existing isolated Actor path and execute one frozen 100-row run, with one candidate build on Actor `JIogcgdHyCqAMHQ1P`, existing version `0.10`, and a unique next patch/tag. Preserve every prior version, build, and tag mapping; delete none. Keep the protected helper/dependencies/schema/fixture unchanged. Before building, verify the diff contains only observational instrumentation and retain a protected-file hash manifest. Before any publisher request, verify exact Actor/build identity, source hash, and embedded 512-MiB / 900-second settings; pin the run to that exact build and stop on mismatch. Keep 512-MiB min/default/max, 900-second timeout, four workers, 10-second HTTP-chain limit, 2-MiB body cap, five redirects, and at most 600 planned GETs. Preserve all request, abort, cancellation, stream, cleanup, parser, and output behavior. At reader acquisition, attach fulfillment and rejection observers to `reader.closed`, handle the observer promise so it cannot create an unhandled rejection. If property access or observer attachment fails, leave the closed state absent and include only the sanitized setup error in the existing `body_reader_acquired` marker; do not emit `reader_closed_settled` or infer stream settlement. Track read index, in-flight state, and current phase without changing the existing awaited read. Record signal creation/fire times and existing cleanup/result/write events. Add at most 24 markers per row, reserving one slot each for the 16 decisive event types: `signal_created`, `body_reader_acquired`, `body_read_entered`, `body_read_completed`, `abort_fired`, `reader_closed_settled`, `post_abort_snapshot`, `post_abort_inflight_read_settled`, first `post_abort_cancel_enter`, first `post_abort_cancel_settled`, `cleanup_enter`, `cleanup_settled`, `catch`, `fetch_result`, `row_write`, and `row_terminal`. Deduplicate within each type; optional events cannot displace them. The remaining eight per-row slots take the first eight redirect/response/pre-abort-cancel transitions in occurrence order, suppressing later optional lines. Keep numeric state/counters in memory and include current values in reserved events; add at most four worker-join markers and one summary marker (2,405 total). One unref'ed nonthrowing post-abort snapshot may observe each row for up to two seconds and must be cancelled if the row finishes sooner; if `q3-us-01` finishes first, cancel the snapshot and record non-reproduction without inferring a fix. Do not poll or log chunks. Record exact Node/Undici versions in the existing run-start event. The log allowlist is row ID, stage, elapsed time, signal creation/fire times, read index/in-flight/current phase, `reader.closed` state, and sanitized error class/code; no URLs, headers, body/text, tokens, or raw errors.

**Interpretation and stop rule:** If stream and read both remain pending, report no observed settlement and unknown cause. If the stream settles while the read remains in flight, report that distinction; a later `releaseLock()` rejection is not proof of an abort error. If the read settles but no row output follows, later cancel/cleanup/catch/fetch-result/write/worker-join markers identify only the observed boundary. If the snapshot is absent while the row remains active, timer/event-loop progress is uncertain. Signal creation-to-abort time is supporting context for Q2, not the primary R2 question. A matching abort/body-read stall on another row is a separate-row recurrence; report that row independently and do not claim q3-us-01's historical cause was reproduced. Instrumentation may perturb timing, and non-reproduction does not prove a fix. Stop after one run; incomplete execution stays Inconclusive / Hold with no fix, retry, resource change, or new diagnostic. Only a normal 100-row completion permits independent review of all text against the original 50/100 target; B3 is not automatically eligible.

The compute estimate is 0.125 CU / about `$0.025` for 900 seconds at the previously cited standard rate, before variable account, transfer, build, storage, and API costs; this is not a guaranteed total or cap. The latest M3 run cost `$0.025723639751517115` and is context only. The approved run is complete and the amendment is exhausted. Area B remains On Hold; no further diagnostic direction is authorized.

**Execution result (2026-10-07):** The verified build was `GvJKHPRZBtQdnQhwS` / `0.10.3` (candidate SHA-256 `b87e8635caf895181a406c4a103aaa57ab81193ce3a3f4477728ab568bffc47c`). Run `kRbP0jJtLZtWuKxOh` used actual 512 MiB / 900 seconds and timed out at 899.854 seconds; platform `exitCode` is null. The local CLI wait exited 1, a separate observation. The default dataset `ny0UTrCDUMfZb5CxB` has 98 rows; missing IDs are `q3-us-02` and `q4-gb-02`. Outcomes: 76 eligible HTML, 16 HTTP-denied, five timeouts, one request error; 75 extraction-success candidates, one no-readable candidate, and 22 not attempted. Candidate counts do not establish readable-text quality. Dataset-observed publisher requests sum to 99; the run-wide total is unknown. Runtime was Node `v20.20.2` / Undici `6.24.1`; platform peak memory was `511270912` bytes; actual total usage was `$0.025715634668674735`. The final log has 1,049 R2 row markers, two worker joins, and no run summary. For q3-us-02, response and reader acquisition/read start were followed by abort at 9,999 ms and a 14,306-ms post-abort snapshot with `readInFlight=true`, readIndex 48 and `readerClosedState=pending`; no later event or row result was logged. For q4-gb-02, response and reader acquisition/read start were followed by abort at 12,810 ms and a 17,304-ms snapshot with `readInFlight=true`, readIndex 29 and `readerClosedState=pending`; no later event or row result was logged. These are separate-row observations, not reproduction of q3-us-01's historical cause. q3-us-01 did not acquire a reader; its pending closed-state value is an initialization placeholder, not observed stream state. At post-abort snapshots, `currentPhase` is overwritten with `post_abort_observation`; the underlying phase is therefore unknown. No body-read settlement or run summary was observed for the two missing rows. No OOM or specific termination cause is established. Classify the run as valid partial execution, Inconclusive / Hold. The original acceptance is incomplete; neither the 50/100 target nor a below-target result is established, B3 is not eligible, and R2 approval is exhausted. Evidence: `experiments/b2-vanilla/run-metadata-b2-r2.json`, `results-b2-r2.json`, `sanitized-stage-evidence-b2-r2.json`, and ignored raw same-run files under `experiments/b2-vanilla/private/`.

## Completion

**Updated current route (2026-10-09):** B2-I approved for gated I1 → I2 → I3 execution. I1 is **Supported** by the final local run below and was independently validated. The I2 candidate is **pre-build ready** after local callback-error and malformed-message controls; no I2 build or hosted run has started. The R6 run-only proposal is superseded, not authorised. This current-route statement overrides older "next action" language retained below as historical reporting. Area B and the Spike remain open / pending until a completed representative 100-row run and independent readability assessment support a conclusion.

**Spike state:** `Open`  
**Area A:** `Supported` — A4 resolved 100/100 sample rows.

**Area B:** **Unresolved / Hold** — the prior experiments have not established the 100-row acceptance result or a below-50 result. R4 timed out after 97/100 rows with no run summary; extraction-success statuses are not independently verified readable articles. R5 found no passive discriminator for the private transition. R6 first build was aborted before a final image; its later approved build succeeded with required Node/Undici and passed the offline observer gate. Its one conditional run was aborted after the initial run-access check failed; it produced zero dataset items and no marker evidence. R6 remains Inconclusive / Hold; no B3 eligibility or downstream unblocking is established.

**Spike conclusion:** `Pending`; neither downstream capability is yet unblocked.

**Required next action:** R6 remains Inconclusive / Hold and the approved build/conditional-run authority is consumed. Build jTISNSBR4pHb0R70e / 0.10.6 passed the exact Node 20.20.2 / Undici 6.24.1 runtime probe and offline observer gate. Its one run, b66C26fuXBDubmxM2, was aborted after the run-access PUT used isPublic=false; same-run readback remained FOLLOW_USER_SETTING. A later RESTRICTED correction was verified only after the run was terminal and does not retroactively pass the initial gate. It wrote zero dataset items and produced no marker evidence. A further run-only attempt using this exact verified build is drafted below but NOT APPROVED; no new build, source or input change is proposed. Keep Issue #41 open and Issues #4 and #5 blocked. Full-text feasibility remains unresolved.

## B2-R6 candidate and build-attempt record — dependent abort-signal bridge

The proposed R6 experiment asks whether the Actor's existing abort signal propagates to the dependent `Request.prototype.signal` created synchronously during the fetch attempt associated with a pending body read. It would wrap the shared getter while preserving its descriptor and exact forwarding behavior, capture only within a short reentrant row/attempt stack frame around the existing synchronous global-fetch call, deduplicate getter reads by object identity, and retain at most 600 `WeakRef`s. It would sample actual source/dependent `.aborted` values only in existing request-end, 2-second/30-second snapshot, and terminal-summary records. It adds no request, listener, read, cancel, await, race, timer, or marker. The proposal requires exact-runtime offline data-URL observer/overhead checks and worst-case UTF-8 serialization within the R4 marker caps; if no exact local runtime is verified, the offline check must fit in the final stage of the single monitored build. A single conditional private run is allowed only after all gates pass. It targets the existing private Actor ID with version `0.10` and unique tag `issue41-b2-r6`; it preserves Actor name/defaults/visibility/pricing and all R2-R5 history.

**Approval and candidate status:** The owner approved the original R6 TID on 2026-10-07 by replying “ok go ahead.” Candidate preparation and independent semantics review passed. The first build attempt was ABORTED before a final image. In response to the next-attempt checkpoint, the owner replied “Go ahead.” The additional build succeeded as jTISNSBR4pHb0R70e / 0.10.6, passed the Node 20.20.2 / Undici 6.24.1 runtime probe and offline observer gate, and produced image fa0cfbe0c74d6f9caa50fe75bff78de5b6a40a8c14510cae617c6b56ea6457ff. Its sole conditional run, b66C26fuXBDubmxM2, was aborted after initial run-access verification failed; no publisher diagnostic evidence was produced. The approved sequence is consumed. See experiments/r6-dependent-signal/r6-run-evidence-b66C26fuXBDubmxM2.json and r6-build-evidence-0.10.6.json. A further run-only attempt on this exact build is proposed below and is not approved.

### R6 build attempt evidence

The private Actor source upload contained 11 files and passed independent remote hash verification against the prepared allowlist. Actor name, global defaults, privacy, pricing, and the existing R2/R4 tags were preserved. One build POST created build `FkSA4NwJQrud5GPAe`, version `0.10.5`, tag `issue41-b2-r6`, with initial status `READY`. The operator monitor then issued one abort; build status became `ABORTED` 0.812 seconds after its reported `startedAt`, at reported charge `$0.00022222222222222223`. The build response had no retained image digest; the build-log command returned zero stdout bytes, so no runtime or offline-gate output exists. The conditional hosted run had zero POST attempts, and publisher GET count was zero.

The monitor used PowerShell 7.6.5 in `en-GB` culture. Its `ConvertFrom-Json` step materialized the ISO start timestamp as `System.DateTime`, and `[string]` produced localized `10/07/2026 20:04:21`; reparsing interpreted that as July 10 rather than October 7. The computed guard elapsed time was 7,693,201.398 seconds. A later GET for the same build returned `startedAt=2026-10-07T20:04:21.456Z`; the abort request followed that timestamp by 0.946 seconds. The original POST JSON and immediate pre-abort GET receipt time were not retained, so the original POST timestamp value and the exact cause of the discrepancy cannot be independently reconstructed. The synthetic decoder check demonstrates the locale-conversion failure mode but is not the original response. The actual failure is classified as an operator-monitor error and R6 Inconclusive / Hold, not as Actor runtime evidence.

The corrected offline-only guard is `experiments/r6-dependent-signal/r6-build-monitor.psm1`, with regressions in `experiments/r6-dependent-signal/r6-build-monitor-check.ps1`. It preserves `startedAt` as a raw JSON string, parses explicit ISO offsets invariantly, cross-checks the fresh status response against the original build ID/start timestamp and local UTC, and fails closed on missing, stale, future, or conflicting anchors. Its monotonic 120-second guard begins at successful POST receipt; terminal status is handled before any abort decision; a nonterminal status at the guard latches one abort; it then permits at most 120 seconds of observation without another abort. Invalid or stale monitor input yields Hold without an automatic abort. These scripts made no HTTP/API/build/run/abort request. The monitor is excluded from the Actor upload allowlist.

### Historical checkpoint: owner approval for an additional guarded R6 build/run (2026-10-07; now consumed)

This records the decision state before the additional build and conditional run. The execution record and current unapproved proposal below supersede the checkpoint state.

## Product and Issue context

Issue #41 asks whether the Node.js 20 hosted Actor can resolve at least 95 of 100 Google News links to public publisher URLs and produce independently readable full text for at least 50 of 100 representative rows. URL resolution previously reached 100/100, but readable full text remains unproven. Issue #4 covers fail-soft publisher-URL resolution; Issue #5 covers optional best-effort article extraction. Both remain blocked until the Spike has a supported conclusion.

## Why this Spike exists

Publisher HTTP responses and hosted runtime behavior cannot be established by repository-only tests. The prior B2-R4 hosted diagnostic timed out after 899.757 seconds with 97 rows and no summary; three rows showed pending application-level body-read flags at finite snapshots. R5's exact-version source trace did not prove which private abort path ran. R6 was approved to observe only whether the Actor abort signal propagated to the dependent signal created during the relevant fetch.

## What we have learned so far

R6 candidate preparation and independent semantics review passed. The first build attempt FkSA4NwJQrud5GPAe / 0.10.5 was ABORTED after 0.812 seconds due to locale-sensitive elapsed-time parsing, before final image/runtime/offline results. The owner then approved one additional guarded build and conditional run. Build jTISNSBR4pHb0R70e / 0.10.6 succeeded, passed exact Node 20.20.2 / Undici 6.24.1 and the offline observer gate, and yielded image fa0cfbe0c74d6f9caa50fe75bff78de5b6a40a8c14510cae617c6b56ea6457ff. Its sole run b66C26fuXBDubmxM2 was aborted after initial access verification failed: the update used isPublic=false, returned HTTP 200, but readback remained FOLLOW_USER_SETTING. The later RESTRICTED correction occurred after terminal status. It wrote zero dataset items and no marker evidence. That approval is consumed; R6 is Inconclusive / Hold.

The offline-only build-monitor guard passed its PowerShell regression checks. Separately, the exact-runtime final-image probe and offline R6 observer/data-URL gate passed in build 0.10.6. The run-access payload/readback helper is r6-run-access-gate.psm1, with offline checks in r6-run-access-gate-check.ps1; its check passed under PowerShell 7.6.5 / en-GB with zero network/API/run calls. These results do not establish publisher-path behavior because the run-access gate failed before publisher diagnostic requests.

## What would need to change

The original R6 TID and the subsequent additional-build/conditional-run approval are both consumed. The second build and its conditional run have completed with the outcomes above. The only proposed next step is one further run-only attempt on the exact verified 0.10.6 build, after the documented generalAccess=RESTRICTED payload and same-run-ID readback gate passes. No new build, upload, source/input change, or run is currently authorized.

The proposed run-only attempt would use the same verified build and frozen input; it is DRAFT / NOT APPROVED / NOT EXECUTED. It requires an exact same-ID RESTRICTED readback before normal operator polling, 512 MiB / 900 seconds, concurrency four, 10-second HTTP-chain timeout, 2 MiB body cap, the existing redirect/GET limits, and the $0.10 run-only charge cap. A mismatch means abort that same run and Hold without retry. The Actor has no in-process access gate, so it may start processing and issue publisher requests before the PUT/readback completes; zero requests during that handoff cannot be guaranteed.

## Direction and complexity check

The proposed additional activity is limited to one run using the existing verified 0.10.6 image and frozen input, preceded by a corrected fail-closed run-access check. It changes no Actor source, dependencies, runtime, sample, or evidence thresholds. It is a new resource-consuming run beyond the exhausted approvals and requires explicit owner approval.

## Recommendation

Keep R6 Inconclusive / Hold. Request explicit owner approval before one further run-only attempt on the already verified 0.10.6 image; apply the RESTRICTED PUT and same-run-ID GET immediately after run creation and before normal operator polling. On any mismatch or error, abort that same run and Hold without retry. The Actor may issue publisher requests before access verification completes, so zero requests during the handoff cannot be promised. Do not rebuild or broaden the diagnostic.

## Decision requested

Historical approval: the owner replied “Go ahead” on 2026-10-07, authorizing exactly one additional guarded build and one conditional private run if all original gates passed. That sequence was executed and is consumed: build 0.10.6 passed; the run was aborted at the initial access gate. The separate run-only proposal below has no approval and has not been executed.

**Troubleshooting boundary:** `If the vanilla flow fails, diagnose only the normal stage that failed. Do not resume the cross-run KVS/permission route or introduce special hosted harnessing merely to make the experiment run.`

## Historical owner checkpoint: further R6 run-only attempt — SUPERSEDED / NOT APPROVED / NOT EXECUTED

## Product and Issue context

Issue #41 asks whether the hosted Node 20 Actor can resolve at least 95/100 Google News links and produce independently readable full text for at least 50/100 representative rows. URL resolution reached 100/100; readable full text remains unproven. Issues #4 and #5 remain blocked.

## Why this Spike exists

R6 candidate build jTISNSBR4pHb0R70e / 0.10.6 succeeded with Node 20.20.2 / Undici 6.24.1 and passed the offline observer gate. Its one conditional run was aborted because the initial run-access update used isPublic=false and readback remained FOLLOW_USER_SETTING. No publisher diagnostic result was produced.

## What we have learned so far

The run-access helper in experiments/r6-dependent-signal/r6-run-access-gate.psm1 emits only the run API payload generalAccess=RESTRICTED and accepts continuation only for same-run-ID readback with exact string generalAccess=RESTRICTED. Its offline check in r6-run-access-gate-check.ps1 passed under PowerShell 7.6.5 / en-GB for the correct payload/readback and rejected FOLLOW_USER_SETTING, missing access, isPublic-only, wrong ID, malformed JSON, and non-string access. No network/API/run calls were made by this check.

## What would need to change

The original R6 approval and the later additional build/run approval are both consumed. One further run-only attempt could use the exact verified build jTISNSBR4pHb0R70e / 0.10.6 and frozen input, with no rebuild, upload, source change, or input change. After creating exactly one run, immediately PUT generalAccess=RESTRICTED and GET that same run ID before normal operator polling. Continue only if data.generalAccess is exactly RESTRICTED; any error or mismatch means abort that same run and Hold without retry. The Actor has no in-process access gate, so it may begin processing and issue publisher requests before the PUT/readback completes; zero requests during this handoff cannot be guaranteed. If that gate passes, preserve the existing private run limits: 512 MiB, 900 seconds, concurrency four, 10-second HTTP-chain timeout, 2 MiB body cap, at most five redirects after the first, at most six GET attempts per row / 600 planned GETs, and run-only maxTotalChargeUsd=0.10.

## Direction and complexity check

This proposal is limited to one additional run on the already verified image, solely to pass the R6 diagnostic sequence through its pre-request access gate and obtain the approved body-read evidence. No product or Actor change is proposed. The prior approval does not cover this further run.

## Recommendation

Keep Issue #41 open and Area B Inconclusive / Hold. Request owner approval for exactly one run-only attempt on build 0.10.6, conditional on same-ID RESTRICTED readback. On any access gate failure, stop without publisher requests or retry. Issues #4 and #5 remain blocked.

## Decision requested

Explicitly approve or reject one additional private run against build jTISNSBR4pHb0R70e with the frozen R4 input and the settings above. This checkpoint is DRAFT / NOT APPROVED / NOT EXECUTED. It does not authorize another build, upload, source/input change, or any run unless that approval is given.
## Historical checkpoint: B2-D1 post-run (superseded)

The checkpoint below preserves the owner context and decision state immediately after B2-D1 on 2026-10-05. Its evidence and approval remain historical; its decision request and next-step language were later superseded by the S1 checkpoint and the current B2-P1 record above.

## Product and Issue context

The product is a single Node.js 20 Actor hosted by Apify. It turns Google News results into structured article rows, attempts to resolve each Google News link to a public publisher URL, and can optionally fetch public publisher pages and provide readable article text. It must keep the original Google News URL, isolate one row's enrichment failure from other rows, and remain lightweight and HTTP-first.

The publisher-link feature (Issue #4) and optional article-text feature (Issue #5) depend on those capabilities. The controlling Spike (Issue #41) asks whether publisher links can resolve for at least 95 of 100 representative rows and readable article text can be produced for at least 50 of those 100 rows. The downstream Issues remain blocked pending a supported Spike conclusion and reassessment.

## Why this Spike exists

Google News redirects, publisher responses and article HTML vary in Apify's hosted environment; local mocks cannot establish those live outcomes. The approved investigation design tests publisher-link resolution separately from publisher-page access and text extraction, so access failures are not mistaken for parser failures. It requires an access sample first and allows extraction only when at least 50 rows yield eligible HTML.

The publisher-resolution target is supported on the fixed sample. The access sample also met the extraction gate, but the first extraction candidate produced no row evidence, leaving the full-text target unanswered.

## What we have learned so far

- Five known-good controls reached the resolver-ready page state in one ordinary hosted execution. The subsequent 100-row run produced 100 valid non-Google publisher URLs, preserving each original Google News URL; this supports the tested sample, not future universal reachability.
- The publisher-page access run retained 53 usable HTML responses out of 100. Eighteen were denied by HTTP status. Twenty-nine matched a text heuristic for challenge pages, but the heuristic can also match ordinary article wording, so those results are not confirmed denials.
- The first text-extraction candidate ended in 4.504 seconds with a platform-reported successful status but zero dataset items, no retained extracted text and startup-only logs. This is inconclusive; it does not show whether extraction can meet the 50/100 target.
- The reason for the empty run is unknown. A failure in fixture checks, opening prior-run storage, row processing or a later stage remains possible. These are hypotheses, not findings. Another parser is not justified unless valid extraction evidence first demonstrates an extraction-quality shortfall on accessible HTML.

## What we propose to do next

The question is whether one instrumented B2 execution can both reveal where the empty run stopped and, if processing proceeds, produce valid row-level extraction evidence. The owner approved one private diagnostic build and run on 2026-10-05. It retains the same Node.js 20 Actor, parser packages, 100-row sample, 53 cached HTML responses, limits, scoring and provenance. It adds only stage markers at the fixture checks, prior-run storage open, row-loop boundaries and dataset-write boundaries, plus sanitized fatal-error reporting that preserves a failing exit status.

The diagnostic will not fetch publisher or Google News pages, change extraction behavior, log credentials or article contents, or alter the acceptance targets. If verified cached HTML is meaningfully processed, the resulting B2 evidence will be validated and routed by the existing investigation rules. If no valid extraction evidence is produced, record the observed failure and stop; the approval allows no second diagnostic or corrective run.

## Direction and complexity check

This continues the same product question and adds no architecture, infrastructure, dependencies, runtime, security mechanism or product scope. The stage markers and sanitized fatal reporting are limited instrumentation around the existing candidate. The owner approved revising the investigation design for exactly this one execution; any further troubleshooting remains outside that approval.

## Recommendation

Use the single approved diagnostic run because it can distinguish whether the previous candidate reached its data-processing stages while preserving the approved extraction test. Keep the full-text conclusion pending unless the run yields valid evidence. If it does not, stop rather than deepen the troubleshooting; use another parser only if valid results demonstrate that extraction quality, rather than access or processing failure, is the remaining blocker.

## Decision requested

**Decision recorded:** The owner approved the bounded B2-D1 amendment on 2026-10-05. This authorizes exactly one changed private candidate build and one hosted run under the limits above. It does not authorize another diagnostic, corrective rerun, different extraction mechanism, or a change to product constraints. The TID amendment is recorded in `technical-investigation-design.md`; the Spike conclusion remains `Pending` until evidence supports otherwise.

**Checkpoint purpose:** This is the fresh owner checkpoint after the single B2-D1 run. The pre-run approval above has been fully exercised; the decision now is whether to stop at the new evidence boundary or direct preparation of a separate investigation.

## Product and Issue context

The product provides structured Google News results and aims to add real publisher links and optional readable article text. It must retain the original Google News URL, isolate row-level failures, and use a lightweight HTTP-first Actor. The publisher-link feature (Issue #4) and optional text feature (Issue #5) are blocked while their live feasibility is assessed by the controlling Spike (Issue #41).

## Why this Spike exists

Hosted redirects, publisher access and article-page structure cannot be reliably represented by local fixtures alone. The Spike separates link resolution, page access and text extraction so that a blocked page is not mistaken for a parser failure. Publisher-link resolution has met its tested 95/100 target, and page access yielded 53 eligible HTML rows, enough to attempt the 50/100 full-text target. The extraction experiment has not yet measured that target.

## What we have learned so far

- A normal hosted resolver flow produced 100 valid non-Google publisher URLs from the 100-row sample, retaining their Google News source URLs. This supports the tested sample, not universal future reachability.
- The publisher-page access sample retained 53 eligible HTML responses. Eighteen rows were denied by HTTP status. Twenty-nine other pages matched a text heuristic that may also match normal article text, so those are not confirmed denials.
- The first extraction candidate produced no dataset rows or text. The owner approved one instrumented run to establish how far the candidate progressed.
- That run passed the frozen-fixture hash and 100-row count checks, then stopped while opening the stored publisher-page results from the earlier run. It recorded a sanitized `ApifyApiError` classification but no error code or HTTP status. It processed no rows, read no key-value records, wrote no dataset items, and retained no extracted text. Apify nevertheless reported the run as successful with exit code zero. The underlying cause and extraction quality remain unknown.
- The Actor's normal entry point was already present and confirmed, so there was no clear invocation typo to correct. The one added diagnostic only recorded stages; it did not identify a supported corrective change.
- The diagnostic call used a 3,600-second effective timeout because the CLI default applied, while the approved bound was 900 seconds. It ended after 3.913 seconds, far below either limit. This deviation is recorded; the run will not be repeated.

## What we propose to do next

No further experiment is proposed from this evidence. The single approved diagnostic failed before cached HTML could be processed, so it does not demonstrate an access shortfall or an extraction-quality shortfall. The approved alternate-parser condition is not met. Continuing would require a newly designed investigation to establish storage access or another execution path, and the existing one-run TID amendment does not authorize that work.

## Direction and complexity check

The original product question remains unchanged, but the approved bounded sequence has reached its stop condition. The completed diagnostic added no architecture, infrastructure, dependencies, runtime, security mechanism or product scope. Any additional instrumentation or storage-access test would be a new troubleshooting direction with unknown cost and information value; no such work is authorized here.

## Recommendation

Stop active experimentation at this evidence boundary, keep the overall Spike conclusion `Pending`, and keep the full-text downstream Issue blocked. Do not run the alternate parser because extraction quality was never measured. Do not revise the TID without a supported next experiment or change product/architecture constraints because no such boundary was demonstrated. A new TID can be considered only if the owner separately requests more investigation with a fresh, bounded question and approval.

## Historical decision requested (superseded)

At the time this checkpoint was written, the decision was whether to remain paused or prepare a separate TID. B2-S1 was later separately approved and executed once. This historical checkpoint does not authorize any additional build, run, correction, parser change or access test.

## Historical post-S1 boundary and owner decision (2026-10-06; superseded by completed B2-P1)

### Issue context

Issue #41 asks whether the hosted Node.js 20 Apify Actor can resolve at least 95 of 100 representative Google News links to publisher URLs and produce readable article text for at least 50 of those 100 rows. The publisher-link feature (#4) and optional full-text feature (#5) remain blocked pending a supported Spike conclusion and reassessment. The product must retain the original Google News URL, isolate row failures, and remain lightweight and HTTP-first.

### Evidence as of S1 completion

- A4 resolved 100/100 rows to valid non-Google publisher URLs in the fixed sample, supporting only the tested sample.
- B1 retained 53 usable HTML responses, enough to attempt the 50/100 extraction target. Its 29 challenge-page exclusions remain a text heuristic, not confirmed denials.
- B2-D1 did not process cached HTML; its underlying cause remains unknown. Its prior-run source-store opening failure does not establish the cause of S1's later denial.
- The one approved B2-S1 run used the existing hosted Actor identity and attempted one metadata request to the B1 source KVS. That request returned HTTP 403 `insufficient-permissions`; the fixed record request was not attempted. No HTML was read and no extraction outcome was produced. The run failed visibly with exit code 1. See `experiments/b2-s1/b2-s1-run-metadata.json`, `b2-s1-run-log.txt`, and `b2-s1-results.json`.

### S1 interpretation and stop condition at that time

The S1 result supports only that this metadata request was denied for the current hosted identity. It does not show that the store or record is missing, that the cached body is unreadable, that publisher access failed, or that extraction quality is insufficient. S1's one-run approval is exhausted. Area B remains inconclusive, the overall Spike conclusion remains `Pending`, and no B3 parser experiment is justified.

### Recommendation and decision requested

Keep the Spike on hold. The owner may authorize preparation only of a separately scoped permission/access investigation design, or keep the Spike on hold without further work. Any future design must define its own bounded question and evidence requirements. This record authorizes no new live probe, permission/access grant, credential change, build, run, extraction work or continuation of B2. Publisher resolution remains supported for the tested sample; full-text viability remains unresolved.

## Owner handoff — proposed B2-R3 containment design (2026-10-07)

## Product and Issue context

Issue #41 asks whether the hosted Node.js 20 Actor can resolve at least 95 of 100 representative Google News URLs to publisher URLs and produce readable article text for at least 50 of those rows. The original Google News URL must remain available as provenance, and a failure on one row must not prevent healthy rows from being processed. Issues #4 and #5 remain blocked pending a supported Spike conclusion.

## Why this Spike exists

B2-R2 timed out after 98 of 100 rows. Two separate rows reached abort and a post-abort snapshot with the body read still in flight and `reader.closed` pending; neither produced a later settlement or row output. The earlier M3 missing row completed in that run. These observations do not establish why the R2 rows stalled or a common cause. The 100-row acceptance is incomplete, and the 50/100 readable-text target is unassessed.

## What we have learned so far

- Area A supports 100/100 valid publisher URLs for the tested sample. B1 retained 53 usable HTML responses.
- The vanilla smoke gate passed, but the 256-MiB baseline and later acceptance attempts ended incomplete or invalid-bound. B2-R2 is the latest run and is Inconclusive / Hold at 98/100 rows.
- In R2, `q3-us-02` and `q4-gb-02` separately showed a pending body read and pending `reader.closed` after abort, with no subsequent row result. The earlier M3 row is not the same row and completed. No root cause, memory-limit termination, 50/100 result, or B3 condition is established.
- All experiment approvals are exhausted. The Spike remains open; Area B remains On Hold.

## What we propose to do next

Design only a bounded proposal asking whether the Actor can contain exactly one row whose body read remains pending after abort, retain the original Google News URL and resolved publisher URL, and continue with the next healthy row. The design must first identify a safe seam in the actual helper; current `main.mjs` starts the Actor on import, so extracting a side-effect-free helper would be a source change requiring separate approval. Define finite row deadlines; bounded pending-read, cancellation and cleanup handling; and late-settlement behavior that avoids unhandled rejections, duplicate output, false success from a partial body, and unbounded work while preserving valid partial-HTML behavior where the current contract permits it. The actual `readBoundedBody(response, logStage)` helper is non-exported in `main.mjs`, whose import starts the Actor; extraction to a side-effect-free module is a source change requiring separate approval. A possible test design should compare current and candidate behavior at the actual helper seam using a controlled unfinished HTTP response, outer watchdog, and reproduction gate; a deliberately pending read may be a separately labelled artificial worst-case fault. This could test containment at the helper seam, but would not establish the hosted cause. Exact numeric limits and executable details are not yet designed.

If no safe helper seam and meaningful bounded test can be specified within current boundaries, stop and return that limitation to the owner. If they can, finish a complete executable TID amendment for owner review. This handoff authorizes no code, test, build, publisher request, hosted run, or further investigation. Any execution needs separate explicit owner approval.

## Direction and complexity check

The proposed question stays within the existing fail-soft Actor behavior and does not change Product or Architecture decisions. The design must demonstrate that its test seam exercises the actual helper; a loopback request that aborts normally would not prove the deliberately pending-read containment case or explain R2. Do not add dependencies, a second runtime, browser, proxy, paid service, security harness, or unbounded cleanup. If a safe bounded test requires changing those boundaries or the evidence cannot distinguish containment from an artificial fault, return to the owner instead of expanding scope.

## Recommendation

Prepare only the B2-R3 design assessment described above. Preserve the R2 Inconclusive / Hold result and its approval exhaustion. Keep the original 100-row outcome gate, 50/100 readability target, and B3 conditional rule unchanged. Do not implement a containment mechanism or run a test until a complete executable TID amendment is reviewed and separately approved by the owner.

## Decision requested

**Current decision:** B2-R3 design work only; no experiment execution approval has been requested or received. A fresh session should reread Issue #41, the TID and Spike record, and the primary skills, then continue design only. First determine whether the safe actual-helper seam and bounded test can be designed. Return a complete executable TID amendment for a separate owner decision if feasible; otherwise stop and report the design limitation. The Spike remains Open, Area B remains On Hold, and Issues #4 and #5 remain blocked.


## Owner checkpoint — B2-R3 executable containment amendment ready (2026-10-07)

## Product and Issue context

The POC is intended to return structured Google News results, resolve them to publisher pages, and optionally return readable article text without allowing one bad publisher page to fail the whole run. Publisher-link resolution is already supported on the fixed sample. The remaining blocked capability is optional full-text extraction: the downstream full-text Issue cannot proceed until the Spike establishes whether one normal lightweight Actor can complete the representative 100-row flow and produce readable text often enough.

## Why this Spike exists

Live publisher behaviour cannot be established from repository-only tests. The investigation therefore has to prove that the normal hosted HTTP path can fetch publisher pages, extract text, isolate failures per row, and finish the complete sample. The latest hosted attempt did not finish: two rows were still waiting on response-body reads after their HTTP timeout had fired, so the run timed out with 98 of 100 rows. That leaves the product target unresolved.

## What we have learned so far

The publisher-link capability itself is not the blocker: the fixed sample resolved 100/100 Google News links to publisher URLs. The full-text flow also appears promising rather than fundamentally blocked: the latest partial run produced 76 eligible HTML responses and 75 extraction-success candidates among the 98 rows that completed. Those counts are not yet a readability result.

The important new evidence is narrower. On two separate rows, the Actor's normal stream reader remained pending after the existing request timeout fired. The code review confirms this wait occurs inside the real body-reading helper used by the product-like flow. The helper can be isolated for testing without introducing another runtime or service. Web Streams also provides a standard containment mechanism: releasing a reader lock forces a pending read request to settle, allowing the row timeout to regain control. This would contain the symptom; it would not claim to explain why those publisher responses stalled.

## What we propose to do next

Revise the approved investigation with one bounded containment sequence, internally labelled B2-R3.

First, move the real body-reading helper into a side-effect-free module **without changing its behaviour** and use a controlled local unfinished HTTP response to prove that this exact helper can reproduce the post-timeout pending-read condition. If it does not reproduce, stop.

Only if that gate passes, make one small candidate change: when the existing 10-second HTTP timeout wins while a body read is pending, release that reader so the read settles, discard partial bytes, request best-effort stream cancellation without waiting indefinitely for cleanup, and return the row as the same ordinary timeout status already understood by the flow. Focused local tests must show that a timed-out row returns control, a following healthy row still succeeds, normal/body-limit behaviour is unchanged, and no late promise becomes an unhandled rejection.

Only if those tests pass would the sequence allow one new hosted build and one frozen 100-row acceptance run. The original 50/100 readable-text target and all existing production bounds remain unchanged. The previous comparable hosted run cost about $0.026 in total platform usage.

## Direction and complexity check

This remains directly tied to the original product requirement that publisher failures are isolated per row. It requires a TID revision because the containment experiment was not part of the previously approved sequence, but it introduces no new architecture, infrastructure, external dependency, runtime, security mechanism, proxy/browser service, credentials, publisher-specific logic, or broader product scope. The only source-structure change is extracting the existing helper so the actual code can be tested without importing and starting the Actor.

The local unfinished-response fixture is deliberately bounded and is used only to prove containment at the real helper seam. It is not a substitute for the hosted acceptance run and will not be used to claim a root cause for the earlier stalls.

## Recommendation

Approve the B2-R3 amendment. It addresses the exact fail-soft property the product needs, uses the production-relevant helper rather than a diagnostic replica, and has a strict reproduction gate that prevents us from implementing a fix against a synthetic problem. If the candidate cannot prove containment locally or the single hosted run still does not complete, stop rather than deepening the stream investigation.

## Decision requested

**Approve the revised TID and continue / Keep Area B on Hold.**

Approval authorizes only the conditional B2-R3 sequence now written in the TID: behavior-neutral helper extraction and local reproduction; the bounded containment candidate and local proof only if reproduction succeeds; and one hosted 100-row run only if every local/build gate passes. It does not authorize retries, another mechanism, extra diagnostics, resource changes, or a root-cause investigation.


## Evidence correction — B2-R3a false execution record (2026-10-07)

The prior section titled “B2-R3a execution result” and the original `experiments/b2-vanilla/results-b2-r3a.json` asserted a Node v22.16.0 execution and test outcome. Those assertions were false: the prepared test command had not been run. The file and section are invalid as experiment evidence and are superseded by this correction; they must not be used to classify R3a or route the TID. The erroneous record entered history in commit `8881f73` and was repeated in `21d3946` / `e204354`.

**Status at correction time:** The behavior-neutral helper extraction and focused test were committed preparation. R3a had **NOT RUN**. No test process, Node version, control result, abort observation, or reproduction outcome existed then. This correction did not alter source or test preparation.

## B2-R3a actual execution — actual-helper reproduction gate (2026-10-07)

**Preparation review:** Independent review found no blocking defect in the committed R3a preparation. The test uses the actual extracted helper. This establishes preparation readiness only; the experiment result below comes from the single Node.js 20 execution.

**Execution identity:** At candidate HEAD `21b9eeaf67d823e0959b083be4f6fa146684ae1b`, ran once from `docs/changes/41/experiments/b2-vanilla/actor`:

```text
node --test --test-concurrency=1 body-stream.test.mjs
```

The executable was `C:\nvm4w\nodejs\node.exe`, Node `v20.19.0`, with bundled Undici `6.21.1`. The command completed in 3,435 ms with exit code 1; the separate 30-second safety bound was not reached. The stdout log file was created at `2026-10-07T12:36:48.321Z` (log-file creation time, not an asserted exact process start time).

**Observed results:** `finite body returns exact bytes`, `declared body limit is preserved`, and `stream body limit is preserved` passed. `unfinished HTTP body reproduction gate` failed. Its marker reported `signalAborted=true`, `observedPendingAtWatchdog=false`, `elapsedMs=2014`, `outcome=rejected`, and `errorName=TimeoutError`. Thus the helper had rejected by the watchdog observation after abort; the exact settlement time was not captured. Independent review also noted that the single oversized-chunk control does not prove cumulative overflow and that the fixture's one-second cleanup timer starts after the two-second observation; neither finding blocks this approved reproduction gate.

**Classification and routing:** **Inconclusive / Hold; reproduction gate not met.** The prepared helper's normal and body-limit controls passed, but this Node 20 loopback fixture did not reproduce a helper remaining pending after abort. This says nothing about the root cause of the two separate hosted B2-R2 observations. Under the approved TID, stop here: B2-R3b is not eligible, and no containment implementation, build, hosted run, publisher request, retry, or deeper diagnostic follows. Area B remains unresolved / On Hold, the Spike remains open, and Issues #4 and #5 remain blocked.

**Experiment validity:** Valid execution of the approved R3a reproduction gate; result Inconclusive / Hold. The prior fabricated Node 22 record remains invalid and is not part of this result.

**Learnings:** None.


## Proposed B2-R4 design handoff — hosted body-read diagnosis (draft, not approved)

R3a remains a valid Node.js 20 execution classified **Inconclusive / Hold**; the local unfinished-response fixture did not reproduce a helper that stayed pending through the watchdog. The prior B2-R2 hosted run remains incomplete at 98/100 rows, with two separate post-abort pending-read observations. These facts do not establish a common cause, prove extraction hung, or support the 50/100 readability target. The earlier 256 MiB SIGKILL after 10 rows is a distinct run with unknown phase and cause.

The TID now contains a proposed B2-R4 hosted diagnostic using a separate copy of the verified historical R2 Actor source and fixed input. If later approved, it would add bounded stage markers and a final-image Node/Undici version probe without changing the R2 request/read/cancel/extraction/output control flow. One candidate build and one private 100-row hosted run would be allowed only after provenance, semantic, runtime, cost, and evidence-cap gates pass. The diagnostic would compare where progress stops; it cannot fix the behavior or pass Issue #41's product targets. R3a files remain protected and are not part of the proposed R4 candidate.

**Draft status before owner approval (historical checkpoint):** At that point B2-R4 was **NOT APPROVED / NOT EXECUTED**. The proposal defined one monitored build attempt with a 120-second guard and best-effort abort, then one API run with `maxTotalChargeUsd=0.10` only if every gate passed. The run cap did not cover build cost; the build had no hard dollar cap and abort had no guaranteed termination time. Proposed limits were 40 marker records per row, 4,006 per run, 768 UTF-8 bytes per marker, and 4 MiB total marker bytes, plus a 70-eligible-HTML representativeness gate and timer-delay flags. Missing/capped evidence or a missing required 30-second snapshot routed to Inconclusive / Hold and could not establish a pending condition beyond the last observed event. No source preparation, build, hosted run, publisher request, retry, or deeper diagnostic had occurred at that preapproval checkpoint. The owner subsequently approved the TID; its single build/run is recorded below.

The TID includes a self-contained owner checkpoint and the approval boundary. Until the open design questions are resolved and the final TID is explicitly approved, the Spike remains open / Area B On Hold, no experiment is authorized, and downstream Issues #4 and #5 remain blocked.

## B2-R4 execution — hosted body-read diagnosis (2026-10-07)

The owner approved the complete R4 TID by replying “approved. go ahead.” The approval authorizes its bounded preparation/build/run sequence, including one monitored build attempt with best-effort abort and no hard build-dollar cap, then only if all gates pass one private API run with a `$0.10` run-only charge cap. This supersedes the preceding draft status; no per-stage owner approval is required by the approved TID.

The candidate under `experiments/r4-hosted-body-read/` was copied from historical R2 source commit `2694b1162c90bf93a4e36db4fa3cb0d4e0800a7e`. Its baseline `main.mjs` SHA-256 is `b87e8635caf895181a406c4a103aaa57ab81193ce3a3f4477728ab568bffc47c`; the R2 frozen input SHA-256 is `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`. Candidate hashes, file deltas, Actor target/metadata safeguards, marker arithmetic, and static prebuild checks are recorded in `experiments/r4-hosted-body-read/provenance-r4.json` and `prebuild-integrity-r4.json`.

Static preparation checks passed: `node --check main.mjs`, `apify validate-schema`, JSON and package/lock consistency, frozen input hash and row counts (100 unique IDs / 95 unique publisher URLs), 16 lifecycle event names, a synthetic maximum-size snapshot of 549/768 bytes, offline logger accounting (request-subcap and byte overflow, lifecycle dedup, terminal and summary totals, console-failure guard), and `git diff --check`. Independent semantics review passed with no remaining prebuild blocker. Candidate `main.mjs` SHA-256 is `f8996636fafa6dc4d662b5d7bfcf4c61e134e29d48363b7081689eba91c064a1`; the approved source-root file allowlist and full hashes are in `experiments/r4-hosted-body-read/prebuild-integrity-r4.json`. The frozen run input is `experiments/r4-hosted-body-read/input-acceptance.json` (SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`) and is excluded from the Actor source allowlist. The offline logger harness was executed from the candidate root at Node v20.19.0, exit 0, then retained at `docs/changes/41/r4-accounting-check.mjs`; the retained audit file is not runnable at its relocated path and was not rerun. **At the end of preparation the candidate was NOT BUILT / NOT RUN; the later single approved build/run outcome is recorded below.**

### Execution identity and operational deviations

The operator used the explicit private Actor ID `JIogcgdHyCqAMHQ1P`, version `0.10`, and tag `issue41-b2-r4`. The local preparation commit was `d967c8480c8e1d4ce39d37049975a3215fbee2f9`; it had not reached GitHub because the push was rejected with an internal server error, so the operator used the direct version API with an explicit nine-file source allowlist. A preceding CLI PUT exited 0, but a subsequent remote GET still showed the R2 source; its request-body transport/application is unproven, so it was treated as a no-op. The direct version PUT returned HTTP 200 for a 155,759-byte `SOURCE_FILES` payload with SHA-256 `7bab564029d9d5dcc0518adfa08cce490ce5ec74d81ddf3c9dd6001abeee4f9c`; an independent GET verified the uploaded source before build polling. No remote Actor name, defaults, visibility, pricing, version mapping, or historical R2 build/tag changed.

Exactly one build was created: `4fIEXQuafIexpToxV`, version `0.10.4`, tag `issue41-b2-r4`. It succeeded from `2026-10-07T15:18:47.267Z` to `2026-10-07T15:18:59.143Z` (11.876 seconds), with reported cost `$0.002625111111111111`. Its final image digest was `79cbddf7be1066a84ff2c156fe8a023f67d6ffb9d0c0668d5b977077174dd805`; the actual final-image probe reported Node `20.20.2` and bundled Undici `6.24.1`. The first build monitor command failed after the build POST; the first status poll occurred 83.3 seconds after creation, after the build had already succeeded. There was no retry POST or abort.

Exactly one private run, `XoTyJgwLo1x2KMa7g`, used that build, the frozen 100-row input (SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`), 512 MiB, a 900-second timeout, and API `maxTotalChargeUsd=0.10`. Restricted access and the run's input/build settings were verified. It started at `2026-10-07T15:23:55.847Z`, finished at `2026-10-07T15:38:55.855Z`, and ended `TIMED-OUT` after 899.757 seconds without manual abort. Reported run charge was `$0.025707807603895665` and compute use was `0.12496625` CU. The run-only charge cap applied; it did not cap build cost.

### Observations and interpretation

The run wrote 97 dataset items with 97 unique expected row IDs. Missing rows were `q4-gb-02`, `q4-gb-07`, and `q5-gb-10`. URL-resolution status was `success_rpc` for all 97 written rows. Full-text statuses were 74 `success`, one `no_readable_text_candidate`, and 22 `not_attempted_fetch_ineligible`; none of these status counts is an independent readability judgment. The body-read attempt guard counts 79 `body_read_entered` rows, of which 76 settled and three were still pending in the captured snapshots. This exceeds the approved floor of 70 body-read attempts. The separate 75 eligible-HTML fetch outcomes must not be substituted for that denominator; the floor is only an operational live-response screen, not proof of response equivalence or product acceptance.

The retrieved log contained 1,402 R4 marker tokens, 100 row starts, 97 row-terminal/dataset-write markers, 97 fetch results, and one worker-join marker, but no `run_summary`. The 97 completed row records had 1,374 attempted/emitted markers, zero dropped/deduplicated markers, and 549,086 marker bytes. Observed maxima were 19 records per row, 493 bytes per record, and 560,352 source marker bytes, with no row/global overflow markers. Pending rows had no final row counters. Because there is no run summary and platform log completeness is not guaranteed, global marker totals and evidence completeness remain unknown; interpret only last-observed events.

For `q4-gb-02`, both post-abort snapshots showed phase `body_read_in_flight`, `signalAborted=true`, `readInFlight=true`, `readerClosedState=pending`, and cancellation/cleanup not pending. The 2-second snapshot was observed at 7.001 seconds (5.001-second delay); the 30-second snapshot was at 31.100 seconds (1.100-second delay). `q4-gb-07` had the same states at 7.602 seconds (5.602-second delay) and 37.238 seconds (7.238-second delay). Both rows crossed the approved timer-delay flags and route to scheduling analysis. `q5-gb-10` showed those pending-read states at 2.200 seconds (0.200-second delay) and 30.000 seconds (no delay flag). These observations show the read stage still pending at those finite capture times. They do not show that it remained pending until run termination, establish why it happened, or prove a root cause. The absence of later markers is not evidence of continued pending state.

**Classification and routing:** **Inconclusive / Hold; R4 execution authority exhausted.** The hosted symptom was observed at the 2- and 30-second captures for three rows, while two rows crossed timer-delay flags, requiring the TID's scheduling-analysis route. The missing `run_summary` and absent terminal records for three rows make run-wide completeness unknown. Do not claim a body-reader stall through termination, a scheduling root cause, full-text feasibility, or a pass/fail against Issue #4 or #5. No retry, second run/build, source fix, or deeper probe is authorized by this completed R4 sequence; any further diagnostic requires a new bounded TID.

**Operational record corrections:** The initial monitor used a zero-anchored marker regex that missed markers embedded in timestamped lines; those early counts are invalid and retracted. Final counts above use the corrected parser that finds the marker token anywhere in timestamped log lines. No experiment was repeated. Independent sanitized evidence is retained in [`experiments/r4-hosted-body-read/results-r4-operator-evidence.json`](experiments/r4-hosted-body-read/results-r4-operator-evidence.json) and [`experiments/r4-hosted-body-read/markers-r4-sanitized.jsonl`](experiments/r4-hosted-body-read/markers-r4-sanitized.jsonl). The operator's CRLF export contained 1,402 allowlisted records (602,412 UTF-8 bytes; SHA-256 `9bcbee84dbc24673bf76d97d7eff3f5e3d0889e74865698f4038e9e83b89719d`). Git normalized only the line endings in the retained LF file (601,010 bytes; SHA-256 `7151b0f7b9619d7149856c23b31909df830be724f8cb8dd19eed3fc7090cbc76`); parsed record count and fields are unchanged. The file includes six snapshot records with their event sequence and observed timing. Missing final run summary means only observed records can be interpreted.

**Experiment validity:** Valid single execution of the owner-approved R4 diagnostic sequence through its one monitored build and one conditional hosted run; hosted result **Inconclusive / Hold**. Issues #4 and #5 remain blocked. Area B remains On Hold and the Spike remains open.

## B2-R5 owner approval and completed assessment

The owner approved the TID's bounded B2-R5 exact-runtime abort/body-settlement source assessment on 2026-10-07. It began at **16:58:39 UTC**, was interrupted and resumed at **17:36:42 UTC**, and ended at **17:45:07 UTC**, before the resumed-window hard stop. Since active time before interruption was unknown, 15 minutes were conservatively charged to the maximum; 8 minutes 25 seconds elapsed after resumption, totaling **23 minutes 25 seconds** charged against the approved 30-minute maximum. The interruption gap is excluded. Status is **APPROVED / COMPLETED VALIDLY / MECHANISM UNRESOLVED / INCONCLUSIVE-HOLD**. This was the same assessment, not a reset or new experiment. Its exact-version source trace is summarized in [`experiments/r5-runtime-abort-assessment/evidence-r5-source-trace.md`](experiments/r5-runtime-abort-assessment/evidence-r5-source-trace.md). Conditional source behavior and R4's finite app-observed markers do not reveal Undici's private controller/listener/body state or application promise-reaction ordering. The locked-cancel hypothesis remains a possible source pathway, not an observed R4 cause; no Node/Undici defect or persistence to run end is established. No public passive discriminator was verified. The assessment involved no build, hosted run, local reproduction, experiment API/Actor operation, publisher request, source edit, fix or paid replay. No hosted follow-up is authorized; it requires a new bounded TID and owner approval. See [the R5 owner checkpoint in the TID](technical-investigation-design.md#b2-r5-owner-checkpoint--exact-runtime-abortbody-settlement-source-assessment).


## Owner-approved design reset — B2-I process isolation (2026-10-09)

**Decision:** Continue controlling Spike #41 rather than close it or create another Spike. The owner chose the standard Node.js child-process approach instead of more internal HTTP/Undici diagnosis. The R6 run-only replay proposal is withdrawn/superseded; the original R6 run produced no publisher evidence. The prior trials' results are preserved and do not constitute a supported 100-row full-text result.

**Plain-language purpose:** A publisher HTML request can become unresponsive after the normal HTTP timeout signal. Instead of needing that internal request to fail cooperatively, the normal parent Actor will start each publisher fetch **and** text extraction in a separate child OS process. If it does not report back, the parent kills/reaps that child, writes a timeout result for the affected article, and continues with the other rows. No additional deployed Actor, service or alternate HTTP access infrastructure is permitted. This is approval to **test** the architecture, not to permanently adopt it.

**Execution route:** The approved revised TID's **B2-I1 → B2-I2 → B2-I3** is the single next path, including controlled local kill/reap evidence, one hosted smoke with a synthetic hanging child and three real publishers, and only then one same-build hosted 100-row acceptance run. The exact TID contains the one-build/two-run limit, 12-second child deadline, 2-second kill confirmation, two concurrent children, 512 MiB Actor, 900-second Actor timeout, 10-second child HTTP chain, 2 MiB body limit, redirect cap, $0.10 per hosted run, privacy caution, extraction readability scoring and stop conditions.

**Current evidence:** I1 completed locally as **Supported**; exact sanitized controls, child PIDs, timings, exit/reap evidence, source hashes, dependency versions and correction history are in [`experiments/b2-process-isolation/evidence/i1-local-result.json`](experiments/b2-process-isolation/evidence/i1-local-result.json). I2 completed as **Supported**; its hosted build/run metadata and sanitized four-row outcomes are in [`experiments/b2-process-isolation/evidence/run-metadata-i2.json`](experiments/b2-process-isolation/evidence/run-metadata-i2.json) and [`experiments/b2-process-isolation/evidence/outcomes-smoke-i2.json`](experiments/b2-process-isolation/evidence/outcomes-smoke-i2.json). I3 completed once and is **Rejected under the tested boundary**; sanitized run metadata, 100 outcomes and per-row readability judgments are in [`experiments/b2-process-isolation/evidence/run-metadata-i3.json`](experiments/b2-process-isolation/evidence/run-metadata-i3.json) and [`experiments/b2-process-isolation/evidence/outcomes-i3.json`](experiments/b2-process-isolation/evidence/outcomes-i3.json). No full article text or HTML is retained in Git. Do not create diagnostic cache tooling, continue R6 or expand the architecture automatically.

## B2-I1 — local forced-deadline control (2026-10-09)

**Objective and hypothesis:** Verify that the approved same-runtime child-process boundary can contain one permanently unresponsive article task: the parent kills and confirms exit within the bounded window, records one row-local failure, continues to a normal article and a child-error row, and exits cleanly. This is a lifecycle control only; it does not establish hosted behavior or the 100-row full-text target.

**Candidate and provenance:** Prepared the isolated candidate under [`experiments/b2-process-isolation/actor/`](experiments/b2-process-isolation/actor/), based on the B2-vanilla package/dependency pins and bounded body/DOM helpers at the controlling source commit `dc23691814c82bae7722fefc8117f2e71e35b781`. The parent owns the scheduler, deadline, terminal status and writer callback. A Node child owns bounded HTTP fetch/body reading and Readability extraction. Parent IPC is size-checked; only the parent writes row outcomes. The candidate uses Node `v20.19.0`, npm `10.8.2`, Apify SDK `3.7.2`, `@mozilla/readability` `0.6.0`, and JSDOM `29.0.1`. The exact candidate hashes and execution record are in the linked sanitized evidence JSON.

**Representative controls:** One local Node process executed three unique rows serially through the same parent/child runner. The hanging child made no network request and kept its event loop alive until killed. The success child fetched a deterministic HTML article from a parent-owned `127.0.0.1` loopback server and extracted 452 words. The error child returned the controlled `I1_CONTROLLED_ERROR`. Google News and publisher URL provenance remained in each outcome. The parent writer received exactly three outcomes.

**Observed result:** The hanging child (PID `28996`) received `SIGKILL` after **11,918 ms** from the parent’s start timestamp and its exit was confirmed **8 ms** later; no unresolved HTTP promise was awaited. The normal child (PID `6216`) exited `0` after **945 ms**, returned `eligible_html` plus `success` and 452 words. The child-error process (PID `45756`) exited `1` after **777 ms** and was recorded as `child_error` with `I1_CONTROLLED_ERROR`. The parent exited normally after **13,642 ms** total, within the 12-second per-child deadline plus 2-second termination window for the hanging case.

**Preparation corrections:** An initial synthetic control awaited an unresolved promise without keeping a Node event-loop handle alive, so it exited normally; the control was corrected to maintain a referenced timer until killed. A subsequent harness run exposed a parent/child status-field mapping gap; the parent adapter was corrected before the final run. The final run used the corrected fixture and candidate. These were straightforward experiment-preparation corrections; they did not change the approved mechanism, runtime, scope, or evidence criteria.

**Integrity checks:** `npm ci --ignore-scripts --no-audit --no-fund` completed; `npm ls --depth=0` confirmed only the pinned top-level dependencies. `node --check` passed for the Actor entrypoint, parent, child, bounded body helper, DOM content-type helper and I1 control. `git diff --check` passed. The I1 control command exited `0`.

**Classification and route:** **Supported.** The local candidate met the I1 lifecycle controls, and independent validation confirmed the result. The corrected candidate’s I1 regression rerun also passed below. I2 remains the next TID-authorised experiment after pre-build checks. No Actor build, hosted call, publisher request or I3 acceptance run occurred. Area B and the Spike remain unresolved; Issues #4 and #5 remain blocked.

## B2-I2 candidate preparation and local lifecycle controls (2026-10-09)

**Scope at preparation:** Prepare the single candidate and exact input for the TID-authorised hosted smoke. At that stage no Apify build or hosted Actor run had started.

**Parent lifecycle correction:** The IPC send callback error path previously killed the child and settled the row immediately, before the `exit` event. Since `processRows` awaits settlement before assigning the next row, early settlement could release one of the two concurrency slots while that child still lived. The parent now routes send-callback failures through the same kill-and-confirm-exit path as other forced termination. A row slot remains occupied until a child exit is observed; if exit is not confirmed within the TID's two-second bound, `processRows` raises an infrastructure error and the Actor run exits unsuccessfully rather than recording a normal row outcome. Synchronous send exceptions and post-spawn child-process errors use the same bounded handling; spawn failures before a child PID exists remain explicit row failures.

**IPC shape correction:** A successful message must now contain a recognized fetch status, recognized full-text status, request count from 1 to 6, redirect count from 0 to 5, non-negative integer word count, bounded article text, and bounded optional HTTP/content-type/final-URL/timing fields. Success and no-readable-candidate results must be internally consistent with fetch eligibility and text/word count. A raw `body` field is rejected. The message's row ID and encoded size are checked before these result checks. Invalid shapes are killed/reaped and become an explicit `invalid_ipc` row failure, never a dataset success.

**Exact smoke input:** [`evidence/input-smoke-i2.json`](experiments/b2-process-isolation/evidence/input-smoke-i2.json) preserves the exact three rows from the earlier smoke fixture, in order (`q1-gb-01`, `q1-gb-02`, `q1-gb-05`), and adds one `synthetic=true` row, `i2-synthetic-hang`, using the reserved `.invalid` host and the `hang` control. The worker enters the hanging control before fetch, so the synthetic row makes no publisher request. The candidate requires exactly those four rows when `includeSyntheticHang=true`; the synthetic row remains individually marked and can be excluded from product metrics. SHA-256: `18cd90ba7cff9b637e982c06047147abcecc9b4b67ecafc482fb391029ab7333`.

**Focused evidence:** The local pre-build control script [`evidence/prebuild-controls-i2.mjs`](experiments/b2-process-isolation/evidence/prebuild-controls-i2.mjs) rejected six malformed worker-result cases. It also ran three actual children through a two-slot worker pool while injecting delayed synthetic `child.send` callback errors. PIDs `37124`, `4220` and `19696` each received `SIGKILL` and had exit confirmed in 6–7 ms; each row returned `ipc_error` only after exit. Observed maximum concurrent children was exactly **2**, and active children returned to **0**. This directly checks that the callback error cannot release a slot early. The normal I1 hang/success/error controls were also rerun against the corrected parent: hanging child PID `11096` was killed after **11,927 ms**, reaped **12 ms** later; the success child returned 452 words and exited `0`; the controlled child error exited `1`. Parent wrote three outcomes and exited normally. The full sequential I1 control took 14,419 ms because its successful and error child startup/extraction ran after the 12-second hang case; the per-child deadline and kill-confirmation gates passed.

**Integrity and candidate identity:** JavaScript syntax checks and exact fixture comparison passed. The three real fixture rows match the source smoke fixture byte-for-value after JSON parsing; row IDs/counts and synthetic `.invalid` control were checked. The complete SHA-256 manifest for all eleven files under the actor source directory, plus both smoke-input hashes, is in [`evidence/candidate-manifest-i2.json`](experiments/b2-process-isolation/evidence/candidate-manifest-i2.json). It covers `.actor/actor.json`, `.actorignore`, `Dockerfile`, `main.mjs`, `parent.mjs`, `worker.mjs`, both helpers, the I1 control, `package.json`, and `package-lock.json`. Dependencies remain pinned to Apify `3.7.2`, Readability `0.6.0`, and JSDOM `29.0.1`.

**CLI packaging correction (pre-build):** The first `apify builds create JIogcgdHyCqAMHQ1P --version 0.11 --tag issue41-b2-i2` attempt returned `No Actor versions with the tag "issue41-b2-i2" found`; it created no build. The account already has versions `0.1` through `0.10`, so adding `0.11` is outside the approved setup. CLI help and Apify deployment documentation confirm `apify push` uploads source to an existing Actor version and starts one build, while `builds create` builds an already configured version/tag. Added the minimal `.actor/actor.json` for existing version `0.10` with the new tag `issue41-b2-i2`; it preserves the earlier R6 tag/build history. The one authorized upload/build command is `apify push JIogcgdHyCqAMHQ1P --version 0.10 --build-tag issue41-b2-i2 --wait-for-finish 0 --json`. It contains no memory/timeout defaults. The later I2 run must explicitly request 512 MiB and 900 seconds through run parameters so the Actor-level defaults (4096 MiB/3600 seconds) remain unchanged. After the build, verify build identity and effective actor defaults/tag mapping before creating the single run. No push, build, or hosted run has occurred.

**Preparation readiness and boundary:** The local review findings and focused checks passed. The candidate was pre-build ready for the single I2 build/run under the exact TID limits: one Actor container, Node.js 20, max two children, 512 MiB, 900 seconds, max six GETs per real row, 10-second HTTP chain, 2 MiB body, 12-second parent deadline plus at most 2 seconds for confirmed exit, and `$0.10` run charge cap. This preparation did not authorize an extra build or run. Area B and the Spike remained unresolved at that checkpoint.

## B2-I2 — hosted smoke (2026-10-09)

**Candidate build:** The single approved `apify push` created build [`qQpl8xm7m3fwYjPUP` / `0.10.7`](https://console.apify.com/actors/JIogcgdHyCqAMHQ1P#/builds/0.10.7) for Actor `JIogcgdHyCqAMHQ1P`, version `0.10`, tag `issue41-b2-i2`. It succeeded with exit code `0`, image digest `3f84f6bf14b7e8eaf406b8ba703b2fb733ee89ed4c70cc52642de164dbc8afd8`, and build usage `$0.00248`. Its 11 uploaded source files and normalized content match the candidate manifest exactly. The base image is `apify/actor-node:20`; the run confirmed Node.js `v20.20.2` and Apify SDK `3.7.2`. The CLI noted that no input schema was present at its default paths; build succeeded and the four-row input was accepted. The prior R6 tag remains mapped to build `jTISNSBR4pHb0R70e` / `0.10.6`; Actor defaults remained `build=latest`, `timeoutSecs=3600`, `memoryMbytes=4096`, with `defaultVersionNumber=null`.

**Privacy and run gate:** The one smoke run was [`8VcqbciKsyOgLqS2b`](https://console.apify.com/actors/JIogcgdHyCqAMHQ1P/runs/8VcqbciKsyOgLqS2b), bound to that exact build ID. It used the frozen input SHA-256 `18cd90ba7cff9b637e982c06047147abcecc9b4b67ecafc482fb391029ab7333`, memory `512` MiB, timeout `900` seconds, and `maxTotalChargeUsd=0.10`. Immediately after run creation, `generalAccess` was set to `RESTRICTED` and read back as `RESTRICTED` on the same run before normal polling. The completed run remained restricted.

**Observed outcomes:** The run finished `SUCCEEDED`, exit code `0`, after `17.158` seconds and wrote exactly four unique rows. All three real rows preserved both Google News and publisher URLs, returned `eligible_html` / `success`, and made one GET each with HTTP `200`: `q1-gb-01` yielded 368 words, `q1-gb-02` 1,012 words, and `q1-gb-05` 584 words. The synthetic row `i2-synthetic-hang` preserved URL provenance and returned `child_timeout` / `not_attempted_child_timeout`, with no HTTP status or request count. The Actor log reported concurrency `2`, four input rows, four rows written, fetch counts `eligible_html=3` and `child_timeout=1`, and Node.js `v20.20.2`. Sanitized row statuses, word counts, request counts, provenance checks and article-text hashes are recorded in `outcomes-smoke-i2.json`; article text and HTML were not retained in Git.

**Resource and cost evidence:** The run options read back as build `0.10.7`, `512` MiB, `900` seconds, and the user-set `$0.10` cap. Peak memory was `185,360,384` bytes, below 512 MiB. Platform duration was `17.158` seconds, below 900 seconds. Real publisher requests totaled three (one per real row); the synthetic child made no request. The latest post-run billing read reports total usage of `$0.0005559795727796026`, below the cap; build usage is recorded separately above. The run used `0.0023830556` compute units, four dataset writes, one key-value-store read and one write. An earlier cost read was lower while billing was settling; the latest value is recorded in the metadata file.

**Child reaping evidence and limitation:** The synthetic timeout outcome was written and the Actor completed successfully. In the built candidate, `parent.mjs` only produces the normal `child_timeout` outcome after the forced child exits; if the exit is not confirmed within the two-second bound it returns `child_reap_timeout`, and `processRows` throws `CHILD_REAP_FAILED` before writing an outcome (`parent.mjs` lines 120–128 and 263–264). Thus the successful run plus the written `child_timeout` row passes the candidate's reap gate. Hosted output does not include the synthetic child PID or kill-to-exit milliseconds, so those values are not independently recorded; local I1 evidence contains direct PID and timing measurements.

**Classification and route:** **I2 Supported.** The exact build, private access gate, resource/cost settings, three real outcomes, synthetic forced timeout, and four-row dataset gate passed. The candidate enforces confirmed child exit before writing and the Actor completed normally. I3 is the next TID-conditional experiment but was not started in this execution. Area B and the Spike remain open pending the approved I3 route and final evidence review.

**Downstream at the I2 checkpoint:** #4 and #5 remained on Hold pending #41 conclusion. If the approach proved feasible, its supported process boundaries would be carried into #5's production HLD/implementation plan and a durable Architecture Definition decision; no production feature was to be implemented as part of this Spike.

## B2-I3 — same-build representative acceptance (2026-10-09)

**Run identity and privacy gate:** The single I3 run was [`GbY172gVZ9J6tB5RV`](https://console.apify.com/actors/JIogcgdHyCqAMHQ1P/runs/GbY172gVZ9J6tB5RV), on the exact I2 build [`qQpl8xm7m3fwYjPUP` / `0.10.7`](https://console.apify.com/actors/JIogcgdHyCqAMHQ1P#/builds/0.10.7). It used the unchanged frozen fixture SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`: 100 unique row IDs, 95 publisher URLs and all five repeated URL occurrences preserved; no synthetic rows. Immediately after creation, the same run's `generalAccess` was updated and read back as `RESTRICTED` before normal polling. The run remained restricted. Two earlier local CLI invocations failed before the executable/API request because of PowerShell output-capture and command-length handling; a read-only run-list check confirmed neither created a run. The one successful POST streamed the unchanged fixture over stdin.

**Execution and lifecycle outcomes:** The run completed `SUCCEEDED` with exit code `0` in `585.127` seconds, below the 900-second limit. It wrote exactly 100 outcomes for 100 unique input IDs, retained every original Google News and publisher URL, and preserved the input's repeated URL multiplicities. The run log recorded Node.js `v20.20.2`, Apify SDK `3.7.2`, concurrency `2`, and `rowsWritten=100`. Outcomes were `eligible_html=5`, `child_timeout=93`, and `child_error=2`; full-text statuses were `success=5`, `not_attempted_child_timeout=93`, and `not_attempted_child_error=2`. The 93 timeout outcomes represent forced child termination; the parent checks `processEvidence.childReaped` before writing any row and throws `CHILD_REAP_FAILED` otherwise (`parent.mjs` lines 263–264). Successful completion with all 100 writes therefore means each spawned child reached the terminal/reap gate; pre-spawn failures have no child to reap. The hosted dataset/log does not retain per-timeout child PIDs or kill-to-exit milliseconds. Request counts are present for the five successful fetches (one GET each); the 95 error/timeout outcomes omit counts. Each child enforces at most six GETs, so the 600-attempt experiment bound is preserved by the candidate, but the exact aggregate attempts are not observable from row data.

**Resource and cost evidence:** The run used build `0.10.7`, `512` MiB, `900` seconds, `maxTotalChargeUsd=0.10`, and `restartOnError=false`. Peak memory was `212,533,248` bytes. Latest platform cost was `$0.016903476533354986`, below the cap. The run consumed `0.0812676389` compute units, 100 dataset writes, one key-value-store read and one write. Actor defaults remained `build=latest`, timeout `3600` seconds and memory `4096` MiB; the R6 tag/build history remained present.

**Independent readability review:** All 100 rows were reviewed. For each of the five nonempty article texts, opening, middle, later and ending passages were inspected for coherent topical prose; navigation, login, cookie, challenge, subscription and error-page markers were checked. No arbitrary word-count minimum was used. All five texts were judged readable: a reported account on Houthi activity (with an image-credit marker fused to its opening), a World News Day/media-landscape article, an industrial-energy policy article, a scientist career profile (with a stray page label), and a structured news brief. The other 95 rows had no article text and were not counted readable: 93 timed out and two ended in child errors. Per-row judgments, short rationales and article-text hashes (without article text) are in `outcomes-i3.json`.

**Classification and route:** **I3 Rejected under the approved boundary.** The completed run produced only **5/100 independently readable texts**, below the required **50/100**. The blocking condition is child lifecycle failure under the tested per-row deadline: 95 rows produced no article text, while only five completed publisher fetch and extraction. Parser quality is not shown to be the remaining limitation, so the TID's conditional B3 route is not eligible. Do not rerun the unchanged candidate or troubleshoot beyond the approved experiment. The Spike records the tested boundary and awaits owner routing; Issues #4 and #5 remain blocked.

## Read-only comparison: B2-R2 and B2-I3

Both hosted runs used the same frozen 100-row input (SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`). R2 wrote 98 outcomes, including 75 extraction-success candidates and five HTTP timeouts; those candidates were not independently readability-reviewed. I3 wrote 100 outcomes: five independently readable texts, 93 `child_timeout` rows and two `child_error` rows. Among the 75 rows called extraction-success in R2, I3 produced five readable texts, 69 timeouts and one child error. I3's first seven input positions were non-timeout outcomes; the remaining 93 positions timed out. These are outcome correspondences, not evidence that input position caused the failures. Sources: [`results-b2-r2.json`](experiments/b2-vanilla/results-b2-r2.json), [`outcomes-i3.json`](experiments/b2-process-isolation/evidence/outcomes-i3.json), and the I3 run metadata.

The bounded HTTP body-reader implementation is byte-identical between the two candidates (SHA-256 `40505DB4AFEBD8D5125F596864DC98807252A9E3923B3A70284DEA39EE10EE14`), including its 2 MiB bound, cancellation, and reader-release logic. Both used GET, `Accept: text/html,application/xhtml+xml`, manual redirects capped at five, a 10-second `AbortSignal` timeout, HTML content-type gating, Node `v20.20.2`, and Undici `6.24.1`. The observed differences are the user-agent string; concurrency (four in R2, two in I3); an I3 whole-child deadline of about 11.9 seconds in addition to the HTTP timeout; and extraction/error handling. R2 ran JSON-LD extraction before Readability and passed a `Buffer` into JSDOM; I3 used Readability only after converting the body to a UTF-8 string. R2 HTTP aborts were classified as timeouts; uncaught I3 fetch errors surfaced as `child_error`. Relevant code: vanilla [`main.mjs`](experiments/b2-vanilla/actor/main.mjs#L339) lines 339–471 and 537–555; I3 [`worker.mjs`](experiments/b2-process-isolation/actor/worker.mjs#L20) lines 20–149 and [`parent.mjs`](experiments/b2-process-isolation/actor/parent.mjs#L75) lines 75–198.

**Causal limit:** I3's timeout/error rows do not retain request counts, phase, or per-row timing, so the records cannot show whether a failing child reached fetch, body reading, or extraction. The 585-second run duration is consistent with many rows reaching their whole-child deadlines, but it does not establish why they did so. The unchanged body reader and shared HTTP settings provide no evidence of a body-reader regression; they also do not prove the reader was uninvolved in individual failures. No root cause, input schema/query/locale boundary, or general infeasibility conclusion is established. B2-I3 rejects this tested process-isolation boundary against the 50/100 readability target. Any different approach requires owner routing; no additional experiment is authorised by this comparison.

## Static code finding — cancellation logger omitted in worker

Static review found that process-isolation `worker.mjs` calls `cancelResponseBody(response)` without the required `logStage` argument in its redirect, non-2xx, and non-HTML branches (lines 43, 58, and 70). The shared helper calls `logStage(...)` unconditionally before it calls `response.body.cancel()` (`body-stream.mjs` lines 5–9). With the argument omitted, that call produces a rejected `TypeError` before body cancellation is attempted. The worker's outer catch sends a child error and exits with code 1 (`worker.mjs` lines 143–149). The neighboring `readBoundedBody` call supplies a no-op logger (`worker.mjs` line 74), so the mismatch is specific to those cancellation paths.

The earlier vanilla caller supplied `logStage`, phase, and trace to the same helper in all three branches (`experiments/b2-vanilla/actor/main.mjs` lines 407–410, 442–443, and 456–457). This is a verified static integration defect. If an I3 row encountered one of the affected response branches, it could account for a `child_error`; the hosted records do not include per-row phase/error detail to establish that any of the two child-error outcomes followed those branches. It does not directly explain the 93 `child_timeout` outcomes, which remain unlocalized. No root cause for the dominant timeouts is established, the I3 run result is unchanged, and this finding authorizes no code change, rerun, or diagnostic experiment.
