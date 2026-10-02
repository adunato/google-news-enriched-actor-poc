---
name: merge-change
description: Prepare a validated Feature/Bug change or completed Technical Spike for final integration through the repository GitHub Delivery Model.
---

# Merge Change

Use this skill only for final integration preparation. Do not use it as an in-progress Technical Spike workspace mechanism.

Confirm the originating Issue/type, branch/worktree, target branch, intended commits, required Spike/design/change artifacts, durable Product/Architecture updates, validation evidence, learning records and unrelated local changes.

Follow the GitHub Delivery Model. Normal product changes target `dev`; release fixes target the active release branch.

## Feature/Bug integration

Before reporting a Feature/Bug PR ready, confirm every material acceptance criterion has passing evidence, including required representative live/end-to-end checks and any prerequisite Technical Spike with a supported final conclusion. The downstream Issue must have been reassessed after the final Spike evidence was integrated.

A candidate with an unresolved failed required acceptance test is not ready for merge. A later rerun may support readiness only after the failure cause and a relevant corrective change are recorded; repeating the unchanged candidate cannot erase the failed result.

## Technical Spike integration

Do not create a PR for an open/in-progress Spike.

Before creating the final Spike PR confirm:

- final Spike validation passed;
- the original Technical Question is resolved;
- the result is `Feasible` or `Not feasible`;
- the approved Technical Investigation Design is current;
- the approved Spike Implementation Plan reflects the route actually used or any deviation is explicitly approved;
- `technical-spike.md` contains the supported technical specification/infeasibility evidence and downstream implications;
- retained experiment evidence required for audit/reproducibility is present.

Only then create the integration PR. It should reference:

- the controlling Spike Issue;
- the TID;
- the Spike Implementation Plan;
- `technical-spike.md`;
- final validation evidence;
- learning records where applicable.

The final PR may use `Closes #<spike>`.

## Final PR preparation

After the validated final change is ready:

1. commit all intended in-scope changes;
2. push the source branch;
3. create the PR;
4. ensure the PR references the originating Issue and summarizes the implemented outcome or final Spike conclusion, relevant artifacts, validation evidence, durable-document updates and learning records;
5. identify learning records marked `SideGig review: Yes`;
6. confirm required CI/validation state and report the PR as ready for explicit human merge.

Do not bypass CI, branch protection or explicit human merge/promotion decisions. An agent prepares/updates PRs but does not merge its own work.

## Cleanup

After a human-approved final merge is confirmed, verify target branch, PR head SHA and clean worktree before removing the workspace/branch. Never clean up an open Technical Spike simply because an experiment ended. Never force-remove a worktree.

## Completion report contract

Report the Issue/type, source/target branch, PR URL/ID and ready state, CI/validation state, integration state, Spike/design/durable-document updates, learning records, residual conditions, downstream reassessment required, and required human action.

Expected terminal state: `PR prepared; human merge required`.

## Learning checkpoint

Consider whether integration preparation exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
