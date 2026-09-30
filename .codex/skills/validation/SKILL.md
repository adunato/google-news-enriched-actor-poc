---
name: validation
description: Validate Feature/Bug implementation or a Technical Spike iteration/final conclusion against its acceptance/evidence criteria and required artifacts.
---

# Validation

Use the GitHub Issue as the primary acceptance/evidence contract.

For Feature/Bug work, also use any completed prerequisite Technical Spike, HLD, Implementation Plan, LLD, current Product/Architecture definitions, implementation hand-off, repository tests, and relevant operating-model quality rules.

For a Technical Spike, use its stable Technical Question/Required Outcome, `docs/changes/<issue>/technical-spike.md`, retained experiment evidence/probes, Product/Architecture constraints, and repository validation relevant to committed tooling.

## Feature/Bug validation

Validate changed behaviour, regression risk, edge cases, errors, user/system flows and material integration boundaries. Trace every material acceptance criterion to explicit evidence.

Use evidence at the boundary of the claim. Mocked tests can validate local logic and deterministic behaviour but cannot prove that a material external/live/runtime boundary actually works. Required representative live/in-environment evidence must be executed across the defined scenario matrix.

A failed required acceptance test places the tested candidate in `Hold`. Do not rerun the same unchanged candidate merely to seek a passing result, and do not treat a later pass on that unchanged candidate as superseding the failure. Before retesting, identify the failure cause, make and record a relevant correction to the candidate, acceptance-relevant configuration/environment, test or evidence path, then test the corrected state.

If Feature/Bug validation exposes a material product, architecture, scope, design or previously hidden unknown-integration problem, stop and return to the appropriate Issue/Technical Spike/design/planning stage.

## Technical Spike iteration validation

Before validating the first experimental iteration, confirm the living Spike artifact contains a proportionate option scan, a materially credible ranked option set, and a reasoned selection of the current option. This is a bounded technical search, not an exhaustive research requirement.

When repeated, stubborn or surprising failures materially question the selected option, validation must also confirm that the proposed next step includes an option-viability checkpoint rather than automatically deepening candidate-specific diagnostics. The checkpoint should use proportionate upstream/community evidence to distinguish environment-specific failure from candidate-level weakness and should explicitly decide whether to continue, deprioritise or reject the option.

An individual Spike iteration is valid when:

- the approved hypothesis/experiment was executed within its stated bounds;
- representative environment/data requirements for that iteration were met;
- observations and inference are clearly separated;
- retained evidence supports the recorded experiment result;
- limitations/variability are explicit;
- the living Spike document has been updated consistently, including option status where material;
- the proposed next iteration follows from the evidence and does not continue a materially doubtful option without the required viability reassessment.

Classify an experiment result as `Supported`, `Rejected`, or `Inconclusive`.

An `Inconclusive` experiment is **not a failed lifecycle state** and is not a reason to close the Spike. Validation may report:

**Iteration valid / Spike remains open**

when the experiment was correctly executed but the original Technical Question is unresolved.

## Technical Spike final validation

A Spike may be validated as ready to close only when:

- the original Technical Question is resolved;
- the Required Outcome is either demonstrated or shown not feasible within the approved constraints;
- the initial option scan was proportionate to the bounded question and material credible options were prioritised explicitly;
- material selected options/hypotheses were investigated proportionately;
- the Supported Technical Specification contains only evidence-backed behaviour;
- representative variability/limitations are explicit;
- the final conclusion is `Feasible` or `Not feasible`;
- downstream implications and required reassessment/product decision are explicit.

Do not validate a Spike as complete merely because repository CI is green, a probe ran successfully, or one experiment has finished.

If the original question remains unresolved, validation result is **Hold — Spike remains open** even when the current iteration itself is valid.

Before Feature/Bug hand-off, confirm required Product/Architecture updates are present and consistent. Before final Spike hand-off, confirm any durable Product/Architecture implication is explicitly routed rather than silently applied.

## Completion report contract

Report the Issue/type, validation scope (`Feature/Bug`, `Spike iteration`, or `Spike final`), criterion-to-evidence results, representative scenario coverage, observed versus inferred evidence, tests/probes/reruns, corrections, outstanding questions, manual validation still required, durable-document consistency, and explicit result:

- `Pass`;
- `Iteration valid / Spike remains open`;
- `Hold`.

Explicitly state `No additional manual validation is required.` when applicable.

## Learning checkpoint

Consider whether validation exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
