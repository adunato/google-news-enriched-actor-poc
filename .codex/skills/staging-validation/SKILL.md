---
name: staging-validation
description: Validate a deployed release candidate in staging or the closest available pre-production environment and produce explicit promotion evidence without patching the environment ad hoc.
---

# Staging Validation

Validate the deployed release candidate after promotion to the staging/pre-production environment.

Use the exact release candidate identity, Architecture Definition, relevant release/change context, repository workflows, platform runtime evidence, and Chapter 7 staging-validation expectations.

Staging re-proves the deployed candidate at boundaries that repository-local validation cannot establish and repeats critical real-world flows where deployment state can change the outcome. It must not be used as the first proof of a feature's basic external feasibility when representative evidence was practical earlier in the change lifecycle. If a material acceptance check genuinely can run only in staging, the Issue/Implementation Plan must have identified that deferred blocking gate explicitly.

Select only the staging checks that are material to the product and release. These may include:

- deployment smoke tests;
- critical end-to-end execution paths;
- external integrations;
- environment/runtime configuration;
- persistence/data flow;
- authentication/permissions/secrets integration;
- logging and operational visibility;
- platform-specific execution behaviour;
- charging, billing, metering, or commercial mechanics.

Automate where reliable and proportionate. Use a representative scenario set for materially variable external integrations rather than a single token smoke test. Record required manual evidence explicitly where automation would add disproportionate complexity.

Do not patch application code directly in staging. If a software or version-controlled configuration correction is required, create or identify a Bug Issue and route it through the release-fix lifecycle from the active release branch.

If staging reveals that the assumed external/runtime contract itself was not established — for example an undocumented integration behaves fundamentally differently in the deployed environment — classify that as a Technical Spike need rather than a normal release defect. Hold promotion, create/link the prerequisite Spike Issue, and return the affected downstream Issue/release scope to reassessment.

Use the CI Diagnostics skill when a failed automated staging/deployment check needs diagnosis.

A candidate is promotion-ready only when every required staging check is passed or explicitly not applicable and no known release blocker remains.

## Completion contract

Report the release candidate/version, deployed staging identity, checks executed, automated/manual evidence, failures and their classification, Bug or Technical Spike Issues created/referenced, retest results, remaining blockers, and the explicit staging validation result: `Pass` or `Hold`.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
