# Technical Spike: <question / boundary>

> Canonical living execution/evidence artifact for a Technical Spike. The Issue defines the stable question and the approved TID defines the experiment sequence, routing, evidence criteria and boundaries. This document records what was executed and what was learned.

**Artifact ID:** `<stable-id>`  
**Status:** `<Open | Feasible | Not feasible | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<descriptive Issue name + #number or URL>`  
**Technical Investigation Design:** `<path and artifact ID>`  
**Spike branch:** `<branch>`  
**Blocked downstream Issue(s):** `<descriptive Issue name(s) + #number(s) or URL(s)>`

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

**Investigation Area:** `<area ID/name or Single area>`  
**TID experiment:** `<experiment ID/name>`  
**Route status:** `<Ready | Running | Supported | Rejected | Inconclusive | Area complete | TID review required>`

<Explain briefly why this experiment is current under the approved TID sequence and predecessor result.>

## 4. Current Experiment Execution

**TID authorisation:** `<Approved TID reference>`

### Experiment definition

<Reference the TID experiment. Restate only execution-specific detail needed to run it; do not invent a different objective/test.>

### Operational bounds

<Concrete request/concurrency/runtime/spend/data-retention/credential limits needed for execution, where not already fixed by the TID.>

### Permitted straightforward corrections

<List obvious mechanical corrections that may be made without changing the experiment purpose/mechanism/evidence meaning. If none: “None.”>

### Stop conditions

<State the TID/boundary conditions that require stopping rather than creating an unplanned investigation.>

## 5. Experiment Log

Append one subsection per completed TID experiment. Preserve failures and inconclusive results.

### <Experiment ID> — <short name>

**Why it was run:** <TID purpose / predecessor condition>  
**Environment/data:** <representative runtime/input/sample>  
**Method:** <what was actually executed>  
**Evidence:** <stable repository references and key observations>  
**Result:** `<Supported | Rejected | Inconclusive>`  
**Learning:** <what changed in current understanding>  
**Straightforward corrections attempted:** <None or concise list>  
**Next route under TID:** <next experiment / area complete / TID review required>  
**Boundary checkpoint:** <None or owner decision + reference>

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

<State the evidence-backed technical specification downstream engineering may rely on.>

### Not feasible

<State the evidence showing the Required Outcome cannot be achieved within approved constraints and the resulting decision required.>

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
**Required next action:** <next TID experiment, TID review/owner boundary decision, final validation, or final PR>
