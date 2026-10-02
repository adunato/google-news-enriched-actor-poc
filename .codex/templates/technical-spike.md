# Technical Spike: <question / boundary>

> Canonical living execution/evidence artifact for a Technical Spike. The Issue defines the question, the TID defines the technical search space, and the Spike Implementation Plan defines the execution route. This document records the bounded experiments and accumulated evidence.

**Artifact ID:** `<stable-id>`  
**Status:** `<Open | Feasible | Not feasible | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<#issue or URL>`  
**Technical Investigation Design:** `<path and artifact ID>`  
**Spike Implementation Plan:** `<path and artifact ID>`  
**Spike branch:** `<branch>`  
**Blocked downstream Issue(s):** `<#issue(s) or URL(s)>`

## 1. Technical Question and Required Outcome

<Reference the stable Issue question/outcome concisely. Do not redefine it here.>

## 2. Current Understanding

### Established facts

- <evidence-backed fact>

### Remaining uncertainty

- <uncertainty still relevant to the Issue>

### Rejected / unsupported assumptions

- <assumption disproved, with evidence reference>

## 3. Current Investigation Position

**TID workstream:** `<W# / description>`  
**TID approach:** `<A# / description>`  
**Plan route:** `<execution-map reference>`  
**Approach status:** `<Active | Supported | Deprioritised | Rejected | Blocked>`

<Explain briefly why this is the current position under the approved TID and Spike Implementation Plan.>

## 4. Current Approved Experiment

**Iteration:** `<number>`  
**Hypothesis:** `<bounded hypothesis>`  
**Owner approval:** `<Approved YYYY-MM-DD | Pending>`

### Why this experiment

<Explain what uncertainty this experiment resolves and why it follows from the current TID/plan position.>

### Experiment

<Exact bounded experiment, representative environment/data, and controls/comparison where relevant.>

### Expected evidence

<Observable evidence that would support, reject or leave the hypothesis inconclusive.>

### Operational bounds

<Requests, concurrency, runtime, spend, data retention, credentials, safety/security controls and other limits.>

### Permitted straightforward corrections

<List corrections that may be made without changing the experiment's hypothesis, mechanism, architecture/dependencies or evidence meaning. If none: “None.”>

### Stop conditions

<Conditions requiring an owner checkpoint before further troubleshooting or a new experiment.>

## 5. Experiment Log

Append one subsection per completed experiment. Preserve failures and inconclusive results.

### Iteration <N> — <short name>

**TID workstream / approach:** <W# / A#>  
**Hypothesis:** <what was tested>  
**Environment/data:** <representative runtime/input/sample>  
**Method:** <bounded experiment>  
**Evidence:** <stable repository references and key observations>  
**Result:** `<Supported | Rejected | Inconclusive>`  
**Learning:** <what changed in current understanding>  
**Straightforward corrections attempted:** <None or concise list>  
**Experiment viability:** `<Normal completion | Viability checkpoint triggered>`  
**Approach viability:** `<Continue | Deprioritise | Reject | TID review required>`  
**Owner checkpoint outcome:** `<Pending | Approved next experiment | Redirected | Stop>`

## 6. Supported Technical Specification

> Accumulating evidence that downstream engineering may eventually rely on. Include only supported behaviour.

### Supported behaviour

- <technical behaviour / environmental requirement>

### Required sequence / mechanism

1. <supported step>
2. <supported step>

### Failure modes and handling constraints

- <observed failure mode and supported implication>

### Environment / variability

- <material limitation>

### Confidence and evidence boundary

<What is demonstrated and what is explicitly not claimed.>

## 7. Remaining Uncertainty

<List only uncertainties that still matter to the original Technical Question.>

## 8. Final Conclusion

**Result:** `<Feasible | Not feasible | Pending>`

### Feasible

<State the evidence-backed technical approach/specification downstream engineering may rely on.>

### Not feasible

<State the evidence showing the Required Outcome cannot be achieved within the approved constraints and the resulting decision required.>

An individual failed or inconclusive experiment is not a terminal Spike result.

## 9. Downstream Implications

- <blocked Issue and required reassessment>
- <Product/Architecture/POC decision required, if any>

## 10. Reproducibility

Record:

- exact repository commit / probe version;
- commands/scripts;
- runtime/environment;
- representative sample;
- execution window;
- retained evidence paths;
- credential/environment prerequisites without secret values.

## Completion

**Spike state:** `<Open | Ready to close>`  
**Rationale:** <why the Technical Question is or is not resolved>  
**Required next action:** <next approved experiment, TID/plan review, final validation, or final PR>
