# Technical Spike: bounded news access and article retrieval for #4/#5

> Living investigation artifact for Issue #22. Historical experiment evidence remains retained under `docs/changes/22/experiments/` and in the original repository history. This artifact was re-baselined on 2026-09-30 after the Technical Spike lifecycle was corrected to require proportionate option discovery and candidate-viability checkpoints.

**Artifact ID:** `spike-22`  
**Status:** Open  
**Owner:** Project owner  
**Created / updated:** 2026-10-01
**GitHub Spike Issue:** #22  
**Blocked downstream Issue(s):** #4, #5  
**Spike branch / draft PR:** `spike/22-automated-news-site-access` / PR #23  
**Product Definition:** `docs/product.md`  
**Architecture Definition:** `docs/architecture.md`

## 1. Technical Question

Within the current HTTP-first POC constraints, what bounded access and article-content retrieval approach can the product rely on for the specific live boundaries currently blocking #4 and #5 — Google News acquisition/resolution and public publisher-page full-text retrieval — and what fail-soft or Product/Architecture decision points must downstream engineering use when those boundaries cannot be satisfied?

This is an owner-directed scope correction. The earlier framing was too broad and risked becoming a general study of web scraping, anti-bot systems, proxies and third-party providers.

## 2. Required Outcome and Constraints

### Required outcome

The Spike must establish enough evidence to let downstream engineering know:

- the bounded Google News access/session behaviour needed for #4, or the specific boundary decision required if it cannot be made reliable enough;
- the bounded publisher retrieval and generic article-content extraction approach that can support #5's representative >=50% readable-full-text target, or evidence that the target is not feasible within current constraints;
- the fail-soft status/failure classes needed when rows cannot be accessed or extracted;
- the material runtime, cost and operational constraints for those two flows.

### Constraints

- Keep the investigation tied to #4 and #5 rather than mapping the wider scraping/access market.
- #5 remains HTTP-first and currently excludes browser rendering, residential proxies, paid external extraction APIs, paywall bypass and publisher-specific heavy infrastructure.
- Do not silently change Product/Architecture constraints to make an experiment succeed.
- Respect robots/access signals, bounded rates, timeouts, concurrency, redirects and retained-data limits.
- No credentials, cookies, page bodies or account state may be committed.
- Before selecting a new technical method, perform a proportionate option scan.
- Repeated or surprising failures materially questioning a selected option trigger an option-viability checkpoint before deeper candidate-specific diagnostics.

## 3. Current Understanding

### Established facts

- #14 established the marker/RPC publisher-URL mechanism and was integrated through PR #21.
- #4 later failed a hosted acceptance run because Google consent/interstitial behaviour prevented the marker/RPC path from running; #4 is therefore blocked on the relevant access-layer conclusion from this Spike.
- A representative 100-row hosted publisher-page baseline retrieved HTTP 200 HTML for 72 rows; other rows included HTTP denials and robots-based skips.
- Extractus 9.0.1 was selected before the Spike lifecycle required a prior option scan.
- In the replacement hosted Extractus cohort, 78 rows were eligible and all 78 reached the five-second worker deadline without a scored output, including one small eligible input.
- Local synthetic lifecycle work showed that extraction cost can rise sharply with input size/shape, but it did not explain the hosted 78/78 timeout pattern.
- Iteration 9 phase-telemetry tooling passed its offline preflight, but no hosted Iteration 9 run occurred.
- The Iteration 9 harness exercises Extractus, a structural extraction proxy and retries; it cannot be reused unchanged to evaluate the newly selected direct Readability option.
- The owner approved one bounded Iteration 10 on 2026-10-01. The corrected offline preflight passed 37/37 checks; sanitized API diagnostics corrected the create payload, and a read-only exact-name Actor reconciliation found zero matches before and after the probe. The sole authorized hosted run passed `I10_GATE` but exited 1 after 2.508 seconds, with no dataset items or aggregate. Its logs do not identify a stage or exception and do not establish whether Google/publisher traffic occurred. A local Node 20 diagnostic in a network-disabled `apify/actor-node:20` image also exited silently before `Actor.init()`, but exact Dockerfile dependency installation could not be completed offline. The root cause and image/dependency parity remain unknown; Iteration 10 provides no Readability or publisher evidence.
- Iteration 11 (H12) first produced a local fixture result; review ref `4be5e578` held its broad guard-coverage claim because direct Undici, TLS, HTTP/2, WebSocket, child-process, native-addon and arbitrary Worker paths were omitted and the seven-file scan was lexical, not recursive. The corrected local candidate passed independent validation and received GO for its narrow exercised paths at PR head `4292b8ee955435a6b11d0abcb84a2c91ef0417f1`. In pinned `apify/actor-node` with Docker `--network none`, malformed input exits 2 before a Worker; two valid runs each start one guarded Readability Worker after input acceptance and reproduce 26 words / 186 characters for fixture SHA-256 `cb58978a9ba481956d382e4fc153a666767a718a2e05d0ce5f5b3172fe1b5614`; each persists one aggregate, matches five local SDK tuples and records no guard or tuple misses. Separate probes deny 15 parent and 42 Worker attempts with zero stub hits; syntax checks pass 14/14. The lexical screen remains limited. The digest pin is supplied by the caller and is not attested inside the container, although the reproduction command pins the image digest. Hosted tuple/runtime parity, the live publisher cohort and hosted authorization remain unresolved. See `experiments/11-fixture-startup/experiment.md` and `experiments/11-fixture-startup/evidence/local-result.json`.

