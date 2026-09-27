---
name: product-definition
description: Create or reconcile the durable current-state Product Definition from approved product decisions without turning it into a backlog or change history.
---

# Product Definition

Create or update `docs/product.md` using `.codex/templates/product-definition.md`.

Use approved upstream product/POC decisions, relevant GitHub Issues, and the current repository context. The Product Definition describes the current intended product: purpose, users, scope, capabilities, externally meaningful behaviour, material requirements, constraints, and non-goals.

Keep the artifact concise and current-state. Do not convert it into a roadmap, backlog, changelog, architecture description, or implementation plan.

For an existing product, change only durable product characteristics that have actually been approved. Preserve stable requirement identifiers where they remain valid. Remove or rewrite superseded current-state content rather than accumulating historical "was/now" narration.

When invoked from an individual software change, reconcile only the durable product impact of that Issue. A bug fix that merely restores already-defined behaviour normally leaves the Product Definition unchanged.

The skill prepares the artifact and identifies unresolved decisions. It must not infer owner approval. Set or retain `Approved` only when the project owner has explicitly approved the product definition and no material product question remains unresolved.

## Completion contract

Report the Product Definition path/status, source decisions used, sections materially created or changed, stable requirements affected, unresolved product questions, originating Issue when applicable, and any explicit approval still required.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
