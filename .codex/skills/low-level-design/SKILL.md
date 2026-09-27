---
name: low-level-design
description: Produce a concise file-level design when an approved implementation plan explicitly requires an LLD.
---

# Low-Level Design

Create an LLD only when the approved implementation plan states `LLD required: Yes`.

Use `.codex/templates/low-level-design.md` and inspect the actual repository. Describe the change overview, every significant file action and responsibility, cross-file dependencies, and an agreeing summary table. The LLD is design guidance, not a diff or line-by-line patch.

Keep the artifact consistent with the originating GitHub Issue, approved implementation plan, and HLD when one exists. If repository facts invalidate the approved direction, stop and return to the relevant design or planning artifact rather than silently redesigning.

The skill prepares the LLD and identifies unresolved file-level decisions; it must not infer project-owner approval where explicit approval is required.

## Completion contract

Report the artifact path/ID, originating Issue, files/actions covered, dependencies, summary agreement, approval state, and any unresolved decision. Implementation may proceed only when the required LLD is approved and no material file-level decision remains unresolved.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
