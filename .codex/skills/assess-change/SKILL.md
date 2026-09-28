---
name: assess-change
description: Select the proportional Development Lifecycle path for a ready Feature/Bug Issue, including whether material technical unknowns require prerequisite Technical Discovery before design/planning.
---

# Assess Change

Determine the minimum change-design and planning path required for a development-ready GitHub Issue.

Inspect:

- the Issue, acceptance criteria, and validation expectations;
- `docs/product.md`;
- `docs/architecture.md`;
- relevant source code, tests, configuration and repository patterns;
- material dependencies and integration boundaries.

Decide in this order whether the change requires:

1. prerequisite Technical Discovery;
2. after any required discovery is complete, an HLD;
3. an Implementation Plan.

Do not create a separate assessment document. Update the originating Issue's `Development Lifecycle Assessment` section, replacing its initial `Pending` values with the assessment outcome and concise rationale.

Record:

- Technical Discovery: `Required` or `Not required`, with rationale, prerequisite Issue and status;
- HLD: `Required` or `Not required` only after required Technical Discovery is complete; otherwise `Deferred pending Technical Discovery`;
- Implementation Plan: `Required` or `Not required` only after required Technical Discovery is complete; otherwise `Deferred pending Technical Discovery`;
- LLD: `Deferred pending Technical Discovery` while discovery is blocking; otherwise `Deferred to Implementation Plan` when a Plan is required or `Not applicable`;
- material risks;
- the exact next lifecycle step.

Require Technical Discovery when the downstream design cannot responsibly be chosen because a material fact about the real technical boundary is unknown and must be established empirically. Typical triggers include:

- an undocumented or reverse-engineered external interface/protocol whose behaviour is central to the feature;
- unknown consent, authentication, anti-bot, redirect, permission, rate-limit, regional, account, or runtime behaviour that may determine viability;
- a volatile third-party/live-data boundary whose current behaviour has not been demonstrated in representative environments;
- multiple credible integration approaches whose feasibility cannot be compared from existing evidence;
- community/third-party code being the principal source for a supposed integration contract;
- a core capability whose feasibility or dependency model is not established within the approved product constraints.

Do **not** require a separate discovery Issue for every uncertainty. Keep a bounded feasibility gate inside HLD/Implementation Planning when the unknown is narrow, the design space is already understood, and a small probe can confirm a residual assumption without determining the fundamental integration approach.

When Technical Discovery is required, create or link a prerequisite Technical Discovery Issue using the canonical template. Set HLD, Implementation Plan and LLD to deferred, set the downstream Issue's next step to complete/integrate discovery, and stop assessment. Do not design around the unknown.

After the discovery Issue is integrated, rerun `assess-change`. Read its `technical-discovery.md` evidence, mark Technical Discovery `Required` with status `Complete` and the prerequisite reference, then decide HLD/Implementation Plan depth from the now-evidenced boundary. An `Inconclusive` discovery remains blocking.

Require an HLD only after prerequisite discovery is resolved when a material design decision remains, such as significant product behaviour, durable architecture, interface/integration, data/state, cross-component, security, reliability, performance, cost, compatibility, or competing-design implications.

Require an Implementation Plan when repository-level sequencing, coordination, migration, validation complexity, external/live evidence, bounded feasibility gating, or implementation risk warrants planning before editing. A Plan may be required without an HLD.

A Plan is required when representative acceptance evidence must be deliberately sequenced or when a **bounded residual** assumption needs a pre-implementation feasibility gate. Do not use an Implementation Plan feasibility gate as a substitute for Technical Discovery when the unknown determines the fundamental integration contract or viability.

Do not infer required artifact depth from the `feature` or `bug` label. A small feature may need no design artifact; a difficult bug may need discovery, HLD and Plan. This skill is not used to assess a Technical Discovery Issue itself; that Issue follows the dedicated discovery route.

LLD remains a decision made by an approved Implementation Plan. The assessment must not make that downstream decision; it records `Deferred to Implementation Plan` when a Plan is required.

If the Feature/Bug Issue itself is not ready, return to Issue refinement rather than compensating for missing requirements with design assumptions. If the blocker is a material technical unknown rather than a missing product requirement, route it through Technical Discovery rather than inventing the answer.

## Completion contract

Report the Issue, readiness state, Technical Discovery decision/rationale/prerequisite/status, HLD decision and rationale (or deferral), Implementation Plan decision and rationale (or deferral), LLD status, likely durable Product/Architecture impact, material risks/dependencies, validation complexity, and the exact next lifecycle step. Confirm that the Issue's `Development Lifecycle Assessment` section has been updated when write access is available.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
