# Technical Spike: <question / boundary>

> Canonical living investigation artifact for a material technical unknown. This document plans and records iterative experiments until the original technical question is resolved. It is not a production implementation plan.

**Artifact ID:** `<stable-id>`  
**Status:** `<Open | Feasible | Not feasible | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<#issue or URL>`  
**Blocked downstream Issue(s):** `<#issue(s) or URL(s)>`  
**Spike branch / draft PR:** `<branch and PR URL | Pending>`  
**Product Definition:** `<path / requirement references or None>`  
**Architecture Definition:** `<path / section references or None>`

## 1. Technical Question

<State the stable question this Spike must answer and the downstream decision that depends on it. Do not rewrite the question merely because an experiment fails.>

## 2. Required Outcome and Constraints

### Required outcome

<State what must be known well enough for downstream engineering to proceed, including any quantitative threshold where applicable.>

### Constraints

- <approved product/architecture boundary>
- <cost, runtime, security, legal, safety or dependency constraint>

## 3. Current Understanding

### Established facts

- <authoritative specification or directly observed fact>
- <validated prior behaviour>

### Unresolved questions

- <material uncertainty that still prevents closure>

### Rejected / unsupported assumptions

- <assumption or approach already disproved, with experiment/evidence reference>

Third-party/community implementations are leads, not authoritative specifications unless the external provider explicitly documents them as such.

## 4. Investigation Backlog

Maintain the candidate hypotheses/approaches still worth testing. Order them by expected information value and cost.

| ID  | Hypothesis / approach | Why test it | Evidence that would support/refute it | Status                                                              |
| --- | --------------------- | ----------- | ------------------------------------- | ------------------------------------------------------------------- |
| H1  | <hypothesis>          | <reason>    | <observable evidence>                 | <Proposed / Approved / Running / Supported / Rejected / Superseded> |

A failed hypothesis normally leads to another hypothesis in this same Spike. Create a separate Spike only when a genuinely independent technical question emerges with its own completion condition.

## 5. Current Iteration

**Iteration:** `<number>`  
**Hypothesis / approach:** `<H# / description>`  
**Executor:** `<Codex | ChatGPT | Human | Other>`  
**Owner approval:** `<Approved YYYY-MM-DD | Autonomous continuation authorized | Pending>`

### Why this iteration

<Why this is the next most useful experiment given the evidence so far.>

### Experiment

<Exact bounded probe/experiment to run, including representative environment/data and the comparison/control where relevant.>

### Expected evidence

<What observable output will support, refute, or leave the hypothesis unresolved.>

### Operational bounds

<Requests, concurrency, runtime, spend, data retention, credentials, safety/security controls and other limits.>

### Stop conditions

<Conditions that require stopping and returning to the owner before continuing, including material changes to scope, constraints, dependencies, cost, product/architecture assumptions or risk.>

## 6. Experiment Log

Append one subsection per completed iteration. Do not delete failed experiments; they are part of the evidence trail.

### Iteration <N> — <short name>

**Hypothesis:** <what was tested>  
**Executor:** <who/tool executed this iteration>  
**Environment/data:** <representative runtime/input/sample>  
**Method:** <probe/experiment>  
**Evidence:** <stable repository references and key observations>  
**Result:** `<Supported | Rejected | Inconclusive>`  
**Learning:** <what changed in the current understanding>  
**Next proposed iteration:** <next H#/experiment, or "None — Spike ready to conclude">  
**Owner checkpoint:** <Approved next iteration / Redirected / Stop / Autonomous continuation>

## 7. Supported Technical Specification

> This section is the accumulating output that downstream engineering may eventually rely on. Include only behaviour supported by authoritative documentation or retained evidence.

### Supported behaviour

- <technical behaviour / request-response rule / environmental requirement>

### Required sequence / mechanism

1. <supported interaction step>
2. <supported interaction step>

### Failure modes and handling constraints

- <observed failure mode and supported implication>

### Environment / variability

- <runtime, region, account, provider, data-shape or timing limitation>

### Confidence and evidence boundary

<What is demonstrated, how representative it is, and what is explicitly not claimed.>

If the Spike is still Open, this section may be partial. Clearly mark unsupported or unresolved points rather than filling gaps by assumption.

## 8. Remaining Uncertainty

<List only uncertainties that still matter to the original Technical Question. Ordinary implementation choices belong downstream in HLD/Implementation Planning.>

## 9. Final Conclusion

**Result:** `<Feasible | Not feasible | Pending>`

### Feasible

<State the technical specification/approach supported strongly enough for downstream design, including quantitative evidence where relevant.>

### Not feasible

<State the evidence showing that the required outcome cannot be achieved within the approved constraints. Identify which requirement/constraint creates the conflict.>

The Spike is not complete while the result is Pending. An inconclusive experiment is recorded in the Experiment Log and feeds the next iteration; it is not a terminal Spike result.

## 10. Downstream Implications

- <blocked Feature/Bug Issue and required reassessment>
- <Product Definition / Architecture Definition / POC decision required, if any>
- <durable technical facts that HLD/Implementation Planning may rely on>

After the final Spike evidence is integrated, rerun `assess-change` on every blocked downstream Issue before HLD, Implementation Planning or production implementation resumes.

## 11. Reproducibility

Record:

- exact repository commit / probe version;
- commands/scripts used;
- runtime/environment details;
- representative input/sample;
- UTC execution windows;
- retained evidence paths;
- credential/environment prerequisites without secret values.

## Completion

**Spike state:** `<Open | Ready to close>`  
**Rationale:** <why the original Technical Question is or is not resolved>  
**Required next action:** <owner review / next iteration / downstream reassessment / product decision>
