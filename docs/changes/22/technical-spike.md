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
- The owner approved the bounded Iteration 10 on 2026-10-01. Its exact cohort, scoring rules and resource bounds are specified below. The corrected offline preflight passed all 24 checks on 2026-10-01; no hosted run has occurred.

### Unresolved questions

- Whether a simpler, directly controlled generic extraction path can meet #5's representative target in the Apify runtime.
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

**Status:** Priority 1 — selected for next evaluation.

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

O1 is next because it removes the higher-level wrapper that has accumulated unexplained hosted failures while keeping the experiment inside the same HTTP-first POC boundary. O3 is retained as a credible alternative if O1 is insufficient. O4 does not currently justify experiment cost.

This option set is intentionally small and bounded to the current blocker.

## 5. Investigation Backlog

### H10 — O1 target-runtime viability

**Hypothesis:** Direct Mozilla Readability with explicit runtime guards, using structured article-body data as a fast path where available, can process a useful share of already-fetched public publisher HTML in the Apify runtime without reproducing the unexplained Extractus timeout pattern.

**Why test it:** It is the highest-priority credible option after the lifecycle re-baseline and directly tests whether the problem is specific to the current wrapper/path rather than the environment or HTML itself.

**Evidence that would support it:** on a complete fresh cohort of 100 unique candidates, at least 50 produce qualifying candidate text within the approved bounds, with the 100-slot denominator and permitted-2xx denominator reported separately. A cohort shortfall is non-decisive for extraction viability. This is an early viability signal only: it does not close the Spike or establish #5's quality criterion.

**Evidence that would refute it:** the same broad timeout pattern occurs despite explicit guards, or readable output remains too low to plausibly support #5's >=50% representative target.

**Status:** Offline preflight passed on 2026-10-01; hosted evaluation remains gated on independent review and verification of the exact private-run settings.

### H11 — #4 consent/session handling

**Hypothesis:** The Google consent/interstitial blocker relevant to #4 can be handled using ordinary public request/session/consent mechanics within the current HTTP-first boundary.

**Status:** Proposed after the current publisher-content branch reaches its next checkpoint, unless #4 is explicitly prioritised first by the owner.

## 6. Current Iteration

**Iteration:** 10 proposed  
**Selected option:** O1 — direct Mozilla Readability with explicit guards  
**Hypothesis / approach:** H10  
**Executor:** Offline preflight completed and passed; hosted execution remains conditional on independent review and verification of every stated hosted gate
**Owner approval:** Approved 2026-10-01 for the bounded Iteration 10 below only; the corrected candidate passed 24/24 offline checks as recorded below; no hosted run has occurred

### Why this iteration

The previous path was increasingly instrumenting Extractus rather than reassessing whether Extractus remained the right option. The viability checkpoint now shows that deeper Extractus-specific telemetry is lower information value than testing the simpler directly controlled option.

### Experiment

The corrected offline preflight passed all 24 planned assertions on 2026-10-01 under Node 20.19.0 with `@mozilla/readability` 0.6.0 and `linkedom` 0.18.13. It made zero network probe attempts; aggregate sink checks recorded one complete write, zero partial writes and zero privacy-violation writes. The sanitized report records the exact configuration and dependency/source hashes. The tests cover robots pattern precedence, monotonic soft-stop aborts, request/worker deadlines, extraction word-count consistency, aggregate reconciliation, source-manifest and launch-gate ordering, shell-free credential-safe CLI behavior, and mocked exact-build/API readbacks. This evidence covers only local code and mocked launch behavior; it does not measure publisher pages or hosted behavior. The live launcher additionally requires an externally supplied reviewed HEAD and exact experiment-root path, plus a clean worktree. If review finds a failed assertion or a hosted gate cannot be verified, stop before hosted execution and return to this checkpoint with the failure and recovery options.

Only if every preflight assertion passes and the exact stated hosted gates remain verified, execute at most one bounded O1 evaluation on a fresh representative cohort under the existing direct-HTTP, robots, DNS, privacy and hosted-resource controls. Define 100 cohort slots as 5 fixed queries × GB/US locales × the first 10 ranked results per query/locale. A slot is identified by its query, locale and rank. Deduplicate repeated stories across slots by parsing the original Google News URL, removing its fragment and serializing it with the URL parser (preserving query parameters); retain the first occurrence in query/locale/rank order and mark later occurrences as duplicate slots. Do not backfill a duplicate, missing result, inaccessible result or other shortfall with a later-ranked result or a new query. Report requested slots, returned candidates, duplicate slots, unique retained candidates and all subsequent eligibility/outcome counts separately. The primary denominator remains all 100 requested slots; the permitted successful 2xx HTML subset is a separate denominator for extraction yield. If fewer than 100 unique candidates remain, report a source/cohort shortfall and treat the result as non-decisive for extraction viability; do not classify missing/duplicate slots as extraction failures.

For each eligible row:

- inspect structured `ArticleBody`/JSON-LD and run direct Mozilla Readability against the same eligible HTML; record structured and Readability outcomes independently, including overlap;
- define a qualifying Readability result as non-empty cleaned text with `fullTextStatus=success` and a reported `wordCount` equal to the whitespace-delimited word count of that cleaned text. Structured-only output is reported separately and does not count as Readability success;
- apply a 512 KiB response-prefix cap, a cumulative 64 KiB structured-script cap, a 10,000 DOM-element cap and a 100,000-character output cap. Record truncation/guard outcomes; never represent truncated extraction as complete without recording that status;
- retain only aggregate success/failure, timing, input-size/guard, access-eligibility, truncation, overlap and readable-text proxy evidence;
- do not retain URL, title, HTML body, article text, cookies or exception text.