### Unresolved questions

- Whether direct Readability can meet #5's representative target in the Apify runtime; Iteration 10 never reached a scored cohort.
- Why the reviewed Actor failed early in the sole approved hosted run before aggregate output (stage unknown); the local H12 success does not identify the hosted failure cause.
- Whether a read-only comparison of locked SDK behavior and official Apify runtime/build evidence can establish hosted tuple/runtime parity without an Actor run; otherwise that evidence boundary may require a separately approved hosted fixture run.
- Whether the corrected local evidence can be tied to the image digest independently of the caller-supplied environment variable; the reproducible command pins the image digest but the container itself does not attest it.
- Whether #4's Google consent/interstitial behaviour can be handled within ordinary public access/session mechanics and the current POC boundary.
- Which failure classes should cause row-level fail-soft behaviour versus an explicit Product/Architecture decision.

### Rejected / unsupported assumptions

- A plausible extraction package is not sufficient reason to make it the Spike's default path.
- The 0/100 Extractus proxy outcome is not evidence that article text itself was unreadable because no extraction output was scored.
- Local synthetic timing does not explain the hosted timeout pattern.
- The Spike does not need a general catalogue of proxy, anti-bot, browser or scraping-provider technologies.

## 4. Option Scan and Prioritisation

**Investigation depth / owner constraint:** Proportionate Spike-level search only. Do not turn Issue #22 into a broad research programme.

**Sources / evidence boundary:** official/upstream documentation, current repository evidence, package maintenance signals and limited community/upstream issue evidence sufficient to identify credible options.

### O1 — Direct Mozilla Readability with explicit guards

**Approach:** Apply Mozilla Readability directly to the already-fetched public HTML using an explicit Node DOM implementation and explicit runtime guards. Use structured `NewsArticle.articleBody`/JSON-LD as a cheap fast path where present.

**Why credible:** Mozilla Readability is the standalone algorithm used for Firefox Reader View. Its API exposes `isProbablyReaderable` and `maxElemsToParse`, which give direct control over whether and how expensive parsing proceeds. Schema.org defines `articleBody` for Article/NewsArticle.

**Known limitation:** requires a DOM implementation in Node; structured article body is not guaranteed across publishers.

**Status:** Selected, not yet evaluated against publisher HTML. Iteration 10 ended inconclusively before the cohort; do not infer candidate failure or success.

Sources:

- https://github.com/mozilla/readability
- https://schema.org/NewsArticle
- https://schema.org/articleBody

### O2 — Extractus 9.0.1

**Approach:** Higher-level article-extraction wrapper on already-fetched HTML.

**Why credible:** actively published and already extensively exercised by this Spike.

**Known limitation:** 78/78 eligible hosted calls timed out without output in the replacement cohort; local synthetic work did not explain that target-runtime pattern.

**Status:** Deprioritised after option-viability checkpoint.

Sources:

- https://www.npmjs.com/package/@extractus/article-extractor
- https://github.com/extractus/article-extractor

### O3 — Trafilatura

**Approach:** Mature generic main-text/article extractor.

**Why credible:** current purpose-built extraction project with documented fallback extraction behaviour.

**Known limitation:** Python/CLI runtime introduces deployment/runtime complexity into the current Node POC.

