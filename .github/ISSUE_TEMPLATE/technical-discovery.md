# Technical Discovery Issue

## Technical Question

<State the concrete technical question or decision that must be answered before downstream design or implementation can proceed.>

## Why Discovery Is Required

<Describe the material unknown boundary and why existing documentation, specifications, repository evidence, or prior implementations are insufficient. Identify the downstream Feature/Bug Issue(s) this discovery blocks.>

## Investigation Scope

### In scope

- <behaviour, protocol, environment, integration path, alternative, or hypothesis to investigate>
- <item>

### Out of scope

- <production implementation, product expansion, unrelated optimisation, or other excluded work>

## Evidence and Exit Criteria

- [ ] <representative environment/data/probe evidence required to answer the question>
- [ ] <material alternatives or hypotheses compared where applicable>
- [ ] <observed behaviour distinguished from inference, third-party claims, and undocumented assumptions>
- [ ] <constraints, failure modes, variability, and limitations recorded>
- [ ] <conclusion is one of Feasible / Not feasible / Inconclusive and is supported by retained evidence>
- [ ] <downstream Issue implications and required reassessment are explicit>

## Constraints

<Approved product/architecture boundaries, safety/cost limits, environments, credentials, prohibited techniques, or other constraints.>

## Downstream Dependencies

<Feature/Bug Issue references blocked by this discovery. At least one downstream Issue should normally be identified.>

## Evidence Artifact

Create `docs/changes/<issue-number>/technical-discovery.md` from the canonical Technical Discovery template.

## Discovery Lifecycle

- **Execution path:** Technical Discovery
- **Production implementation:** Prohibited in this Issue unless separately approved as reusable non-product tooling
- **Next lifecycle step:** Execute the `technical-discovery` skill, validate the evidence/exit criteria, integrate the discovery evidence, then rerun `assess-change` on every blocked downstream Issue.
