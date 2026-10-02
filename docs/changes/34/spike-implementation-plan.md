# Spike Implementation Plan: Google News access and publisher full-text boundary

> Canonical execution-routing artifact for Technical Spike #34. It translates the approved Technical Investigation Design into an ordered investigation route while leaving individual hypotheses and experiment design to the Technical Spike iteration loop.

**Artifact ID:** `sip-34-news-access-full-text`  
**Status:** `Approved`  
**Owner:** `Project owner`  
**Created / updated:** `2026-10-02`  
**GitHub Spike Issue:** `#34`  
**Technical Investigation Design:** `docs/changes/34/technical-investigation-design.md` / `tid-34-news-access-full-text`  
**Spike branch:** `spike/34-news-access-full-text`

## 1. Purpose

Control the order in which #34 evaluates the approved TID candidates so the investigation answers #4 and #5 without allowing a failing experiment to expand into candidate-specific infrastructure.

The plan starts with the #4 access/session blocker, because #5 depends on resolved publisher URLs in the product flow, then evaluates the #5 publisher fetch/extraction path. It preserves explicit fallbacks and stop/return rules so troubleshooting cannot redefine the design implicitly.

## 2. Execution Map

| Order | Workstream | TID approach | Entry condition | Exit / success condition | Fallback / next route |
| ----: | --- | --- | --- | --- | --- |
| 1 | W1 | A1 | #34 branch/artifacts approved; normal Apify Actor/SDK path available; #14 resolver core and #4 failed-access evidence identified | Production-like access/session path demonstrated and #4's defined 100-row sample reaches >=95/100 valid publisher URLs, or A1 is shown unable to do so within approved boundary | If evidence points to local same-mechanism implementation defect -> A2. If success -> W2/A4. If heavier access mechanism required -> conclude W1 boundary / TID-Product-Architecture decision |
| 2 | W1 | A2 | A1 evidence specifically indicates a local request/session/parsing implementation difference may explain failure | Bounded comparison either identifies a relevant corrective change that returns to A1 acceptance testing or rules out local implementation difference | Return to A1 with relevant change; otherwise conclude W1 boundary. Do not proceed to A3 inside current TID |
| 3 | W2 | A4 | W1 has a supported route for final flow, or a bounded candidate-only test uses provenance-clear retained publisher URLs; normal publisher HTTP fetch and result scoring can be separated from extraction | Defined #5 representative sample reaches >=50 readable-text successes with explicit per-row statuses, or evidence classifies why target is missed | If access is limiting -> conclude W2 boundary. If accessible HTML is sufficient but extraction quality is limiting -> A5. If success -> Spike completion synthesis |
| 4 | W2 | A5 | A4 misses primarily because accessible eligible HTML cannot be extracted well enough; owner approves a proportionate generic Node-native fallback selected within TID | Fallback reaches >=50/100 on the defined representative sample or demonstrates that credible Node-native generic extraction cannot satisfy target | If success -> Spike completion synthesis. If failure would require A6/A7 or a new mechanism -> TID review / boundary decision |

**A6 Extractus:** not on the normal route. Historical evidence already gives it lower information value. It may be reconsidered only if new evidence materially changes its disposition and the TID is reviewed if needed.

**A3/A7 heavier mechanisms:** not executable routes under this plan.

## 3. Cross-Workstream Dependencies

- W1 precedes the final W2 capability conclusion because #5's production flow depends on #4 producing usable publisher URLs.
- A bounded W2 candidate-mechanics experiment may use retained/fixed publisher URLs before W1 is complete only when provenance is explicit and the result is not presented as final #5 end-to-end acceptance evidence.
- Final #5 evidence must preserve the representative sample definition and clearly report the effect of unresolved/resolved URL availability.
- A W1 systemic failure may make end-to-end #5 infeasible regardless of extractor quality; do not hide that dependency by substituting hand-curated publisher URLs in the final conclusion.

## 4. Execution Envelope

### W1 / A1 — existing resolver over ordinary HTTP/session handling

**Experiment may vary:** bounded query/sample size before the final 100-row acceptance run; request headers that represent ordinary public HTTP use; redirect/session/cookie handling necessary to reproduce and pass the consent/interstitial boundary; instrumentation that records response class, resolver-stage progress, timing and row outcomes without changing the mechanism.  
**Requires plan/TID review:** browser automation, proxies/unblocking services, paid alternative APIs, replacement of marker/RPC with a different resolution architecture, custom SDK/egress/security harnesses, new runtime/service, changed acceptance meaning.

