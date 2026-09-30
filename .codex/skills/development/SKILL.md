---
name: development
description: Implement a GitHub Issue using the approved change artifacts that are required for that change, with controlled deviations and integrity checks.
---

# Development

Read the originating GitHub Issue, repository instructions, Product Definition, Architecture Definition, and every change-specific artifact that the Development Lifecycle required before editing.

Treat the Feature/Bug Issue as the scope and acceptance contract; completed prerequisite Technical Spike, HLD, implementation plan, and LLD are authoritative inputs only when they were required and approved/integrated for the change. A simple bug may therefore proceed without design/planning artifacts.

Before editing production/runtime code, confirm any `Technical Spike: Required` prerequisite is integrated with sufficient evidence and the downstream Issue has been reassessed. Do not use the development skill to execute a Technical Spike Issue; use `technical-spike`.

Keep implementation within the approved scope and preserve established repository patterns. Add or update automated tests proportionately with the implementation and execute the acceptance-evidence strategy defined by the Issue/plan at the appropriate points.

Complete required bounded residual feasibility gates before dependent implementation. If a gate exposes a larger undocumented/unknown boundary or fails in a way that invalidates the assumed integration contract, stop and return to `assess-change`; create Technical Spike rather than expanding the plan or implementing a mocked version of unproven behaviour.

Minor implementation deviations are acceptable when they do not change product behaviour, architecture, external interfaces, data ownership, scope, or another material decision; record them in the implementation hand-off. A major deviation stops development and returns to the relevant Issue/design/planning decision rather than being silently absorbed.

Update the durable Product Definition or Architecture Definition in the same change when the implemented outcome intentionally changes them.

Run the relevant local integrity checks and distinguish implementation-caused failures from unrelated failures. A green deterministic repository suite does not override a failed required live/end-to-end acceptance check.

## Completion report contract

Report the Issue reference, prerequisite Technical Spike reference/status when applicable, implementation summary, changed areas, bounded feasibility-gate results, change-artifact deviations and reasons, durable-document updates, tests added/changed, live/end-to-end evidence executed during development, integrity checks and results, and known unrelated failures. Development is complete only when the approved scope is implemented and ready for validation.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
