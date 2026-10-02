# Technical Spike: Google News access and publisher full-text boundary

> Canonical living execution/evidence artifact for Technical Spike #34. The Issue defines the question, the TID defines the technical search space, and the Spike Implementation Plan defines the execution route. This document records bounded experiments and accumulated evidence.

**Artifact ID:** `spike-34-news-access-full-text`  
**Status:** `Open`  
**Owner:** `Project owner`  
**Created / updated:** `2026-10-02`  
**GitHub Spike Issue:** `#34`  
**Technical Investigation Design:** `docs/changes/34/technical-investigation-design.md` / `tid-34-news-access-full-text`  
**Spike Implementation Plan:** `docs/changes/34/spike-implementation-plan.md` / `sip-34-news-access-full-text`  
**Spike branch:** `spike/34-news-access-full-text`  
**Blocked downstream Issue(s):** `#4, #5`

## 1. Technical Question and Required Outcome

Use the stable Technical Question and Required Outcome in #34.

The Spike must establish a supported production-like HTTP-first route for #4 Google News access/resolution and #5 publisher full-text retrieval, or identify the exact approved-boundary conflict that prevents either requirement.

## 2. Current Understanding

### Established facts

- #14 / PR #21 supports the existing marker/RPC publisher-URL resolver mechanism.
- #4's later hosted candidate failed before that mechanism because of Google consent/interstitial behaviour.
- Historical #22 measured 72/100 HTTP 200 HTML publisher responses in the Apify runtime.
- Historical #22 measured 78/78 eligible Extractus hosted calls reaching the extraction deadline without scored output.
- Direct Mozilla Readability has controlled local viability but lacks a clean representative hosted publisher measurement through the normal Actor path.
- The historical custom network/API-origin guard is not part of the product architecture and is explicitly excluded as a prerequisite for this Spike.

### Remaining uncertainty

- Minimum ordinary HTTP/session handling needed for W1/A1.
- Whether W1 can satisfy #4's >=95/100 representative threshold.
- Whether W2/A4 can satisfy #5's >=50/100 representative readable-text threshold.
- Whether any failure requires an explicit Product/Architecture change rather than further troubleshooting.
- Representative runtime/cost envelope and final fail-soft taxonomy.

### Rejected / unsupported assumptions

- **Rejected:** the Spike needs a custom egress firewall, SDK-origin allowlist, socket interception layer or equivalent security harness before it can test the product path.
- **Unsupported:** a failed publisher fetch implies the article extractor is at fault.
- **Unsupported:** Extractus's historical timeout pattern proves generic full-text extraction is infeasible.
- **Unsupported:** a failed/inconclusive experiment authorises a chain of deeper diagnostics without a new owner checkpoint.

## 3. Current Investigation Position

**TID workstream:** `W1 / Google News access -> existing publisher-URL resolver`  
**TID approach:** `A1 / Existing marker/RPC resolver over ordinary bounded HTTP/session handling`  
**Plan route:** `Execution Map order 1`  
**Approach status:** `Active`

W1/A1 is first because #4 already has a supported resolver core and the unresolved blocker is the ordinary access/session layer in front of it. #5 is downstream in the product flow and must not drive the investigation into extraction before the #4 access boundary is understood.

## 4. Current Approved Experiment

**Iteration:** `1`  
**Hypothesis:** `Pending owner-approved experiment proposal`  
**Owner approval:** `Pending`

### Why this experiment

No experiment is authorised yet. The next agent must use the `technical-spike` skill to present a self-contained owner approval checkpoint for one bounded W1/A1 experiment.

The proposal must test the smallest production-like question needed to determine whether ordinary bounded HTTP/session handling can reproduce and progress past the Google consent/interstitial boundary into the existing marker/RPC resolver.

### Experiment

**Pending owner approval.**

The proposed experiment must:

- run through the normal Apify Node 20 Actor/SDK path;
- use a small bounded input sufficient to reproduce the #4 access boundary;
- preserve the existing marker/RPC mechanism rather than replace it;
- record the response/access classification and resolver-stage progress;
- avoid custom egress/security harnesses;
- define in advance the evidence that would support, reject or leave the hypothesis inconclusive.

### Expected evidence

**To be defined in the approval checkpoint.**

At minimum, evidence must distinguish:

- consent/interstitial response;
- successful progression to marker/signature extraction;
- progression to RPC resolution;
- invalid/non-publisher result;
- request/runtime failure before the intended Google boundary.

