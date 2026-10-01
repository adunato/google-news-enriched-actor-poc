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
- Iteration 11 (H12) ran the approved fixture-only path in pinned `apify/actor-node` image `sha256:c475bc63…` with Docker `--network none`; independent validation passed. The valid fixture reached the same bounded Readability worker, which returned success with 26 words, and one aggregate write was verified. All five frozen local SDK tuples matched with no misses; the parent guard denied 15 negative probes and the worker guard denied 42, with no application request reaching the loopback stub during probes. The seven-module import-graph check passed. Invalid-input guard predicates were checked, but a malformed-input full Actor flow was not rerun. See `experiments/11-fixture-startup/experiment.md` and `evidence/local-result.json`. This supports only the tested local fixture path; hosted tuple parity, hosted startup and the live 100-result publisher target remain unresolved. Independent code review on PR #23 is pending.

### Unresolved questions

- Whether direct Readability can meet #5's representative target in the Apify runtime; Iteration 10 never reached a scored cohort.
- Why the reviewed Actor failed early in the sole approved hosted run before aggregate output (stage unknown); the local H12 success does not identify the hosted failure cause.
- Whether the pinned local SDK tuple set and guarded fixture startup behavior match the hosted Apify runtime; local loopback evidence cannot establish hosted tuple parity.
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

**Hypothesis:** A diagnostic-only fixture entrypoint whose built import graph excludes all live Google/publisher probes, resolvers and application network modules can establish whether the reviewed runtime initializes and direct Readability processes one synthetic fixture through the bounded worker. Evidence is limited to the enumerated guarded JavaScript APIs; it cannot prove zero wire-level egress.

**Why this is next:** The approved I10 run failed early before producing a cohort aggregate; its failing stage is unknown. A live cohort would not locate the failure. A fixture-only entrypoint isolates startup and parser behavior, while the guard/preflight can expose calls through the enumerated application APIs.

**Experiment:** Create a diagnostic-only fixture entrypoint with no static or dynamic imports of live Google/publisher probes, resolvers or application network modules. Accept exactly `{"mode":"fixture-only","fixtureId":"readability-positive-v1"}`; reject every unknown key/value, extra field or live/mixed input before worker/network-path setup. Bundle one synthetic HTML fixture and pass it once through the bounded Readability worker. Apify SDK control-plane access is limited to Actor init/input, I10_GATE readback and one aggregate write, with the exact destination/operation tuples determined from the locked SDK and independently reviewed before any hosted run.

Initialize the parent-process guard preload before importing either the Apify SDK or fixture application. The guard must match a frozen, explicit manifest whose entries bind origin, HTTP method, normalized path and phase; derive candidate entries from SDK calls routed only to an in-container loopback stub, then freeze and review the manifest before replaying the check. The local harness uses a deterministic store ID, disables the SDK event WebSocket, and has external networking disabled. Track matched control-plane stub operations and denied application-network attempts in separate counters; no broad origin exception is permitted. Each child/worker receives a deny-all preload and an initialized marker; it receives no SDK control-plane allowance. If any child/worker cannot receive and report the deny-all guard, forbid it or fail closed. Negative fixtures intentionally invoke each guarded API in every supported context, including top-level imports; assert the matching denied counter increments and the loopback stub receives no application request.

The coverage claim excludes unguarded `http2`, WebSocket APIs, native addons/transports and any other request path. The built import graph must establish these paths are absent and unreachable; otherwise add and test guards or fail closed before hosting. Before hosting, inspect the built graph, run in a network-denied local container, verify ordered stage markers, one fixture extraction, local aggregate persistence, malformed-input rejection before worker/network-path setup, per-API counters/markers in every context, and zero calls through the enumerated application APIs. Pin the immutable Node 20/Apify image identity; report inability to pin or any mismatch and stop.

**Option B SDK boundary:** local candidate tuples are captured against the loopback stub and frozen as explicit origin/method/normalized-path/phase entries. These local tuples do not establish exact hosted tuples, which remain unresolved pending supported exact-build evidence. Hosted intent is limited to Actor init/input, I10_GATE readback and one aggregate-storage operation at the Apify API destination. No host-wide bypass, wildcard, redirect or unlisted method/path is allowed; any unmatched operation fails closed. Aggregate output is fixed stage/error/resource values, separate matched-SDK and denied-application counters, worker/child coverage markers and SDK operation counters only; raw content, URLs, exception text, secrets and row identifiers are prohibited.

