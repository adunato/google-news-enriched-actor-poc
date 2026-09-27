---
name: assess-change
description: Select the proportional Development Lifecycle path for a ready GitHub Issue based on design uncertainty, architectural impact, implementation complexity and risk rather than Issue label.
---

# Assess Change

Determine the minimum change-design and planning path required for a development-ready GitHub Issue.

Inspect:

- the Issue and acceptance criteria;
- `docs/product.md`;
- `docs/architecture.md`;
- relevant source code, tests, configuration and repository patterns;
- material dependencies and integration boundaries.

Decide independently whether the change requires:

- an HLD;
- an Implementation Plan.

Do not create a separate assessment document. Update the originating Issue's `Development Lifecycle Assessment` section, replacing its initial `Pending` values with the assessment outcome and concise rationale.

Record:

- HLD: `Required` or `Not required`, with rationale;
- Implementation Plan: `Required` or `Not required`, with rationale;
- LLD: `Deferred to Implementation Plan` when a Plan is required, otherwise `Not applicable`;
- material risks;
- the exact next lifecycle step.

Require an HLD only when a material design decision must be resolved before implementation, such as significant product behaviour, durable architecture, interface/integration, data/state, cross-component, security, reliability, performance, cost, compatibility, or competing-design implications.

Require an Implementation Plan when repository-level sequencing, coordination, migration, validation complexity, or implementation risk warrants planning before editing. A Plan may be required without an HLD.

Do not infer required artifact depth from the `feature` or `bug` label. A small feature may need no design artifact; a difficult bug may need both HLD and Plan.

LLD remains a decision made by an approved Implementation Plan. The assessment must not make that downstream decision; it records `Deferred to Implementation Plan` when a Plan is required.

If the Issue itself is not ready, return to Issue refinement rather than compensating for missing requirements with design assumptions.

## Completion contract

Report the Issue, readiness state, HLD decision and rationale, Implementation Plan decision and rationale, LLD status, likely durable Product/Architecture impact, material risks/dependencies, and the exact next lifecycle step. Confirm that the Issue's `Development Lifecycle Assessment` section has been updated when write access is available.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