**Status:** Reserve. Evaluate only if the Node-native option is insufficient.

Source:

- https://trafilatura.readthedocs.io/

### O4 — Postlight Parser / Mercury-style parser

**Approach:** Generic article parser with optional site-specific extractors.

**Why credible:** established article parsing approach.

**Known limitation:** public release/maintenance evidence is materially older than O1/O3, and custom parsers move toward publisher-specific maintenance excluded by the current POC.

**Status:** Deprioritised without experiment.

Source:

- https://github.com/postlight/parser

### Prioritisation

O1 remains the selected extraction candidate because it removes the higher-level wrapper while staying within the HTTP-first POC boundary. Iteration 11 supports the fixture path in a pinned local runtime, but does not explain Iteration 10's hosted failure or establish the hosted SDK tuple set. Independent review is now the next gate. O3 is retained as a later alternative if O1 proves insufficient; O4 does not currently justify experiment cost.

This option set is intentionally small and bounded to the current blocker.

## 5. Investigation Backlog

### H10 — O1 target-runtime viability

**Hypothesis:** Direct Mozilla Readability with explicit runtime guards, using structured article-body data as a fast path where available, can process a useful share of already-fetched public publisher HTML in the Apify runtime without reproducing the unexplained Extractus timeout pattern.

**Why test it:** It is the highest-priority credible option after the lifecycle re-baseline and directly tests whether the problem is specific to the current wrapper/path rather than the environment or HTML itself.

**Evidence that would support it:** on a complete fresh cohort of 100 unique candidates, at least 50 produce qualifying candidate text within the approved bounds, with the 100-slot denominator and permitted-2xx denominator reported separately. A cohort shortfall is non-decisive for extraction viability. This is an early viability signal only: it does not close the Spike or establish #5's quality criterion.

**Evidence that would refute it:** the same broad timeout pattern occurs despite explicit guards, or readable output remains too low to plausibly support #5's >=50% representative target.

**Status:** Inconclusive. The sole authorized hosted Actor run passed `I10_GATE` but exited 1 in 2.508 seconds with zero dataset items; no aggregate or cohort result was produced. Logs provide no stage, exception or proof of whether Google/publisher traffic occurred. A network-disabled local Node 20 container diagnostic also exited silently before `Actor.init()`, but Dockerfile dependency-install parity was not established. Cause is unknown. The prior 37/37 offline preflight remains valid only for the checks it exercised; it did not predict or locate this early run failure. No unchanged rerun is authorized.

### H11 — #4 consent/session handling

**Hypothesis:** The Google consent/interstitial blocker relevant to #4 can be handled using ordinary public request/session/consent mechanics within the current HTTP-first boundary.

**Status:** Proposed after the current publisher-content branch reaches its next checkpoint, unless #4 is explicitly prioritised first by the owner.

### H12 - fixture-only full-entrypoint startup diagnosis for O1

This is the hypothesis ID for Iteration 11. Existing H11 is the separate #4 Google consent/session hypothesis; no iteration is skipped.

**Hypothesis:** A fixture-only entrypoint can reach the known guarded Readability Worker after exact fixture input and local gate checks in the pinned, network-disabled container. Evidence is limited to this exercised path and the enumerated guard counters; it cannot establish general API coverage or zero wire-level egress.

**Why this is next:** The approved I10 run failed early before producing a cohort aggregate; its failing stage is unknown. A live cohort would not locate the failure. A fixture-only entrypoint isolates startup and parser behavior, while the guard/preflight can expose calls through the enumerated application APIs.

**Correction scope and result:** The exact fixture input remains `{"mode":"fixture-only","fixtureId":"readability-positive-v1"}`. The normal fixture flow proceeds through input acceptance to one known guarded Readability Worker. API negative probes run in a separate harness and do not prove that all request paths are covered. The container's external networking is disabled. Independent re-review at PR head `4292b8ee955435a6b11d0abcb84a2c91ef0417f1` is GO for these narrow exercised paths only; it does not approve broad guard coverage or hosted execution.

The pre-fix run observed five local SDK tuples in a fixed manifest and separate SDK/application counters. The correction should retain those local checks, with the parent guard before SDK/application imports and a deny-all guard on the known Readability Worker. The negative-probe harness remains separate. Review found that the published candidate omits direct Undici, TLS, HTTP/2, WebSocket, child-process, native-addon and arbitrary Worker paths; do not claim these paths are guarded or unreachable. Report zero calls only for the enumerated guard counters on the normal fixture path, under the local network-disabled runner.

