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

<List any already-known approaches, sources or evidence worth including in the initial option scan. These are leads, not selected solutions or committed hypotheses. The `technical-spike` lifecycle performs the proportionate option scan, prioritisation and hypothesis design in the living artifact.>

- <known lead / source / approach>
- <known lead / source / approach>

## Completion Criteria

- [ ] The original Technical Question is answered with evidence sufficient for downstream design, or the required outcome is shown not feasible within the approved constraints.
- [ ] The living Spike artifact records the investigation history, material failed hypotheses, representative evidence, limitations and current supported technical specification.
- [ ] Any final Feasible conclusion states exactly what downstream engineering may rely on.
- [ ] Any final Not feasible conclusion states exactly which requirement/constraint cannot be satisfied and the required Product/Architecture/POC decision.
- [ ] Blocked downstream Issue(s) and required reassessment are explicit.

An individual failed or inconclusive experiment does **not** complete this Spike. It updates the investigation and normally leads to the next hypothesis/experiment within the same Spike.

## Downstream Dependencies

<Feature/Bug Issue references blocked by this Spike. At least one downstream Issue should normally be identified.>

## Spike Artifact

Create and maintain `docs/changes/<issue-number>/technical-spike.md` from the canonical Technical Spike template.

## Spike Lifecycle

- **Execution path:** Technical Spike
- **Production implementation:** Prohibited unless separately approved as reusable non-product tooling.
- **Option selection:** Before the first experimental hypothesis, perform a proportionate option scan and prioritise the materially credible approaches in the living Spike artifact. Do not turn this bounded Spike into a broad research exercise.
- **Default iteration mode:** One approved iteration at a time. After each iteration, record the evidence, update the Spike artifact, decide whether the selected option remains viable, then recommend the best next hypothesis/experiment or return to the ranked option set. Diagnose blockers/prerequisites, state their impact and recovery path, and present the project owner with the exact approval/decision required. The checkpoint is an authorization boundary, not a transfer of investigative ownership.
- **Autonomous continuation:** Allowed only when the project owner explicitly authorizes it. Even then, stop before any material change to scope, constraints, dependency model, cost, product/architecture assumptions, safety/risk posture, or the original Technical Question.
- **Completion:** Keep this Issue open until the original Technical Question is resolved with a supported `Feasible` or `Not feasible` conclusion. Do not create serial Spike Issues merely because an experiment failed or was inconclusive.
- **Next lifecycle step after completion:** Integrate the final Spike evidence, then rerun `assess-change` on every blocked downstream Issue.
