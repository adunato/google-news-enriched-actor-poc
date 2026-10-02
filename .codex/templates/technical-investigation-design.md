# Technical Investigation Design: <question / boundary>

> Canonical top-down design artifact for a Technical Spike. It defines the technical search space and investigation strategy before individual experiments are approved. It is not a production HLD and does not record experiment chronology.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<#issue or URL>`  
**Spike branch:** `<branch>`  
**Blocked downstream Issue(s):** `<#issue(s) or URL(s)>`  
**Product Definition:** `<path / requirement references or None>`  
**Architecture Definition:** `<path / section references or None>`

## 1. Investigation Objective

<State the Technical Question, why it matters to downstream engineering, and what decision this investigation must enable.>

## 2. Current Understanding

### Established facts

- <authoritative specification or directly observed fact>
- <validated prior evidence>

### Material unknowns

- <unknown that must be resolved>

### Relevant prior evidence

<Summarize only evidence that materially shapes the investigation. Reference historical artifacts rather than reproducing their chronology.>

## 3. Investigation Structure

Break the question into stable workstreams only when that improves clarity. A simple Spike may have one workstream.

| ID  | Workstream / boundary | Question to resolve | Dependency          |
| --- | --------------------- | ------------------- | ------------------- |
| W1  | <boundary>            | <question>          | <None / dependency> |

## 4. Candidate Approaches

Identify the materially credible technical approaches for each workstream. These are high-level approaches, not individual hypotheses or experiments.

| ID  | Workstream | Approach   | Technical shape / mechanism  | Why credible         | Material constraints / weakness | Initial disposition                                              |
| --- | ---------- | ---------- | ---------------------------- | -------------------- | ------------------------------- | ---------------------------------------------------------------- |
| A1  | W1         | <approach> | <how it works at high level> | <evidence/rationale> | <constraint>                    | <Primary / Fallback / Reference only / Deprioritised / Rejected> |

Third-party/community implementations are evidence about possible approaches; they are not authoritative specifications unless the provider explicitly documents them as such.

## 5. Investigation Strategy

For each workstream, define how the candidate set should be traversed without prescribing individual experiments.

State:

- which approach is investigated first and why;
- whether other approaches are mandatory comparisons or fallbacks;
- the condition under which an approach has been tested sufficiently;
- the condition for moving to another approach;
- when the workstream can stop because its required outcome is demonstrated;
- when the investigation must return for TID review rather than adding a new direction implicitly.

## 6. Evidence and Decision Criteria

Define the evidence needed to answer the Technical Question, including representative environment/data and quantitative thresholds where applicable.

| Workstream | Required evidence | Success / exit criterion | Not-feasible / escalation condition |
| ---------- | ----------------- | ------------------------ | ----------------------------------- |
| W1         | <evidence>        | <criterion>              | <condition>                         |

## 7. Boundaries and Non-Goals

- <approved constraint or excluded direction>
- <technique that must not be introduced implicitly>

## 8. Design-Change Rule

The Spike may generate hypotheses and diagnostic experiments inside the approved TID. If evidence materially changes the workstream decomposition, candidate set, architectural mechanism, constraints, or investigation strategy, stop and update/review the TID before continuing.

## 9. Open Questions

<List design-level questions that must be resolved before approval. Do not put iteration-level hypotheses here. If none: “No outstanding investigation-design questions.”>

## 10. Summary and Approval

### Key decisions

- <workstream / candidate decision>
- <boundary / evidence decision>

### Approval

**Decision:** `<Approve | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up before Spike execution:** `<actions or None>`

### Completion contract

The TID is ready for approval when the technical question is decomposed sufficiently, the credible candidate approaches are understood and prioritised, investigation/transition rules and evidence criteria are explicit, and no material investigation-design decision remains unresolved. Individual hypotheses and experiment procedures belong in `technical-spike.md`, not this artifact.
