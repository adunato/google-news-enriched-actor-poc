---
name: validation
description: Validate Feature/Bug implementation or a Technical Spike experiment/final conclusion against its controlling artifacts and required evidence.
---

# Validation

Use the GitHub Issue as the primary acceptance/evidence contract.

For Feature/Bug work, also use any completed prerequisite Technical Spike, HLD, Implementation Plan, LLD, current Product/Architecture definitions, implementation hand-off, repository tests and relevant operating-model quality rules.

For a Technical Spike, use:

- the controlling Issue;
- approved Technical Investigation Design;
- `docs/changes/<issue>/technical-spike.md`;
- retained experiment evidence/probes;
- Product/Architecture constraints;
- repository validation relevant to committed tooling.

## Feature/Bug validation

Validate changed behaviour, regression risk, edge cases, errors, user/system flows and material integration boundaries. Trace every material acceptance criterion to explicit evidence.

Use evidence at the boundary of the claim. Mocked tests can validate local logic but cannot prove that a material external/live/runtime boundary actually works. Required representative live/in-environment evidence must be executed across the defined scenario matrix.

A failed required acceptance test places the candidate in `Hold`. Do not rerun the same unchanged candidate merely to seek a pass.

If validation exposes a material product, architecture, scope, design or previously hidden unknown-integration problem, stop and return to the appropriate Issue/Technical Spike/design/planning stage.

## Technical Spike experiment validation

An individual experiment is valid when:

- it is an experiment authorised by the approved TID and its `Run when` condition was satisfied;
- the defined experiment was executed within its approved bounds;
- any autonomous correction was genuinely straightforward and did not change the hypothesis, mechanism, architecture/dependencies, evidence meaning, scope or risk;
- representative environment/data requirements were met;
- observations and inference are separated;
- retained evidence supports the recorded result;
- limitations/variability are explicit;
- `technical-spike.md` is updated consistently.

Classify the result as `Supported`, `Rejected` or `Inconclusive`.

If troubleshooting ceased to be straightforward, validation must confirm that execution stopped for a **TID/owner boundary checkpoint** rather than continuing into an unplanned diagnostic direction.

Validation may report:

**Experiment valid / Spike remains open**

when the experiment was correctly executed but the original Technical Question remains unresolved.

## Technical Spike final validation

A Spike may be validated as ready to close only when:

- the original Technical Question is resolved;
- the Required Outcome is demonstrated or shown not feasible within approved constraints;
- the TID accurately captures the material experiments, route/conditionality, boundaries and evidence criteria;
- execution followed the approved TID route, including justified skips of conditional experiments;
- the Supported Technical Specification contains only evidence-backed behaviour;
- representative variability/limitations are explicit;
- the final conclusion is `Feasible` or `Not feasible`;
- downstream implications and required reassessment/product decision are explicit.

Do not validate a Spike as complete merely because repository checks are green or an individual experiment succeeded.

If the original question remains unresolved, result is **Hold — Spike remains open**.

After final Spike validation, the branch is eligible for the final integration PR through `merge-change`.

## Completion report contract

Report the Issue/type, validation scope (`Feature/Bug`, `Spike experiment`, or `Spike final`), criterion-to-evidence results, TID conformance, representative coverage, observed versus inferred evidence, tests/probes/corrections, any TID/owner boundary checkpoint, outstanding questions, durable-document consistency and explicit result:

- `Pass`;
- `Experiment valid / Spike remains open`;
- `Hold`.

Explicitly state `No additional manual validation is required.` when applicable.

## Learning checkpoint

Consider whether validation exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
