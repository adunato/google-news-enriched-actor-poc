---
name: technical-spike
description: Execute an approved Technical Spike TID autonomously through its bounded experiment sequence while recording evidence and stopping when execution would leave the approved design.
---

# Technical Spike

Use this skill only for a GitHub Technical Spike Issue.

The **Issue is the central work item**. The dedicated Spike branch is the working container. Do not open a pull request while the investigation is active.

## Required inputs

Before execution, read and confirm:

- the controlling Technical Spike Issue;
- approved `docs/changes/<issue>/technical-investigation-design.md`;
- `docs/changes/<issue>/technical-spike.md`;
- blocked downstream Issue(s);
- Product Definition and Architecture Definition;
- relevant source, tests, configuration and retained evidence.

If the TID is missing or unapproved, create/complete it through `technical-investigation-design` before executing experiments.

## Authority model

The Issue defines **what must be answered**.

The approved TID defines **what experiments are authorised, why they exist, their order/conditionality, evidence criteria, boundaries and mechanical next-step rules**.

`technical-spike.md` records **what was executed, the evidence produced, the current understanding and the next TID route**.

Do not create a second execution plan or allow chronological experiment history to redefine the TID implicitly.

## Execution model

TID approval authorises execution of its defined bounded experiment sequence. **Do not stop for owner approval before every experiment.**

For each experiment:

1. confirm its `Run when` condition is satisfied;
2. execute the test defined by the TID within its stated constraints;
3. record evidence and classify the result as `Supported`, `Rejected` or `Inconclusive`;
4. update `technical-spike.md`;
5. follow the TID's stated next-step rule automatically.

Conditional experiments are skipped when their trigger is not met. Do not run every experiment merely because it exists in the TID.

A failed required acceptance run remains failed for that code/configuration. Do not rerun it unchanged merely to seek a pass.

## Straightforward corrections

The agent may autonomously make a straightforward correction required to complete an authorised experiment when it does not materially change:

- the experiment objective or mechanism;
- architecture, dependency or runtime shape;
- scope, cost or risk;
- representative environment/data;
- success criteria or what the resulting evidence would mean.

Examples include correcting a typo, malformed fixture, obvious invocation defect or equivalent mechanical error.

## Boundary checkpoint

Stop and return to the owner when continuing would require:

- a new experiment not defined by the TID;
- a materially different mechanism, dependency, runtime, architecture, infrastructure/security model or scope;
- changing representative data, success criteria or evidence meaning;
- more than a straightforward correction because troubleshooting has become a distinct investigation;
- a Product/Architecture constraint change;
- effort disproportionate to the information value of the current experiment.

Do not turn the checkpoint into a micro-approval for the next experiment already authorised by the TID.

### Owner-facing checkpoint contract

When a boundary checkpoint is required, make it self-contained. The owner should not need to open repository artifacts or remember recent history.

Use these headings:

1. `## Product and Issue context`
2. `## Why this Spike exists`
3. `## What we have learned so far`
4. `## What would need to change`
5. `## Direction and complexity check`
6. `## Recommendation`
7. `## Decision requested`

Explain capability names before Issue numbers and explain technical mechanisms in ordinary language before technical terminology. Do not use experiment IDs, branch names, libraries or internal mechanism names as substitutes for explanation.

The decision requested should be a genuine boundary decision such as `Revise the TID and continue`, `Change Product/Architecture constraints`, or `Stop the investigation`.

## Evidence discipline

Record enough evidence for another executor to reconstruct:

- what TID experiment was executed and why it was eligible;
- environment/data and material operational bounds;
- observations separately from interpretation;
- result and limitations;
- the TID rule that determined the next route;
- straightforward corrections attempted;
- any boundary checkpoint and owner decision.

Historical evidence may be reused when the TID says it remains valid. Do not recreate evidence without information value.

## Final conclusion

A Spike concludes only as:

- **Feasible** — representative evidence supports a technical specification sufficiently for downstream design; or
- **Not feasible** — representative evidence shows the Required Outcome cannot be achieved within approved constraints.

An individual failed/inconclusive experiment is not a terminal Spike state.

Before final integration:

- reconcile the TID if execution revealed any approved design amendment;
- ensure `technical-spike.md` contains the supported technical specification or infeasibility evidence;
- validate the final Spike;
- make downstream implications explicit.

Only after a supported conclusion and final validation should `merge-change` create the final integration PR.

## Completion contract

Report the current TID experiment/area in plain language, experiment result/evidence, next route under the TID, whether a boundary checkpoint is required, current Spike conclusion state and any downstream implication.

## Learning checkpoint

Consider whether execution exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