The reported seven-file check is a lexical scan of a fixed source list, not a recursive import-graph analysis. It is not proof that other paths are absent or unreachable. The corrected local check should verify the exact fixture input/gate, the known guarded Readability Worker, aggregate persistence, and zero calls through the enumerated guard counters during the normal fixture path, with Docker external networking disabled. It must label direct Undici, TLS, HTTP/2, WebSocket, child-process, native-addon and arbitrary Worker paths as unverified. Pin the immutable Node 20/Apify image; report inability to pin or mismatch and stop.

**Option B boundary:** the five captured tuples describe only the local SDK stub interactions and do not establish hosted tuples. Hosted tuple parity is unresolved. Fixed aggregate output may report the local stage/result and enumerated guard counters only; it must not imply broad network-path coverage. Raw fixture text, URLs, exception text, secrets and row identifiers remain prohibited.

**Evidence limit:** Docker `--network none` disabled external networking for the local runs. They establish only the recorded observations through enumerated JavaScript guard counters; the lexical source-list check does not prove recursive import coverage. The container's image digest environment variable is caller-supplied and is not attested from inside the container, though the reproduction command pins the image digest. Absolute zero wire-level egress, hosted tuple parity and hosted startup are not established. Independent review is GO for local exercised paths only; keep hosted on Hold.

**Bounds and stops:** One bundled synthetic fixture; no user HTML or Google/publisher requests. The owner approved local implementation/preflight only. Corrected local validation and independent code re-review passed for the narrow exercised paths. No hosted execution is authorized; the hosted gate remains Hold. Do not claim coverage for unguarded paths or recursive import closure. Any later hosted proposal would require a separate, contextual owner checkpoint and is outside the present authorization.

**Status:** GO for the corrected local exercised-path claim at PR head `4292b8ee955435a6b11d0abcb84a2c91ef0417f1`. Broad Option B API coverage remains unsupported. Hosted tuple/runtime parity, startup and the publisher cohort remain unresolved; the hosted gate is HOLD and no hosted execution is authorized.

**Ranked immediate options:** (1) run a bounded, read-only hosted-boundary feasibility audit using the locked SDK source and official Apify runtime/build documentation to determine whether exact hosted tuples and runtime identity can be established without starting an Actor; (2) if the audit cannot establish that evidence, document the no-run route as infeasible and return with a contextual proposal for a separately authorized, single private fixture run; (3) if a hosted run is not authorized or the required controls cannot be proved, keep hosted work on Hold. The accepted local claim remains limited to exercised paths; an unchanged I10 rerun and live publisher cohort remain out of scope.

## 6. Current Iteration

**Iteration:** 11 (H12) corrected local candidate has Validator PASS and Reviewer GO for exercised local paths. Hosted runtime parity and publisher cohort remain unresolved, and hosted execution is on Hold.
**Selected extraction option:** O1 (direct Mozilla Readability with explicit guards)
**Hypothesis:** Local fixture startup and extraction are repeatable through the known guarded Readability Worker after exact input acceptance. This does not support broad API coverage, hosted startup or publisher readability. H10 was not tested against a publisher cohort.

### Iteration 10 outcome

The corrected offline preflight passed 37/37 checks under Node 20.19.0. One private hosted Actor run passed the `I10_GATE` but exited 1 after 2.508 seconds. It used Actor `Gng0hd54CzA43fLym`, build `AItbGMOLryzBEx22B` / `10.0.1`, source manifest `ce7a892574c378793531d84960c109ded031677f68cbb6d7f50df8067bda8841`, from reviewed commit `9c62b0c`. Peak memory was 12,562,432 bytes and cost was $0.0000849056. The dataset is empty; no aggregate was flushed. Logs contain no stage, exception or stack trace and do not prove whether Google or publisher traffic occurred. A network-disabled local Node 20 container diagnostic also exited silently before `Actor.init()`; the Dockerfile `npm ci` could not complete offline, so dependency/image parity is unknown. The cause is indeterminate. See `experiments/10-direct-readability/hosted-run-evidence.json` and `experiments/10-direct-readability/experiment.md`.

### Iteration 11 (H12) local result and recommended next action