### Operational bounds

**To be proposed with Iteration 1 and approved by the owner.**

They must be proportionate and include request count, concurrency, timeouts, response-size limits, runtime/spend where relevant, retained-data limits, and no secret values.

### Permitted straightforward corrections

Only obvious mechanical corrections that do not change the W1/A1 hypothesis, mechanism, architecture/dependencies, representative evidence meaning, scope or risk.

### Stop conditions

Stop for an Experiment Viability Checkpoint if:

- the first reasonable correction does not resolve a pre-boundary failure;
- additional diagnostics require new guards/wrappers/infrastructure/dependencies;
- the problem becomes a runtime/platform investigation rather than the approved Google access/session question;
- the candidate would need browser/proxy/paid/heavy access machinery;
- the evidence no longer has a clear path to #4's acceptance decision.

## 5. Experiment Log

No experiment has been executed under Spike #34.

Historical #22 / PR #23 experiments are evidence inputs referenced by the TID; they are not copied into this log as #34 iterations.

## 6. Supported Technical Specification

### Supported behaviour

- The #14 marker/RPC resolver remains the supported resolver core unless #34 evidence requires TID review.
- Publisher-resolution/full-text failures must remain row-local and preserve `googleNewsUrl`.
- Publisher access and article extraction are separate technical claims and must be measured separately.
- The supported target architecture is the normal lightweight HTTP-first Apify Node 20 Actor path.

### Required sequence / mechanism

1. Establish the W1 supported Google News access/session path to the existing marker/RPC resolver.
2. Reassess #4 against its defined 100-row live threshold.
3. For W2, attempt bounded publisher HTTP retrieval only for usable resolved URLs.
4. Apply structured-data fast path / generic extraction only to eligible successful HTML.
5. Record access and extraction outcomes separately.
6. Reassess #5 against its defined representative >=50% readable-text target.

### Failure modes and handling constraints

Current evidence requires at least these conceptual classes:

- Google consent/interstitial;
- Google request denial/rate limit;
- marker/resolver input unavailable;
- RPC/decode/invalid-destination failure;
- no resolved publisher URL;
- robots/access skip;
- publisher HTTP denial;
- timeout/network error;
- non-HTML/unusable response;
- extractor guard rejection;
- no readable article;
- extraction error;
- success.

Exact production status names are a downstream design decision after the Spike.

### Environment / variability

Historical evidence is specific to recorded Apify Node 20 runs and sampled publishers. It does not establish population-wide success rates. Final claims must use the representative acceptance samples defined by #4/#5.

### Confidence and evidence boundary

The current specification defines the investigation baseline only. #34 has not yet produced new execution evidence, so neither #4 nor #5 is unblocked.

## 7. Remaining Uncertainty

- W1/A1 ordinary session/consent behaviour in the production-like hosted path.
- #4 100-row success rate after a relevant corrective change.
- W2/A4 clean hosted extraction viability and representative success rate.
- Access-vs-extraction contribution to #5 failures.
- Need, if any, for a Product/Architecture boundary change.
- Representative runtime/cost characteristics.

## 8. Final Conclusion

**Result:** `Pending`

### Feasible

Not yet established.

### Not feasible

Not yet established.

An individual failed or inconclusive experiment is not a terminal Spike result.

## 9. Downstream Implications

- Keep #4 on hold until W1 reaches a supported conclusion and the final Spike evidence is integrated.
- Keep #5 on hold until W2 reaches a supported conclusion and the final Spike evidence is integrated.
- After final integration, rerun `assess-change` on both #4 and #5 before HLD/implementation resumes.

## 10. Reproducibility

For every #34 experiment record:

- exact Spike branch commit/probe version;
- commands/scripts;
- Apify/local runtime and relevant version;
- exact representative input/sample definition;
- execution date/window;
- bounded run configuration;
- retained sanitized evidence paths;
- credential/environment prerequisites without secret values.

Historical evidence remains referenced from #22 / PR #23 rather than copied into this branch unless a specific retained artifact is needed for reproducibility.

## Completion

**Spike state:** `Open`  
**Rationale:** TID and Spike Implementation Plan are approved, but no #34 experiment has yet been owner-approved or executed.  
**Required next action:** `Run the technical-spike skill and present the self-contained owner approval checkpoint for exactly one W1/A1 experiment. Do not execute before approval.`
