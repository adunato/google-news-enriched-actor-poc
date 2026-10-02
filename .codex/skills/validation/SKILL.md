---
name: validation
description: Validate Feature/Bug implementation or a Technical Spike experiment/final conclusion against its acceptance/evidence criteria and required artifacts.
---

# Validation

Use the GitHub Issue as the primary acceptance/evidence contract.

For Feature/Bug work, also use any completed prerequisite Technical Spike, HLD, Implementation Plan, LLD, current Product/Architecture definitions, implementation hand-off, repository tests, and relevant operating-model quality rules.

For a Technical Spike, use:

- the controlling Issue and Required Outcome;
- the approved Technical Investigation Design;
- the approved Spike Implementation Plan;
- `docs/changes/<issue>/technical-spike.md`;
- retained experiment evidence/probes;
- Product/Architecture constraints;
- repository validation relevant to committed tooling.

## Feature/Bug validation

Validate changed behaviour, regression risk, edge cases, errors, user/system flows and material integration boundaries. Trace every material acceptance criterion to explicit evidence.

Use evidence at the boundary of the claim. Mocked tests can validate local logic and deterministic behaviour but cannot prove that a material external/live/runtime boundary actually works. Required representative live/in-environment evidence must be executed across the defined scenario matrix.

A failed required acceptance test places the tested candidate in `Hold`. Do not rerun the same unchanged candidate merely to seek a passing result. Before retesting, identify the failure cause, make and record a relevant correction, then test the corrected state.

If Feature/Bug validation exposes a material product, architecture, scope, design or previously hidden unknown-integration problem, stop and return to the appropriate Issue/Technical Spike/design/planning stage.

## Technical Spike experiment validation

An experiment is valid when:

- it was explicitly owner-approved;
- it stayed within the approved TID workstream/option and Spike Implementation Plan route;
- the experiment executed within its stated bounds;
- any autonomous correction was genuinely straightforward and did not change the experiment's meaning;
- representative environment/data requirements were met;
- observations and inference are separated;
- retained evidence supports the recorded result;
- limitations/variability are explicit;
- `technical-spike.md` is updated consistently.

Classify the experiment as `Supported`, `Rejected`, or `Inconclusive`.

Validation must flag a methodology breach when the agent deepened troubleshooting after an Experiment Viability Checkpoint should have triggered, or introduced a new technical direction without TID/plan review.

A valid experiment may still leave the Spike open:

**Iteration valid / Spike remains open**

## Technical Spike final validation

A Spike is ready for its final integration PR only when:

- the original Technical Question is resolved;
- the Required Outcome is demonstrated or shown not feasible within approved constraints;
- TID workstreams/options and evidence boundaries remain current or approved revisions are present;
- the Spike Implementation Plan's transitions/fallbacks were followed or deviations were explicitly approved;
- experiment-level owner approvals and viability decisions are traceable;
- the Supported Technical Specification contains only evidence-backed behaviour;
- representative variability/limitations are explicit;
- the final conclusion is `Feasible` or `Not feasible`;
- downstream implications and required reassessment/product decision are explicit.

Do not validate a Spike as complete merely because repository CI is green, a probe ran successfully or one experiment finished.

If the original question remains unresolved, result is **Hold — Spike remains open**.

## Completion report contract

Report the Issue/type, validation scope (`Feature/Bug`, `Spike experiment`, or `Spike final`), criterion-to-evidence results, representative scenario coverage, observed versus inferred evidence, tests/probes/reruns, corrections, experiment-viability status, outstanding questions, durable-document consistency, and explicit result:

- `Pass`;
- `Iteration valid / Spike remains open`;
- `Hold`.

For final Spike validation, explicitly state whether the branch is **Ready for final integration PR**.

## Learning checkpoint

Consider whether validation exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
