---
name: implementation-plan
description: Produce a practical change-specific implementation plan when the Development Lifecycle requires one, with an explicit LLD decision.
---

# Implementation Plan

Use the canonical `.codex/templates/implementation-plan.md` template when the Development Lifecycle requires an implementation plan.

Start from the GitHub Issue, repository inspection, completed prerequisite Technical Discovery when required, and the approved HLD when one was required. An implementation plan may also be created without an HLD when the change needs repository-level sequencing or coordination but no material design decision; record `HLD reference: Not required` and explain why.

Define the practical implementation areas, sequencing, dependencies, integrity checks, acceptance-evidence strategy, bounded residual feasibility gates, representative end-to-end/live coverage, and repository-specific constraints. Keep the plan proportional and avoid turning it into a line-by-line patch description.

Map every material acceptance criterion to evidence at the lowest test level that can actually prove the claim. Unit, mocked integration, and contract tests may prove local logic and failure handling, but they cannot substitute for representative live/in-environment evidence when successful interaction with the real external/runtime boundary is itself required.

For materially variable integrations, define a representative scenario matrix covering the dimensions that could invalidate acceptance. Do not reduce this to one arbitrary smoke test.

Do not use the Implementation Plan to absorb a material unresolved external-system, live-data, protocol, platform, permission, or runtime question. Required Technical Discovery must already be complete and integrated. Plan-level feasibility gates are reserved for bounded residual assumptions inside an established design space; put those gates before dependent implementation and define the stop/return path if they fail.

The plan must explicitly state `LLD required: Yes | No`. Require an LLD only when file-level design, cross-file coupling, or repository-specific implementation risk cannot be represented clearly enough in the Issue, HLD (if present), and plan.

The skill prepares the plan and identifies unresolved implementation decisions; it must not infer project-owner approval where explicit approval is required. Do not approve a plan while required Technical Discovery is incomplete/inconclusive or while a material discovery question has merely been relabelled as a plan feasibility gate or deferred to end-of-development validation.

## Completion contract

Report the plan path/ID, originating Issue, Technical Discovery reference/status or omission rationale, HLD reference or omission rationale, repository findings, implementation sequence, acceptance-evidence matrix, bounded residual feasibility gates, representative end-to-end/live coverage, integrity checks, explicit LLD decision and rationale, open questions, and approval state. Do not begin substantial dependent implementation while a material planning decision, feasibility gate, or required approval remains unresolved.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
