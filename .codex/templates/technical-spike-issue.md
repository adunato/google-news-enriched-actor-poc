# Technical Spike Issue

## Technical Question

<State the single technical question that must be answered before downstream design or implementation can proceed. Keep this stable for the lifetime of the Spike.>

## Why a Spike Is Required

<Explain why authoritative documentation/current repository evidence is insufficient and why empirical investigation is needed. Identify the downstream Feature/Bug Issue(s) this Spike blocks.>

## Required Outcome

<State what must be known well enough for downstream engineering to proceed. This is the Spike completion condition, not a proposed solution.>

## Starting Evidence

- <established fact, prior evidence, or authoritative specification>
- <relevant failed attempt or unresolved observation>

## Constraints

<Approved product/architecture boundaries, environments, cost/safety limits, credentials, prohibited techniques, or other non-negotiable constraints.>

## Investigation Boundary and Known Leads

<State the intended Spike depth and any owner constraint, for example a lightweight/proportionate technical search rather than broad domain research. If no special constraint exists, state "Proportionate to the bounded Technical Question".>

<List known leads, sources or candidate approaches worth considering. These are inputs to the Technical Investigation Design, not selected solutions or committed hypotheses.>

## Completion Criteria

- [ ] The original Technical Question is answered with evidence sufficient for downstream design, or the required outcome is shown not feasible within the approved constraints.
- [ ] The Technical Investigation Design represents the material technical search space and evidence boundaries.
- [ ] The Spike Implementation Plan defines the approved workstream/option traversal and fallback rules.
- [ ] `technical-spike.md` records the experiment history, material failed hypotheses, representative evidence, limitations and supported technical specification.
- [ ] Any final Feasible conclusion states exactly what downstream engineering may rely on.
- [ ] Any final Not feasible conclusion states exactly which requirement/constraint cannot be satisfied and the required Product/Architecture/POC decision.
- [ ] Blocked downstream Issue(s) and required reassessment are explicit.

An individual failed or inconclusive experiment does **not** complete this Spike.

## Downstream Dependencies

<Feature/Bug Issue references blocked by this Spike. At least one downstream Issue should normally be identified.>

## Spike Artifacts

Use one dedicated Spike branch/workspace and maintain:

- `docs/changes/<issue-number>/technical-investigation-design.md`;
- `docs/changes/<issue-number>/spike-implementation-plan.md`;
- `docs/changes/<issue-number>/technical-spike.md`;
- experiment-specific probes/evidence only when useful for reproducibility.

The GitHub Issue is the central management/tracking object. Do **not** open a pull request for ordinary in-progress Spike execution. Create the integration PR only after the Spike reaches a supported final conclusion and final validation passes.

## Spike Lifecycle

- **Execution path:** Technical Spike.
- **Production implementation:** Prohibited unless separately approved as reusable non-product tooling.
- **Investigation design:** Create and approve the Technical Investigation Design before Spike Implementation Planning.
- **Execution planning:** Create and approve the Spike Implementation Plan before the first experiment.
- **Experiment boundary:** One owner-approved experiment at a time. The agent may make only straightforward corrections needed to complete that exact experiment.
- **Troubleshooting boundary:** When fixing the approved experiment becomes non-trivial, introduces a new diagnostic direction/machinery/dependency, or becomes disproportionate to the experiment's information value, stop at an Experiment Viability Checkpoint and seek owner direction.
- **Completion:** Keep this Issue open until the original Technical Question is resolved with a supported `Feasible` or `Not feasible` conclusion.
- **Integration:** After final validation, create the final PR, integrate the Spike evidence, then rerun `assess-change` on every blocked downstream Issue.