Use zero retries (`attempt_count=1`) and preserve the five-second per-row worker deadline, five-redirect maximum, concurrency of four and 250 ms pacing. Apply a 780-second soft stop within the hosted 900-second run limit. The existing O2 evidence is contextual comparison evidence, not a controlled head-to-head baseline. Do not execute the deferred hosted Iteration 9 telemetry first.

### Expected evidence

The run should report all of the following, with counts and denominators:

- requested slots (100), returned candidates, duplicate slots, unique retained candidates, source/cohort shortfall and rows with permitted 2xx HTML;
- access failure versus extraction failure, including robots unavailable/disallowed, HTTP denial, non-HTML and other ineligible outcomes;
- structured-data success versus Readability success and their overlap;
- guarded rejection, truncation, timeout/error and non-empty qualifying output;
- aggregate timings, peak memory, elapsed time and hosted cost needed to decide whether O1 remains viable.

At least 50 qualifying unique rows out of all 100 requested slots is a positive initial signal only when the cohort has all 100 unique candidates; fewer than 100 unique candidates makes the result non-decisive for extraction viability regardless of extraction yield. With a complete cohort, fewer than 50 qualifying rows is a negative signal for this cohort, not by itself proof that #5 is infeasible. Neither outcome closes #22: #5's readable-quality threshold is not yet defined by this experiment, and #4 remains a separate unresolved boundary.

### Operational bounds

Use at most one private Apify run with `LIMITED_PERMISSIONS`, restart disabled, maximum charge $1, 256 MiB memory and a 900-second platform limit; stop new work at 780 seconds. Keep the five-second per-row worker deadline, five redirects, concurrency four, 250 ms pacing, zero retries and aggregate-only retention as stated above. Owner approval authorizes the bounded iteration, including the offline preflight, but a hosted run is permitted only after every preflight assertion passes and the stated hosted gates are verified. Approval does not waive these gates.

### Stop conditions

Stop before hosted execution if the offline compatibility preflight fails, if the probe would emit raw row-level output or article text, if retries cannot be disabled, or if the soft stop cannot be enforced. Stop the run at the $1, 256 MiB, 780-second soft-stop or 900-second platform bound, and stop before execution if the implementation would require browser rendering, residential proxies, paid external extraction APIs, publisher-specific rules, paywall bypass or another Product/Architecture boundary change. Any such failure invalidates this proposed experiment until corrected and re-approved; it must not be reported as an Iteration 10 result.

### Decision-ready checkpoint

**Recommended next action:** complete independent review of the frozen candidate, then verify the exact private Apify build and run settings; proceed to at most one hosted run only if all stated gates are verified.

**Why this is next:** the option-viability checkpoint deprioritised further Extractus-specific telemetry. A small offline compatibility check first removes a deployment/API compatibility risk; the bounded hosted cohort then directly measures whether O1 can produce qualifying text in the target runtime while distinguishing access eligibility from extraction yield.

**Prerequisite/blocker status:** owner approval was granted on 2026-10-01 and the corrected offline preflight passed all 24 assertions; no hosted run has occurred. The candidate now includes a credential-safe CLI adapter and guarded launch controller, but the exact candidate still requires independent review, a committed reviewed HEAD supplied as the trust anchor, a clean worktree and verification of private visibility, `LIMITED_PERMISSIONS`, exact build, disabled restart, and the $1/256 MiB/900-second limits before hosted execution. A cohort with fewer than 100 unique candidates is a source/cohort shortfall and makes extraction viability non-decisive. The unresolved #5 quality threshold is a material acceptance-definition gap: it prevents treating the 50/100 signal as proof of #5 completion, but does not prevent this limited viability experiment. Iteration 10 cannot resolve #4's consent/session boundary.

**Owner decision:** **Approved on 2026-10-01:** one bounded Iteration 10 consisting of the specified offline compatibility/safety preflight, followed only if every preflight assertion passes and all stated hosted gates are verified by at most one private Apify cohort of 100 fixed query/locale/rank slots (5 queries × GB/US × first 10 ranked results), applying the specified dedupe and no-replacement policy, direct HTTP and extraction bounds, aggregate-only evidence and $1/256 MiB/900-second hosted cap. Approval does not waive any gate, authorize a hosted run after a failed preflight, authorize follow-on iterations, or close #22, #5 or #4.

**Consequence of approval:** the bounded iteration is authorized and its offline preflight has passed. After independent review, if all hosted gates are verified, execute at most one hosted run and record aggregate evidence and result; if any gate fails, stop, return to this checkpoint with recovery options, and do not run hosted. Afterward update current understanding and recommend the next highest-value action.

**Consequence of redirect:** a later owner redirect before execution supersedes this approval; otherwise proceed within the approved bounds. #22 remains open, O1 target-runtime viability remains unmeasured, and #4/#5 remain blocked on their unresolved evidence/decision paths.

**Learning checkpoint:** Learnings: None. This plan has not executed an experiment and has produced no reusable execution lesson.

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

Experiment artifacts are excluded from automatic Prettier rewriting so their retained byte-level evidence and recorded hashes are not changed merely to satisfy repository formatting.

## Completion

**Spike state:** Open  
**Rationale:** the bounded #4/#5 technical question remains unresolved.  
**Required next action:** independently review the offline-passing Iteration 10 candidate and verify hosted run gates before any hosted execution.