If the experiment fails before reaching the intended Google boundary because the ordinary Actor runtime cannot start or execute, permit one bounded smoke-level correction/diagnostic. If there is no obvious mechanical fix after that, trigger an Experiment Viability Checkpoint rather than creating a runtime-diagnostics programme.

### W1 / A2 — same-mechanism reference comparison

**Experiment may vary:** compare request/session/parsing behaviour against one credible maintained implementation or minimal reference; isolate specific differences; test one evidence-backed corrective change.  
**Requires plan/TID review:** broad library comparison, different resolution mechanism, heavy access infrastructure, changing #4 success semantics.

### W2 / A4 — bounded fetch + structured data + Readability

**Experiment may vary:** small representative cohort before full sample; fetch timeout/body-size/concurrency bounds; Readability guard settings; structured-data fast-path parsing; measurement/instrumentation; mechanical DOM integration details.  
**Requires plan/TID review:** extractor performing its own uncontrolled network fetch; publisher-specific parser rules; browser rendering; second service/runtime; access-bypass machinery; redefining readable-text success.

A4 troubleshooting must keep fetch and extraction evidence separate. If the page was not successfully fetched as eligible HTML, do not treat the row as an extraction-library failure.

### W2 / A5 — generic Node-native fallback

**Experiment may vary:** one proportionately selected generic Node-native algorithm; equivalent supplied-HTML input; bounded configuration/instrumentation needed to compare with A4.  
**Requires plan/TID review:** more than one new fallback without evidence, publisher-specific rules, Python/sidecar/external service, changed fetch architecture, changed success criterion.

## 5. Stop and Return Rules

Stop the current route and return to the appropriate higher-level artifact when:

- the TID option-viability condition is reached;
- continuing requires an approach not authorised by the TID;
- the first reasonable correction to an approved experiment does not resolve a failure and there is no obvious next mechanical fix;
- troubleshooting starts adding guards, wrappers, infrastructure, dependencies or diagnostics whose purpose is materially different from the approved experiment;
- several plausible causes would require a separate investigation to distinguish;
- a failed candidate is being rerun unchanged;
- a publisher access failure is being used to justify switching article extractor;
- a dependency, runtime, architecture, cost, security, legal/policy, safety or scope boundary materially changes;
- representative evidence or an acceptance threshold would need to change;
- the expected troubleshooting effort becomes disproportionate to the information value of the current option.

At each such point, use the Experiment Viability Checkpoint and explicitly decide: **Continue / Deprioritise / Reject / TID review required.**

## 6. Spike Completion Route

The Spike reaches a supported conclusion only after both workstreams are resolved sufficiently for downstream engineering:

1. W1 establishes the supported #4 production-like access/session + marker/RPC route against the defined acceptance evidence, **or** identifies the exact POC/Product/Architecture boundary preventing it.
2. W2 establishes the supported #5 bounded publisher fetch + extraction route against the defined representative evidence, **or** identifies the exact boundary preventing the >=50% target.
3. `technical-spike.md` synthesises the supported failure/status taxonomy, runtime/cost observations, environment limitations and what downstream engineering may rely on.
4. Run final Spike validation.
5. Create the single final integration PR from `spike/34-news-access-full-text`.
6. After merge, rerun `assess-change` on **#4 and #5**. Do not resume either Feature Issue from pre-Spike assumptions.

A single successful workstream does not by itself complete #34 unless the other workstream's downstream requirement is explicitly shown not to be part of the stable Technical Question. Under the current Issue, both must be addressed.

## 7. Open Planning Questions

No outstanding Spike planning questions.

The first execution action is **not** to code or run a test. The agent must read #34, this approved TID, this approved plan and the initial `technical-spike.md`, then present the self-contained owner approval checkpoint for exactly one **W1/A1** experiment.

## 8. Approval

**Decision:** `Approve`  
**Rationale:** The route directly follows the approved TID, starts with the blocking #4 access/session boundary, separates access from extraction, defines evidence-driven fallbacks, and contains explicit anti-rabbit-hole stop rules.  
**Required follow-up:** `Use the technical-spike skill to propose the first W1/A1 experiment for owner approval. Do not execute it before approval.`

### Completion contract

The plan is approved for use. Individual hypotheses, exact experiments and operational bounds belong in `technical-spike.md` and require one owner approval at a time.
