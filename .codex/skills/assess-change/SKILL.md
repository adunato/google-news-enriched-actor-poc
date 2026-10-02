---
name: assess-change
description: Select the proportional Development Lifecycle path for a ready Feature/Bug Issue, including whether a material technical unknown requires a prerequisite iterative Technical Spike before design/planning.
---

# Assess Change

Determine the minimum discovery/design/planning path required for a development-ready Feature/Bug Issue.

Inspect:

- the Issue, acceptance criteria and validation expectations;
- `docs/product.md`;
- `docs/architecture.md`;
- relevant source code, tests, configuration and repository patterns;
- material dependencies and integration boundaries.

Decide in this order whether the change requires:

1. a prerequisite Technical Spike;
2. after any required Spike is complete, an HLD;
3. an Implementation Plan.

Do not create a separate assessment document. Update the originating Issue's `Development Lifecycle Assessment` section.

Record:

- Technical Spike: `Required` or `Not required`, with rationale, prerequisite Issue and status;
- HLD: `Required` or `Not required` only after required Spike completion; otherwise `Deferred pending Technical Spike`;
- Implementation Plan: `Required` or `Not required` only after required Spike completion; otherwise `Deferred pending Technical Spike`;
- LLD: `Deferred pending Technical Spike` while blocked; otherwise `Deferred to Implementation Plan` when a Plan is required or `Not applicable`;
- material risks;
- exact next lifecycle step.

## When a Technical Spike is required

Require a Technical Spike when downstream design cannot responsibly be chosen because a material fact about the real technical boundary is unknown and must be established empirically. Typical triggers include:

- an undocumented or reverse-engineered external interface/protocol central to the feature;
- unknown consent, authentication, anti-bot, redirect, permission, rate-limit, regional, account or runtime behaviour that may determine viability;
- a volatile third-party/live-data boundary whose current behaviour has not been demonstrated in representative environments;
- multiple fundamentally different integration approaches whose feasibility cannot be compared from existing evidence;
- community/third-party code being the principal source for a supposed integration specification;
- a core capability whose feasibility or approved dependency model is not established.

Do **not** require a Spike for every uncertainty. Keep a bounded feasibility gate inside HLD/Implementation Planning when the external/runtime behaviour is already sufficiently understood and a small probe only confirms a residual implementation assumption.

When a Spike is required, create or link **one controlling Technical Spike Issue** using the canonical template. Set the downstream Feature/Bug HLD, Implementation Plan and LLD to deferred and stop downstream assessment.

The dedicated Spike lifecycle then proceeds through: workspace/branch setup → Technical Investigation Design → Spike Implementation Plan → bounded Technical Spike experiments. These are Spike-specific artifacts and do not replace the downstream Feature/Bug HLD/Implementation Plan/LLD.

If a controlling Spike already exists and is still open, keep using it. A failed/inconclusive experiment inside that Spike is not grounds for a serial replacement Spike.

## Returning from a Spike

Rerun `assess-change` only after the controlling Spike reaches a supported final conclusion and its final evidence has been integrated.

Read the integrated Spike artifacts:

- `docs/changes/<spike-issue>/technical-investigation-design.md`;
- `docs/changes/<spike-issue>/spike-implementation-plan.md`;
- `docs/changes/<spike-issue>/technical-spike.md`.

- If the Spike conclusion is `Feasible`, record Technical Spike `Required / Complete`, reference the Spike, and decide downstream HLD/Implementation Plan depth from the supported technical specification.
- If the Spike conclusion is `Not feasible`, keep production implementation blocked and route the result to the required Product Definition, Architecture Definition or POC decision. Do not silently relax requirements or constraints.
- If the Spike is still open, do not continue downstream assessment.

Require an HLD when a material design decision remains after the Spike, including significant product behaviour, durable architecture, interface/integration, data/state, cross-component, security, reliability, performance, cost, compatibility, or competing-design implications.

Require an Implementation Plan when repository-level sequencing, coordination, migration, validation complexity, external/live evidence, bounded residual feasibility gating, or implementation risk warrants planning before editing. A Plan may be required without an HLD.

A Plan is required when representative acceptance evidence must be deliberately sequenced or when a **bounded residual** assumption needs a pre-implementation feasibility gate. Do not use an Implementation Plan feasibility gate as a substitute for a Technical Spike when the unknown determines the fundamental integration specification or viability.

LLD remains a decision made by an approved Implementation Plan.

If the Feature/Bug Issue itself is not ready, return to Issue refinement rather than compensating for missing requirements with design assumptions.

## Completion contract

Report the Issue, readiness state, Technical Spike decision/rationale/prerequisite/status, HLD decision and rationale (or deferral), Implementation Plan decision and rationale (or deferral), LLD status, likely durable Product/Architecture impact, material risks/dependencies, validation complexity, and exact next lifecycle step. Confirm the Issue's `Development Lifecycle Assessment` section has been updated when write access is available.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or implementation methodology. When a reusable lesson exists, use `capture-learning`; otherwise report `Learnings: None`.