**Egress evidence options:** The documented Apify setup has no child firewall or destination-level egress audit; Apify SDK control-plane traffic is needed. Option A is a separately selected, supported sandbox/destination audit that blocks Google/publisher while allowing only exact SDK operations. Recommended Option B is explicit owner acceptance that local evidence proves zero calls through enumerated guarded APIs plus the reviewed fixture-only import graph and frozen local SDK tuple manifest; it does not prove zero wire-level egress or establish the hosted tuple set. If neither option is selected and supported, remain offline-only and keep the Spike on Hold.

**Bounds and stops:** One bundled synthetic fixture; no user HTML or Google/publisher requests. The owner approved Option B implementation and local preflight only. The local check routes SDK operations to an in-container loopback stub with external networking disabled; it does not establish the hosted tuple set, and no hosted execution is authorized by this checkpoint. Any denied application attempt, missing/mismatched marker or counter, uncovered import/worker path, malformed input not rejected, unmatched local stub tuple, missing aggregate, unclassified failure, timeout, privacy leak, cap breach or image mismatch stops the local work. A hosted run may be proposed only after independent validation of all local gates and resolution/review of the exact hosted tuple set, and requires separate explicit owner authorization. If authorized later, it tests fixture/startup viability only; it does not test publisher access or unblock #4/#5.

**Status:** Iteration 11 local fixture experiment completed and independently validated for its local scope. Independent code review on PR #23 is pending. Hosted tuple set remains unresolved; no hosted execution is authorized.

**Ranked immediate options:** (1) complete the pending independent code review of the H12 implementation on PR #23 and address any findings; (2) after review, establish whether supported evidence can determine the exact hosted SDK tuple set; (3) if hosted parity cannot be established, remain offline-only and keep the Spike on Hold; unchanged I10 rerun and live publisher cohort before the hosted boundary is resolved are rejected.

## 6. Current Iteration

**Iteration:** 11 (H12) completed with a supported local fixture-path result; hosted runtime parity and publisher cohort remain unresolved.
**Selected extraction option:** O1 (direct Mozilla Readability with explicit guards)
**Hypothesis:** H12 is supported for the tested local fixture path only. H10 was not tested against a publisher cohort; no conclusion about live extraction viability is supported.

### Iteration 10 outcome

The corrected offline preflight passed 37/37 checks under Node 20.19.0. One private hosted Actor run passed the `I10_GATE` but exited 1 after 2.508 seconds. It used Actor `Gng0hd54CzA43fLym`, build `AItbGMOLryzBEx22B` / `10.0.1`, source manifest `ce7a892574c378793531d84960c109ded031677f68cbb6d7f50df8067bda8841`, from reviewed commit `9c62b0c`. Peak memory was 12,562,432 bytes and cost was $0.0000849056. The dataset is empty; no aggregate was flushed. Logs contain no stage, exception or stack trace and do not prove whether Google or publisher traffic occurred. A network-disabled local Node 20 container diagnostic also exited silently before `Actor.init()`; the Dockerfile `npm ci` could not complete offline, so dependency/image parity is unknown. The cause is indeterminate. See `experiments/10-direct-readability/hosted-run-evidence.json` and `experiments/10-direct-readability/experiment.md`.

### Iteration 11 (H12) local result and recommended next action

The completed local experiment used the exact input `{"mode":"fixture-only","fixtureId":"readability-positive-v1"}`. It excluded live Google/publisher probes and application networking from the fixture import graph; initialized the parent guard before SDK/application imports; routed SDK calls to a loopback stub; froze five origin/method/normalized-path/phase tuples; and kept matched-SDK and denied-application counters separate. It used a deterministic store ID, disabled the SDK event WebSocket, and ran with external networking disabled. The worker received a deny-all guard and marker. The seven-module import-graph check passed. The loopback stub establishes local tuples only; the exact hosted tuple set remains unresolved.

**Result:** The pinned local run completed SDK initialization, accepted the valid fixture input, extracted the bundled synthetic fixture with Readability (26 words), and persisted one verified aggregate. All five frozen loopback SDK tuples matched with no misses. The parent denied 15 negative probes and the worker denied 42; no application request reached the stub during the negative probes. The seven-module import graph passed. The invalid-input guard predicates were exercised, but a malformed-input full Actor flow was not rerun. Independent validation passed. Exact evidence is in `experiments/11-fixture-startup/experiment.md` and `experiments/11-fixture-startup/evidence/local-result.json`.

