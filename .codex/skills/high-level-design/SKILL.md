---
name: high-level-design
description: Produce a concise change-specific high-level design when the Development Lifecycle requires one.
---

# High-Level Design

Use the canonical `.codex/templates/high-level-design.md` template when the Development Lifecycle requires an HLD.

Start from the GitHub Issue, current Product Definition, current Architecture Definition, and relevant repository context. The HLD describes the proposed behaviour and design for this individual change; it does not replace the durable product or architecture documents and must not prescribe individual file edits.

Keep the design proportional to the change. Resolve material design choices, interfaces, state changes, error behaviour, validation considerations, and any intended impact on the durable Product Definition or Architecture Definition.

Structural validity is not substantive approval. The skill prepares the HLD and identifies unresolved decisions; it must not infer project-owner approval. Keep the artifact on hold while a material design question remains unresolved or explicit approval is still required.

## Completion contract

Report the artifact path/ID, originating Issue, product/architecture context used, material design decisions, validation considerations, durable-document impacts, unresolved questions, and approval state. A material unresolved design question or missing required owner approval keeps the HLD on hold.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
