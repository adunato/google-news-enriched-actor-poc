---
name: validation
description: Validate an implemented GitHub Issue against its acceptance criteria and any required change artifacts, rectifying in-scope defects proportionately.
---

# Validation

Use the GitHub Issue as the primary acceptance contract. Also use the HLD, implementation plan, and LLD when those artifacts were required for the change, together with the current Product Definition, Architecture Definition, implementation hand-off, repository tests, and relevant operating-model quality rules.

Validate changed behaviour, regression risk, edge cases, errors, user/system flows, and material integration boundaries. Trace every material acceptance criterion to explicit evidence. Add or extend proportionate unit, integration, API, contract, component, or end-to-end tests; do not introduce disproportionate infrastructure merely for ceremony.

Use evidence at the boundary of the claim. Mocked tests can validate local logic, deterministic parsing, error handling, and contracts, but they do not establish that a material external system, live-data source, deployed runtime, or platform integration actually works. Where the Issue or plan requires representative live/in-environment evidence, execute that evidence across the defined scenario matrix. A failed or incomplete required live/end-to-end check is an acceptance failure and the change remains on hold.

Run change-specific tests first, including required feasibility/live/end-to-end checks at the stage where they are executable; rectify implementation defects within the approved scope, rerun affected tests, then run the relevant regression coverage. Do not weaken valid tests or replace a failed real-boundary check with a passing mock.

If validation exposes a material product, architecture, scope, or design change, stop and return to the appropriate Issue/design/planning artifact. Before hand-off for integration, confirm that any required Product Definition or Architecture Definition update is present and consistent with the implemented behaviour.

## Completion report contract

Report the Issue reference, acceptance-criterion-to-evidence results, validation performed and coverage, representative scenario coverage, mocked versus live/in-environment evidence, tests and reruns, every in-scope correction, outstanding failures classified as implementation/pre-existing/environment/intermittent, manual validation still required, and durable-document consistency. State the validation result explicitly as `Pass` or `Hold`. Explicitly state `No additional manual validation is required.` when applicable.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
