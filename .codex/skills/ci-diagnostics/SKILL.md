---
name: ci-diagnostics
description: Diagnose failed CI or deployment checks, classify the failure, reproduce it where practical and route corrective work through the existing Issue-centred lifecycle without weakening controls.
---

# CI Diagnostics

Diagnose a failed GitHub Actions, build, validation, staging, or deployment check without treating the failure itself as permission to change arbitrary code or controls.

Inspect the failing run/check, relevant logs, commit/PR, originating Issue, current change artifacts, repository validation command, and affected workflow/configuration.

Where practical, reproduce the failure locally using the same underlying repository command or controlled environment assumptions.

Classify the failure as one of:

- implementation-caused;
- pre-existing;
- environment/configuration;
- external dependency/platform;
- intermittent/flaky;
- CI/workflow defect;
- unresolved.

For an implementation-caused failure within the active Issue scope, correct it through the existing change branch and rerun the applicable checks.

If correction would expand product scope, change durable architecture, alter a release candidate outside the approved fix path, or address unrelated existing work, create/report a separate Issue or return to the relevant lifecycle decision instead of absorbing it silently.

Do not disable tests, reduce coverage of required behaviour, remove required checks, weaken branch protection, expose secrets, or add retries solely to hide a deterministic failure.

A flaky or external failure may be retried only when the evidence supports that classification; retain the original failure evidence.

## Completion contract

Report the failing check/run, affected commit/PR/release, classification with evidence, reproduction result, corrective action taken or required, rerun status, related Issue, and whether the delivery gate is now green or remains blocked.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
