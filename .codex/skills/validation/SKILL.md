---
name: validation
description: Validate a Feature/Bug implementation or Technical Discovery Issue against its acceptance/evidence criteria and required artifacts, rectifying in-scope gaps proportionately.
---

# Validation

Use the GitHub Issue as the primary acceptance/evidence contract.

For Feature/Bug work, also use completed prerequisite Technical Discovery when required, HLD, implementation plan, LLD, current Product/Architecture definitions, implementation hand-off, repository tests, and relevant operating-model quality rules.

For a Technical Discovery Issue, use its evidence/exit criteria, `docs/changes/<issue>/technical-discovery.md`, retained evidence/probes, Product/Architecture constraints, and repository validation relevant to any committed tooling.

For Feature/Bug work, validate changed behaviour, regression risk, edge cases, errors, user/system flows, and material integration boundaries. Trace every material acceptance criterion to explicit evidence. Add or extend proportionate unit, integration, API, contract, component, or end-to-end tests; do not introduce disproportionate infrastructure merely for ceremony.

Use evidence at the boundary of the claim. Mocked tests can validate local logic, deterministic parsing, error handling, and contracts, but they do not establish that a material external system, live-data source, deployed runtime, or platform integration actually works. Where the Issue or plan requires representative live/in-environment evidence, execute that evidence across the defined scenario matrix. A failed or incomplete required live/end-to-end check is an acceptance failure and the change remains on hold.

For Technical Discovery, validate that representative environments/data were actually exercised, observations are reproducible and distinguished from inference, material alternatives/hypotheses were treated proportionately, limitations are explicit, and the Feasible / Not feasible / Inconclusive conclusion follows from retained evidence. Do not validate a discovery as successful merely because a probe ran or repository CI is green.

For Feature/Bug work, run change-specific tests first, including required bounded-feasibility/live/end-to-end checks at the stage where they are executable; rectify implementation defects within the approved scope, rerun affected tests, then run the relevant regression coverage. Do not weaken valid tests or replace a failed real-boundary check with a passing mock.

If Feature/Bug validation exposes a material product, architecture, scope, design, or previously hidden technical-discovery need, stop and return to the appropriate Issue/discovery/design/planning stage. If discovery validation shows the question remains unresolved, record `Inconclusive`; do not convert uncertainty into a passing result. Before hand-off for integration, confirm that any required Product Definition or Architecture Definition update is present and consistent with the implemented behaviour.

## Completion report contract

Report the Issue reference/type, acceptance-or-exit-criterion-to-evidence results, validation performed and coverage, representative scenario coverage, observed versus inferred evidence (and mocked versus live/in-environment evidence where relevant), tests/probes and reruns, every in-scope correction, outstanding failures or unresolved questions, manual validation still required, and durable-document consistency. State the validation result explicitly as `Pass` or `Hold`. Explicitly state `No additional manual validation is required.` when applicable.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