The pre-fix result remains historical: review ref `4be5e578` found omitted API paths and that the seven-file screen is lexical, not recursive. The corrected candidate narrows the claim to the known guarded Readability Worker on the valid fixture path with Docker `--network none`; its negative-probe harness is separate. Hosted tuple parity remains unresolved.

**Pre-fix observation:** The pinned local run completed SDK initialization, accepted the valid fixture input, extracted the bundled synthetic fixture with Readability (26 words / 186 characters), and persisted one aggregate. Five frozen local SDK tuples matched. The normal fixture flow recorded zero calls through enumerated guard counters. The separate negative-probe harness denied 15 parent and 42 worker probes. The seven-file lexical scan passed, but it is not recursive graph proof. Invalid-input predicates were exercised, but a malformed-input full Actor flow was not rerun. Independent validation of this pre-fix candidate passed its local checks; independent review subsequently put the published candidate on Hold because broad guard coverage was incomplete. Exact evidence is in `experiments/11-fixture-startup/experiment.md` and `experiments/11-fixture-startup/evidence/local-result.json`.

**Corrected local result:** Validator PASS; Reviewer GO at PR head `4292b8ee955435a6b11d0abcb84a2c91ef0417f1` for the narrow local paths. A malformed full Actor input exited 2 as `input_rejected` before any Worker started. Two valid runs each started exactly one guarded Readability Worker after input acceptance; both returned 26 words / 186 characters for fixture SHA-256 `cb58978a9ba481956d382e4fc153a666767a718a2e05d0ce5f5b3172fe1b5614`, persisted one aggregate, matched all five local tuples, and reported zero guard/tuple misses. Separate negative probes denied all 15 parent and 42 Worker attempts with zero stub hits. Syntax checks passed 14/14. The seven-file lexical screen remains limited and is not transitive or complete API-coverage proof. The image digest is supplied by a caller-controlled environment variable and is not attested inside the container; the reproduction command pins the digest. Hosted tuple/runtime parity and startup remain unresolved, and the hosted gate remains HOLD. Evidence: `experiments/11-fixture-startup/experiment.md` and `experiments/11-fixture-startup/evidence/local-result.json`.

**Interpretation:** The corrected result supports only repeatable local fixture startup/extraction through the known guarded Worker with external networking disabled. It does not establish coverage of omitted APIs, identify I10's hosted failure cause, prove hosted startup or hosted tuple parity, or measure live publisher readability. The 100-result target remains untested.

**Recommended next action — proposed Iteration 12 (H13):** conduct a no-run feasibility audit of the hosted boundary: compare the five local tuple observations with the locked SDK source and official Apify documentation for runtime/build identity and request observability. Retain only sanitized method/path/phase facts and document whether hosted tuple/runtime parity can be established without an Actor run. Cost ceiling is $0; no service mutation, token, Google/publisher request, payload or page content is in scope. If this cannot establish parity, report that no-run evidence is insufficient and prepare a separate contextual owner decision for at most one private fixture run. No hosted run is authorized now.

**Option B local/hosted boundary:** local SDK calls are captured against the in-container loopback stub and frozen as explicit origin/method/normalized-path/phase tuples, then checked by the parent guard before SDK/application imports. No exact hosted tuples are inferred from this local capture; the hosted set remains unresolved pending supported exact-build evidence. The intent is limited to Actor init/input, I10_GATE readback and one aggregate-storage operation at the Apify API destination, without a broad host exception, wildcard, redirect or unlisted operation.

**Prerequisite/blocker status:** Local exercised-path validation and independent review are complete. The remaining material blocker is hosted tuple/runtime parity, which blocks a hosted startup claim and any advancement toward the live publisher cohort. Recovery: perform the no-run read-only SDK/documentation feasibility audit; if it cannot establish parity, present a separate bounded hosted-run proposal for owner decision. The lexical screen remains limited, and the caller-supplied digest is not container-attested. No hosted execution is currently authorized.

**Hosted bounds and stops:** A separately authorized run may be at most one private `LIMITED_PERMISSIONS` fixture run, 256 MiB, 180 seconds, $0.10, restart/retry disabled. Use fixed stage/error/resource values, per-API counters/status, worker/child coverage markers and SDK operation counters only. Any guarded API attempt, missing marker/counter, uncovered path, unclassified failure, timeout or missing aggregate stops/fails the run. This does not test publisher access or unblock #4/#5.