**Why this was useful:** I10 failed before producing a cohort aggregate, with no stage evidence. H12 shows that this fixture path starts and completes in the pinned local container without external networking. It does not identify I10's hosted failure cause, prove hosted startup or hosted tuple parity, or measure live publisher readability. The 100-result target remains untested.

**Recommended next action:** complete independent code review of the H12 implementation on PR #23 and address any findings. After review, determine whether supported exact-build evidence can establish the hosted SDK tuple set; local loopback observations are insufficient. If that boundary can be supported, prepare a separate, contextual owner checkpoint for a bounded hosted fixture run. If not, keep the investigation offline-only and the Spike on Hold.

**Option B local/hosted boundary:** local SDK calls are captured against the in-container loopback stub and frozen as explicit origin/method/normalized-path/phase tuples, then checked by the parent guard before SDK/application imports. No exact hosted tuples are inferred from this local capture; the hosted set remains unresolved pending supported exact-build evidence. The intent is limited to Actor init/input, I10_GATE readback and one aggregate-storage operation at the Apify API destination, without a broad host exception, wildcard, redirect or unlisted operation.

**Prerequisite/blocker status:** Local execution and independent validation are complete; independent code review is pending on PR #23. The local result cannot establish hosted tuple parity. Review findings should be addressed in the implementation and revalidated. No hosted execution is within the current approval. Only after review and supported resolution of hosted tuple parity may a bounded hosted proposal be presented for separate explicit owner authorization. If parity cannot be established, remain offline-only and Hold.

**Hosted bounds and stops:** A separately authorized run may be at most one private `LIMITED_PERMISSIONS` fixture run, 256 MiB, 180 seconds, $0.10, restart/retry disabled. Use fixed stage/error/resource values, per-API counters/status, worker/child coverage markers and SDK operation counters only. Any guarded API attempt, missing marker/counter, uncovered path, unclassified failure, timeout or missing aggregate stops/fails the run. This does not test publisher access or unblock #4/#5.

**Owner decision recorded (2026-10-01):** **Approved:** implement H12 Option B and run its network-denied local preflight using the exact fixture input `{"mode":"fixture-only","fixtureId":"readability-positive-v1"}` and the enumerated API guard/import-graph approach. The owner was told this reuses Readability on one bundled synthetic article to diagnose hosted startup, and does not test live Google or publisher access. Approval does not authorize any hosted run. After independent validation of the image, SDK destination/operation tuples, guard activation/counters, worker/child coverage, exclusions, negative tests and aggregate path, present the evidence for separate explicit owner authorization of at most one hosted run. Option A remains available separately; if neither A nor B is supported, keep H12 offline-only and the Spike on Hold.

**Decision requested now:** none. The existing owner approval covered local implementation/preflight only, and that work is complete. No hosted run is authorized. The next gate is independent code review; hosted work cannot be considered until review is complete and hosted tuple parity has supported evidence.

**Consequence if review finds issues or hosted parity cannot be established:** address review findings and revalidate; if the hosted tuple set remains unknown, stay offline-only and keep #4/#5 blocked. O1's live publisher viability and I10's hosted failure stage remain unknown.

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

### Iteration 11 — H12 local fixture startup diagnostic

**Option:** O1 direct Mozilla Readability, fixture-only path

**Environment/data:** pinned `apify/actor-node` image `sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`, Docker `--network none`, one bundled synthetic fixture

**Evidence:** `experiments/11-fixture-startup/experiment.md` and `experiments/11-fixture-startup/evidence/local-result.json`

**Result:** Supported for this local fixture path. The worker returned Readability success with 26 words; one aggregate was persisted; all five frozen local SDK tuples matched; 15 parent and 42 worker negative probes were denied; no application request reached the stub during probes; and the seven-module import graph passed. The invalid-input predicates were exercised, but the malformed-input full Actor flow was not rerun. Independent validation passed. This does not establish hosted tuple parity/startup or live publisher readability.
**Next action:** finish independent code review on PR #23, address and revalidate any findings, then determine whether supported exact-build evidence can establish the hosted tuple set. Any hosted execution needs a separate owner approval.

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
**Required next action:** complete independent code review of the H12 implementation on PR #23 and address findings. Then determine whether supported evidence can establish the hosted SDK tuple set. No hosted run is authorized; any hosted execution requires a separate owner checkpoint. Keep #4/#5 on hold and do not repeat the live publisher cohort without fresh approval.
