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

<State the intended Spike depth and any owner constraint. If no special constraint exists, state “Proportionate to the bounded Technical Question”.>

<List already-known sources, possible mechanisms or evidence worth considering in the Technical Investigation Design. These are leads, not a required taxonomy.>

- <known lead / source / mechanism>
- <known lead / source / mechanism>

## Completion Criteria

- [ ] The original Technical Question is answered with evidence sufficient for downstream design, or the Required Outcome is shown not feasible within the approved constraints.
- [ ] The Technical Investigation Design explains the problem/context, defines any useful Investigation Areas, specifies the bounded experiments, makes sequence/conditionality/branching explicit, and records evidence criteria and boundaries.
- [ ] `technical-spike.md` records the material experiment history, evidence, limitations and supported technical specification.
- [ ] Any final Feasible conclusion states exactly what downstream engineering may rely on.
- [ ] Any final Not feasible conclusion states exactly which requirement/constraint cannot be satisfied and the required Product/Architecture/POC decision.
- [ ] Blocked downstream Issue(s) and required reassessment are explicit.

An individual failed or inconclusive experiment does **not** complete this Spike.

## Downstream Dependencies

<Feature/Bug Issue references blocked by this Spike. At least one downstream Issue should normally be identified.>

## Spike Workspace and Artifacts

The **Issue is the central management/tracking object**.

Use one dedicated Spike branch/workspace, normally `spike/<issue-number>-<slug>`.

Create and maintain:

- `docs/changes/<issue-number>/technical-investigation-design.md`;
- `docs/changes/<issue-number>/technical-spike.md`;
- experiment-specific probes/evidence only where useful for reproducibility.

Do **not** open a pull request while the investigation is active. Create the final PR only after the Spike has a supported conclusion and passes final validation.

## Spike Lifecycle

- **Execution path:** Technical Spike.
- **Production implementation:** Prohibited unless separately approved as reusable non-product tooling.
- **Investigation design:** Complete and approve the Technical Investigation Design before experiment execution. The TID owns experiment definition, sequencing, conditional transitions, evidence criteria and boundaries.
- **Execution authority:** TID approval authorises the defined bounded experiment sequence; no separate approval is required for each experiment.
- **Straightforward correction:** The agent may correct an obvious mechanical defect needed to complete the current TID experiment only when the correction does not change its purpose, mechanism, architecture/dependencies, evidence meaning, scope or risk.
- **Boundary control:** Stop for owner/TID review when continuing requires an unplanned experiment, materially different mechanism/dependency/infrastructure/runtime, changed evidence meaning/threshold/scope, or troubleshooting becomes a distinct investigation.
- **Owner context:** Any boundary checkpoint must be self-contained from product/Issue context through evidence, proposed direction and the actual decision required.
- **Completion:** Keep this Issue open until the Technical Question has a supported `Feasible` or `Not feasible` conclusion.
- **Integration:** After final validation, create the final PR, integrate the Spike evidence, then rerun `assess-change` on every blocked downstream Issue.