**Owner decision recorded (2026-10-01):** **Approved:** implement H12 Option B and run its network-denied local preflight using the exact fixture input `{"mode":"fixture-only","fixtureId":"readability-positive-v1"}` and the enumerated API guard/import-graph approach. The owner was told this reuses Readability on one bundled synthetic article to diagnose hosted startup, and does not test live Google or publisher access. Approval does not authorize any hosted run. After independent validation of the image, SDK destination/operation tuples, guard activation/counters, worker/child coverage, exclusions, negative tests and aggregate path, present the evidence for separate explicit owner authorization of at most one hosted run. Option A remains available separately; if neither A nor B is supported, keep H12 offline-only and the Spike on Hold.

**H13 scope and evidence controls:** use only the locked SDK source and official Apify runtime/build documentation or already available read-only metadata. Make no Actor create, build or run call; use no Apify token; make no Google/publisher request. Retain a sanitized map of the five observed local tuple labels to documented SDK operation and source reference, plus a conclusion on whether runtime/image identity and hosted tuple parity are provable without execution. Cost ceiling is $0. If evidence is unavailable, record the no-run route as infeasible; do not infer parity from the local stub. The digest passed in `H12_IMAGE_DIGEST` is caller-supplied and is not container-attested; note that the reproduction command pins the image digest.

**Owner decision requested now:** none. H13 is a read-only evidence step within the continuing Spike and grants no hosted authority. If H13 cannot establish parity, return with an explicit contextual choice: authorize at most one private fixture-only hosted run within the previously stated 256 MiB / 180-second / $0.10 bounds, or keep the hosted gate on Hold. No hosted run is authorized now.

**Consequence of H13:** if supported docs/SDK evidence establishes parity and identity without a run, record that narrow evidence and reassess the hosted gate; if not, the exact hosted boundary remains unknown and only a separately authorized fixture run could test it. Either result leaves the live 100-result publisher target unresolved.

**Learning checkpoint:** An early hosted run failure with no stage evidence plus mocked/offline preflight was insufficient to localize the runtime failure. A portable cross-project learning is recorded in `docs/learnings/issue-22-hosted-startup-diagnostics.md`.

## 7. Experiment Log

The detailed experiment artifacts are preserved in their original directories. This log retains each iteration's material conclusion without reproducing all raw evidence.

### Iteration 1 — local direct-HTTP baseline

**Option:** bounded direct HTTP  
**Environment/data:** 30 rows across 10 query/locale cells, 21 publisher hosts  
**Evidence:** `local-results.json` and top-level probe files  
**Result:** Inconclusive  
**Learning:** 19/30 returned HTTP 200 HTML; denials and robots skips were material. This established mixed publisher access but not readable article text.

### Iteration 2 — hosted direct-HTTP baseline

**Option:** bounded direct HTTP  
**Environment/data:** fresh hosted 100-row cohort, 73 publisher hosts  
**Evidence:** `experiments/02-hosted-direct-http/`  
**Result:** Supported for target-runtime baseline; Spike remained open  
**Learning:** 72/100 returned HTTP 200 HTML, 13/100 HTTP 403, 10/100 robots unavailable/skipped and 5/100 robots disallowed/skipped. Access and article-readability remained separate questions.

### Iteration 3 — local Extractus candidate evaluation

**Option:** O2 Extractus 9.0.1  
**Environment/data:** six authored fixtures  
**Evidence:** `experiments/03-local-readability/`  
**Result:** Supported as a candidate for further evaluation only  
**Learning:** the candidate handled the positive fixtures and avoided the negative fixtures, but this small synthetic test did not establish that O2 was the best available approach.

### Iteration 4 — hosted Extractus proxy

**Option:** O2 Extractus 9.0.1  
**Evidence:** `experiments/04-hosted-readability/`  
**Result:** Inconclusive  
**Learning:** all 44 eligible hosted rows reached the five-second worker timeout; no extraction output was scored.

### Iteration 5 — local size scaling

**Option:** O2 Extractus 9.0.1  
**Evidence:** `experiments/05-local-size-scaling/`  
**Result:** Inconclusive  
**Learning:** extraction cost increased strongly with input size on synthetic cases, but this did not explain the hosted pattern.

### Iteration 6 — local complexity controls

**Option:** O2 Extractus 9.0.1  
**Evidence:** `experiments/06-local-complexity/`  
**Result:** Inconclusive  
**Learning:** markup/content shape affected synthetic cost, but no universal safe cap or hosted explanation was established.

