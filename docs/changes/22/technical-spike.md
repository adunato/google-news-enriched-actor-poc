# Technical Spike: bounded news access and article retrieval for #4/#5

> Living investigation artifact for Issue #22. Historical experiment evidence remains retained under `docs/changes/22/experiments/` and in the original repository history. This artifact was re-baselined on 2026-09-30 after the Technical Spike lifecycle was corrected to require proportionate option discovery and candidate-viability checkpoints.

**Artifact ID:** `spike-22`  
**Status:** Open  
**Owner:** Project owner  
**Created / updated:** 2026-09-30  
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

**Evidence that would support it:** representative rows complete within the approved bounds, produce non-empty candidate article text for a useful share of eligible rows, and retain aggregate timing/failure evidence sufficient to compare against O2.

**Evidence that would refute it:** the same broad timeout pattern occurs despite explicit guards, or readable output remains too low to plausibly support #5's >=50% representative target.

**Status:** Proposed; owner approval required before execution.

### H11 — #4 consent/session handling

**Hypothesis:** The Google consent/interstitial blocker relevant to #4 can be handled using ordinary public request/session/consent mechanics within the current HTTP-first boundary.

**Status:** Proposed after the current publisher-content branch reaches its next checkpoint, unless #4 is explicitly prioritised first by the owner.

## 6. Current Iteration

**Iteration:** 10 proposed  
**Selected option:** O1 — direct Mozilla Readability with explicit guards  
**Hypothesis / approach:** H10  
**Executor:** Pending  
**Owner approval:** Pending

### Why this iteration

The previous path was increasingly instrumenting Extractus rather than reassessing whether Extractus remained the right option. The viability checkpoint now shows that deeper Extractus-specific telemetry is lower information value than testing the simpler directly controlled option.

### Experiment

Run one bounded O1 evaluation on a fresh representative cohort under the existing direct-HTTP, robots, DNS, privacy and hosted-resource controls. Process only rows that successfully return permitted 2xx HTML.

For each eligible row:

- check structured article-body data first where available;
- otherwise construct the chosen DOM implementation and run direct Mozilla Readability;
- use explicit size/element/time guards;
- retain only aggregate success/failure, timing, input-size/guard and readable-text proxy evidence;
- do not retain URL, title, HTML body, article text, cookies or exception text.

The existing O2 evidence is the comparison baseline. Do not execute the deferred hosted Iteration 9 telemetry first.

### Expected evidence

The run should distinguish:

- access failure versus extraction failure;
- structured-data success versus Readability success;
- guarded rejection versus timeout/error;
- candidate-readable output versus unavailable/failed extraction;
- runtime/cost evidence needed to decide whether O1 remains viable.

### Operational bounds

Use the same private Apify, $1 maximum charge, 256 MiB, 900-second run, bounded request, no-retry and aggregate-only retention principles already demonstrated by the hosted Spike experiments. The exact per-row extraction deadline and element/input guards must be fixed before approval.

### Stop conditions

Stop before execution if the implementation would require browser rendering, residential proxies, paid external extraction APIs, publisher-specific rules, paywall bypass or another Product/Architecture boundary change.

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
**Required next action:** owner review of the option re-baseline and approval or redirect of H10. No new experiment has been executed by this re-baseline.
