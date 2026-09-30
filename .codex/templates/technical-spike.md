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

## 4. Option Scan and Prioritisation

Before the first experimental hypothesis, perform a proportionate technical search for credible options that could resolve the bounded Technical Question. This is not a full domain-research exercise.

**Investigation depth / owner constraint:** <default proportionate Spike depth | owner-specified boundary>  
**Sources / evidence boundary:** <official docs, repository evidence, established approaches, upstream/community evidence consulted>

| Option | Approach | Evidence / rationale for inclusion | Material known limitation | Priority / status |
| --- | --- | --- | --- | --- |
| O1 | <candidate approach> | <why it is credible> | <known limitation / None known> | <1 — Selected / Proposed / Deprioritised / Rejected / Supported> |
| O2 | <candidate approach> | <why it is credible> | <known limitation / None known> | <2 — Proposed / ...> |

Explain the prioritisation briefly. Do not select an option solely because it was the first plausible implementation found.

If responsible option discovery would require a materially broader/open-ended research exercise, record the boundary and return to the owner rather than expanding this Spike into the SideGig Research Methodology.

## 5. Investigation Backlog

Maintain hypotheses for the **currently selected option**. Order them by expected information value and cost. If an option is rejected/deprioritised, preserve its completed hypotheses in the Experiment Log and return to the ranked option set.

| ID  | Option | Hypothesis | Why test it | Evidence that would support/refute it | Status |
| --- | --- | --- | --- | --- | --- |
| H1 | O1 | <hypothesis> | <reason> | <observable evidence> | <Proposed / Approved / Running / Supported / Rejected / Superseded> |

A failed hypothesis normally leads to another hypothesis within the same option only while that option remains justified. Repeated, stubborn or surprising failures trigger an option-viability checkpoint before deeper diagnostics. Create a separate Spike only when a genuinely independent technical question emerges with its own completion condition.

## 6. Current Iteration

**Iteration:** `<number>`  
**Selected option:** `<O# / description>`  
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

## 7. Experiment Log

Append one subsection per completed iteration. Do not delete failed experiments; they are part of the evidence trail.

### Iteration <N> — <short name>

**Option:** <O# / approach>  
**Hypothesis:** <what was tested>  
**Executor:** <who/tool executed this iteration>  
**Environment/data:** <representative runtime/input/sample>  
**Method:** <probe/experiment>  
**Evidence:** <stable repository references and key observations>  
**Result:** `<Supported | Rejected | Inconclusive>`  
**Learning:** <what changed in the current understanding>  
**Option viability:** <Not triggered | Continue — rationale | Deprioritise — rationale/evidence | Reject — rationale/evidence>  
**Recommended next iteration/action:** <one clear recommendation, or "None — Spike ready to conclude">  
**Why this is next:** <uncertainty resolved / information value>  
**Prerequisite/blocker status:** <None | item: effect on completed iteration; effect on next iteration; concrete recovery/action>  
**Owner decision requested:** <Approve Iteration N: ... | Redirect to ... | Decide ...>  
**Owner checkpoint outcome:** <Pending | Approved | Redirected | Stop | Autonomous continuation>

## 8. Supported Technical Specification

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

## 9. Remaining Uncertainty

<List only uncertainties that still matter to the original Technical Question. Ordinary implementation choices belong downstream in HLD/Implementation Planning.>

## 10. Final Conclusion

**Result:** `<Feasible | Not feasible | Pending>`

### Feasible

<State the technical specification/approach supported strongly enough for downstream design, including quantitative evidence where relevant.>

### Not feasible

<State the evidence showing that the required outcome cannot be achieved within the approved constraints. Identify which requirement/constraint creates the conflict.>

The Spike is not complete while the result is Pending. An inconclusive experiment is recorded in the Experiment Log and feeds the next iteration; it is not a terminal Spike result.

## 11. Downstream Implications

- <blocked Feature/Bug Issue and required reassessment>
- <Product Definition / Architecture Definition / POC decision required, if any>
- <durable technical facts that HLD/Implementation Planning may rely on>

After the final Spike evidence is integrated, rerun `assess-change` on every blocked downstream Issue before HLD, Implementation Planning or production implementation resumes.

## 12. Reproducibility

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
**Required next action:** <agent-owned recommended action; include blocker recovery and exact owner decision if approval is still required>