### Iteration 7 — hosted eligibility replacement cohort

**Option:** O2 Extractus 9.0.1  
**Environment/data:** fresh 100-row hosted cohort  
**Evidence:** `experiments/07-hosted-eligibility/`  
**Result:** Inconclusive  
**Learning:** 78 rows were eligible and all 78 extraction calls reached the five-second worker deadline, including one eligible prefix below 16 KiB. The proxy result could not be interpreted as extraction-quality failure because no output was scored.

### Iteration 8 — local worker lifecycle timing

**Option:** O2 Extractus 9.0.1  
**Evidence:** `experiments/08-local-worker-lifecycle/`  
**Result:** Inconclusive  
**Learning:** larger synthetic inputs were dominated by extraction time; startup/import/result/exit were smaller on completed local cases. The result still did not explain the hosted 78/78 timeout pattern.

### Iteration 9 — hosted phase telemetry preparation

**Option:** O2 Extractus 9.0.1  
**Evidence:** `experiments/09-hosted-phase-telemetry/`  
**Result:** Offline preparation supported; hosted experiment not executed  
**Learning:** the 27-check offline preflight validated phase/event/sink behaviour and privacy bounds. It did not identify the hosted timeout stage.

**Option viability:** Deprioritise O2. A bounded upstream/community check did not establish a known universal Extractus timeout defect, so O2 is not declared generally broken. For this Spike, however, repeated unexplained hosted failure means another Extractus-specific telemetry run is lower information value than returning to the option set and evaluating O1.

**Current recommendation:** do not run hosted Iteration 9 telemetry before H10.

### Iteration 10 — direct Mozilla Readability startup attempt

**Option:** O1 direct Mozilla Readability with explicit guards
**Environment/data:** corrected 37-check offline preflight; one approved private Apify Actor run; separate Node 20 network-disabled container diagnostic
**Evidence:** `experiments/10-direct-readability/experiment.md` and `experiments/10-direct-readability/hosted-run-evidence.json`
**Result:** Inconclusive. The hosted run passed `I10_GATE` but exited 1 in 2.508 seconds, produced no dataset item/aggregate, and logged no stage or exception. The local diagnostic also exited before `Actor.init()`, but exact dependency/image parity was not established. No evidence of Readability success/failure, publisher readability or Google/publisher request activity is available.
**Learning:** Offline/mocked preflight did not localize the early target-runtime failure; hosted logs did not establish the failing stage. Test the full entrypoint in a representative runtime with fixture-only input, network isolation and explicit safe startup/error stages before another hosted experiment; see `docs/learnings/issue-22-hosted-startup-diagnostics.md`.

