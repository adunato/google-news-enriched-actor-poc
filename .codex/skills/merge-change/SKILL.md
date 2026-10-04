---
name: merge-change
description: Prepare a validated Feature/Bug change or completed Technical Spike for integration through the repository GitHub Delivery Model.
---

# Merge Change

Use this skill for **final integration preparation**. It is not a Technical Spike working-container skill.

Confirm the originating Issue/type, branch/worktree, target branch, intended commits, required Spike/design/change artifacts, durable Product/Architecture updates, validation evidence, learning records and unrelated local changes.

Follow the GitHub Delivery Model. Normal product changes target `dev`; release fixes target the active release branch.

## Feature/Bug integration

Before reporting a Feature/Bug PR ready, confirm every material acceptance criterion has passing evidence, including required representative live/end-to-end checks and any prerequisite Technical Spike with a supported final conclusion. The downstream Issue must have been reassessed after the final Spike evidence was integrated.

A candidate with an unresolved failed required acceptance test is not ready for merge. A later rerun may support readiness only after the failure cause and a relevant corrective change are recorded; repeating the unchanged candidate cannot erase the failed result.

## Technical Spike integration

A Technical Spike has **no investigation-time draft PR**. The Issue is the tracker and the dedicated Spike branch is the workspace.

Do not create the final Spike PR until:

- the original Technical Question is resolved;
- the final result is `Feasible` or `Not feasible`;
- the TID accurately reflects the final investigation route/boundaries;
- `technical-spike.md` contains the supported technical specification or infeasibility evidence;
- downstream implications are explicit;
- final Spike validation passes.

Only then create the PR and use the appropriate Issue-closing reference.

## Final PR preparation

After the validated final change is ready:

1. commit all intended in-scope changes, including artifacts, evidence and learning records;
2. push the source branch;
3. create the PR;
4. ensure the PR references the originating Issue and summarizes the implemented outcome or final Spike conclusion, relevant artifacts, validation evidence, durable-document updates and learning records;
5. identify learning records marked `SideGig review: Yes`;
6. confirm required CI/validation state and report the PR as ready for explicit human merge.

If final validation is blocked, do not create a misleading integration proposal merely to preserve work; the branch remains the working state until the completion conditions are met.

Do not bypass CI, branch protection or explicit human merge/promotion decisions. An agent prepares PRs but does not merge its own work.

## Cleanup

After a human-approved final merge is confirmed, verify target branch, PR head SHA and clean worktree before removing the workspace/branch. Never force-remove a worktree.

## Completion report contract

Report the Issue/type, source/target branch, final PR URL/ID, CI/validation state, integration state, Spike/design/durable-document updates, learning records, residual conditions, downstream reassessment required and required human action.

Expected terminal state before human merge: `PR prepared; human merge required`.

## Learning checkpoint

Consider whether integration preparation exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
