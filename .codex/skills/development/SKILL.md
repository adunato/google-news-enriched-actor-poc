---
name: development
description: Implement a GitHub Issue using the approved change artifacts that are required for that change, with controlled deviations and integrity checks.
---

# Development

Read the originating GitHub Issue, repository instructions, Product Definition, Architecture Definition, and every change-specific artifact that the Development Lifecycle required before editing.

Treat the Issue as the scope and acceptance contract; HLD, implementation plan, and LLD are authoritative only when they were required and approved for the change. A simple bug may therefore proceed without design/planning artifacts.

Keep implementation within the approved scope and preserve established repository patterns. Add or update automated tests proportionately with the implementation.

Minor implementation deviations are acceptable when they do not change product behaviour, architecture, external interfaces, data ownership, scope, or another material decision; record them in the implementation hand-off. A major deviation stops development and returns to the relevant Issue/design/planning decision rather than being silently absorbed.

Update the durable Product Definition or Architecture Definition in the same change when the implemented outcome intentionally changes them.

Run the relevant local integrity checks and distinguish implementation-caused failures from unrelated failures.

## Completion report contract

Report the Issue reference, implementation summary, changed areas, change-artifact deviations and reasons, durable-document updates, tests added/changed, integrity checks and results, and known unrelated failures. Development is complete only when the approved scope is implemented and ready for validation.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