**Bounded known-issue search (2026-10-01):** Checked the [official Apify run documentation](https://docs.apify.com/actors/development/builds-and-runs/runs), the [Apify JavaScript SDK issue tracker](https://github.com/apify/apify-sdk-js/issues), and the [Apify Actor Docker issue tracker](https://github.com/apify/apify-actor-docker/issues). This search found no confirmed report matching a hosted Node Actor exiting 1 after about 2.5 seconds with a short, uninformative log. It is a bounded public-source check, not proof that no known issue exists and not a root-cause diagnosis; it does not justify retrying an unchanged candidate. The separate Extractus timeout check documented above concerns a different symptom and is not evidence about this startup failure.

### Iteration 11 — H12 local fixture startup diagnostic

**Option:** O1 direct Mozilla Readability, fixture-only path

**Environment/data:** pinned `apify/actor-node` image `sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`, Docker `--network none`, one bundled synthetic fixture

**Evidence:** `experiments/11-fixture-startup/experiment.md` and `experiments/11-fixture-startup/evidence/local-result.json`

**Pre-fix result:** The first fixture run extracted 26 words / 186 characters and persisted one aggregate under Docker `--network none`; review ref `4be5e578` found omitted network paths and that the seven-file screen is lexical, not recursive, so the broad claim was put on Hold.
**Corrected result:** Validator PASS. Malformed input was rejected before a Worker started; two valid runs each started one guarded Worker after input acceptance, produced the same 26-word / 186-character result for the fixed fixture SHA-256 `cb58978a9ba481956d382e4fc153a666767a718a2e05d0ce5f5b3172fe1b5614`, persisted one aggregate, matched five local tuples and had no enumerated guard or tuple misses. Separate negative probes denied 15 parent and 42 Worker attempts with zero stub hits. Syntax checks passed 14/14. The fixed-source lexical scan remains limited. Full details: `experiments/11-fixture-startup/experiment.md` and `experiments/11-fixture-startup/evidence/local-result.json`.
**Next action:** perform H13's read-only no-run feasibility audit, recording sanitized sources and tuple metadata only. If parity cannot be established, present the owner with a separate, contextual hosted-run choice; no hosted execution is currently authorized.

## 8. Supported Technical Specification

### Supported behaviour

- Direct bounded HTTP can retrieve public publisher HTML for a material subset of the representative hosted sample.
- Publisher denials and robots-unavailable/disallowed conditions must remain isolated row-level outcomes rather than failing the whole Actor.
- Access success, article-like markers and readable article extraction are separate claims and must have separate statuses/evidence.
- The existing Extractus hosted evidence cannot be treated as a readable-text success/failure measurement because no extraction output was scored.
- Any accepted article-extraction approach must be proven in the target runtime against representative live publisher pages before #5 can proceed.

### Required sequence / mechanism

1. Apply the approved Google News access/resolution handling relevant to #4.
2. For #5, attempt publisher retrieval only for usable resolved publisher URLs.
3. Enforce existing network/robots/request/privacy bounds.
4. Distinguish access failure from extraction failure.
5. Apply the approved generic extraction method only to permitted successful HTML responses.
6. Record row-level status and keep unrelated rows running.

### Failure modes and handling constraints

- consent/interstitial before Google News resolution;
- robots unavailable/disallowed;
- HTTP denial or non-HTML response;
- extraction guard rejection;
- extraction timeout/error;
- no usable readable text;
- explicit out-of-bound technique required.

### Environment / variability

Current evidence is specific to the sampled publishers, Apify Node 20 runtime and recorded execution windows. It does not establish population-wide rates.

## 9. Remaining Uncertainty

- O1 target-runtime success rate and cost remain unmeasured.
- #5's >=50% readable-full-text criterion remains unproven.
- #4's Google consent/interstitial handling remains unresolved.
- The exact fail-soft taxonomy will be finalised from the supported O1/#4 evidence.
- Whether any current Product/Architecture constraint must change remains unknown.

## 10. Final Conclusion

**Result:** Pending

The Spike is not ready to close. Existing evidence supports bounded HTTP access and identifies material failure classes, but neither #4's consent/access blocker nor #5's representative readable-full-text target has a supported final approach yet.

## 11. Downstream Implications

- Keep #4 on hold. Do not rerun its unchanged failed hosted acceptance candidate until the relevant #22 access-layer conclusion is integrated and #4 is reassessed.
- Keep #5 on hold. Do not begin HLD/implementation planning until this Spike establishes the permitted publisher retrieval/extraction approach or a required Product/Architecture decision.
- Do not promote browser execution, residential proxies, paid extraction APIs, paywall bypass or publisher-specific heavy infrastructure into the POC without an explicit boundary decision.

## 12. Reproducibility

Historical evidence is retained under:

- `docs/changes/22/local-results.json`
- `docs/changes/22/probe*.mjs`
- `docs/changes/22/experiments/02-hosted-direct-http/`
- `docs/changes/22/experiments/03-local-readability/`
- `docs/changes/22/experiments/04-hosted-readability/`
- `docs/changes/22/experiments/05-local-size-scaling/`
- `docs/changes/22/experiments/06-local-complexity/`
- `docs/changes/22/experiments/07-hosted-eligibility/`
- `docs/changes/22/experiments/08-local-worker-lifecycle/`
- `docs/changes/22/experiments/09-hosted-phase-telemetry/`
- `docs/changes/22/experiments/10-direct-readability/`

Experiment artifacts are excluded from automatic Prettier rewriting so their retained byte-level evidence and recorded hashes are not changed merely to satisfy repository formatting.

## Completion

**Spike state:** Open  
**Rationale:** the bounded #4/#5 technical question remains unresolved.  
**Required next action:** perform H13, the $0 read-only feasibility audit of locked SDK tuples and official Apify runtime/build evidence. The corrected H12 local result has Validator PASS and Reviewer GO for exercised paths only. Hosted tuple/runtime parity remains unproven; no hosted run is authorized. If H13 cannot resolve that evidence gap, return with a separate contextual owner decision before any hosted run. Keep #4/#5 on hold and do not repeat the live publisher cohort.
