# Technical Spike: <question / boundary>

> Canonical living execution/evidence artifact for a Technical Spike. The Technical Investigation Design defines the search space; the Spike Implementation Plan defines the route. This document records the current approved experiment, evidence and supported technical conclusions.

**Artifact ID:** `<stable-id>`  
**Status:** `<Open | Feasible | Not feasible | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<#issue or URL>`  
**Technical Investigation Design:** `<path and artifact ID>`  
**Spike Implementation Plan:** `<path and artifact ID>`  
**Spike branch:** `<branch>`  
**Blocked downstream Issue(s):** `<#issue(s) or URL(s)>`

## 1. Current Understanding

### Established facts

- <authoritative specification or directly observed fact>
- <validated prior behaviour>

### Material unresolved questions

- <uncertainty that still matters to the Technical Question>

### Rejected / unsupported assumptions

- <assumption or approach disproved by evidence>

## 2. Current Approved Experiment

**Iteration:** `<number>`  
**TID workstream:** `<W# / description>`  
**TID option:** `<O# / description>`  
**Hypothesis:** `<bounded claim>`  
**Owner approval:** `<Approved YYYY-MM-DD | Pending>`

### Why this experiment

<Why this exact experiment is the next useful test under the approved Spike Implementation Plan.>

### Experiment

<Exact bounded experiment, representative environment/data and comparison/control where relevant.>

### Expected evidence

<What observable result would support, reject or leave the hypothesis unresolved.>

### Operational bounds

<Runtime, spend, requests, data retention, credentials, safety/security controls and other explicit limits.>

### Straightforward corrections allowed

<List only unambiguous mechanical/configuration corrections that do not change the hypothesis, mechanism, architecture, dependency model or evidence meaning. If none: “None.”>

### Stop / viability conditions

<Conditions that require stopping the experiment and returning to the owner rather than adding a new troubleshooting direction.>

## 3. Experiment Log

Append one subsection per completed experiment. Do not delete failed/inconclusive experiments.

### Iteration <N> — <short name>

**Workstream / option:** <W# / O#>  
**Hypothesis:** <what was tested>  
**Environment/data:** <representative runtime/input/sample>  
**Method:** <bounded experiment>  
**Evidence:** <stable repository references and key observations>  
**Result:** `<Supported | Rejected | Inconclusive>`  
**Straightforward corrections attempted:** <None / concise list>  
**Experiment viability checkpoint:** <Not triggered | Triggered — reason and owner decision>  
**Learning:** <what changed in current understanding>  
**Owner decision / next approved experiment:** <decision/reference>

## 4. Supported Technical Specification

> Accumulating evidence-backed output that downstream engineering may eventually rely on. Include only supported behaviour.

### Supported behaviour

- <technical behaviour / interaction rule / environmental requirement>

### Required sequence / mechanism

1. <supported interaction step>
2. <supported interaction step>

### Failure modes and handling constraints

- <observed failure mode and supported implication>

### Environment / variability

- <runtime, region, account, provider, data-shape or timing limitation>

### Confidence and evidence boundary

<What is demonstrated, how representative it is, and what is explicitly not claimed.>

## 5. Remaining Uncertainty

<List only uncertainties that still matter to the original Technical Question.>

## 6. Final Conclusion

**Result:** `<Feasible | Not feasible | Pending>`

### Feasible

<State the evidence-backed technical specification/approach sufficiently established for downstream design.>

### Not feasible

<State the evidence showing that the required outcome cannot be achieved within the approved constraints and the resulting Product/Architecture/POC decision.>

The Spike is not complete while the result is Pending.

## 7. Downstream Implications

- <blocked Feature/Bug Issue and required reassessment>
- <Product/Architecture/POC decision required, if any>
- <durable technical facts that downstream HLD/Implementation Planning may rely on>

## 8. Reproducibility

Record:

- exact repository commit / probe version;
- commands/scripts used;
- runtime/environment details;
- representative input/sample;
- execution windows;
- retained evidence paths;
- credential/environment prerequisites without secret values.

## Completion

**Spike state:** `<Open | Ready for final validation>`  
**Rationale:** <why the original Technical Question is or is not resolved>  
**Required next action:** <next approved experiment, viability decision, or final validation>
