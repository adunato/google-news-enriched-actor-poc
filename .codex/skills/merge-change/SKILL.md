---
name: merge-change
description: Prepare a validated Feature/Bug change or completed Technical Spike for integration through the repository GitHub Delivery Model, while preserving long-lived draft-PR behaviour for open Spikes.
---

# Merge Change

Use this skill for final integration preparation. A branch may be pushed and a pull request may remain draft while work is incomplete, but it must not be reported ready for merge until the originating Issue's completion conditions are satisfied.

Confirm the originating Issue/type, branch/worktree, target branch, intended commits, required Spike/design/change artifacts, durable Product/Architecture updates, validation evidence, learning records and unrelated local changes.

Follow the GitHub Delivery Model. Normal product changes target `dev`; release fixes target the active release branch.

## Feature/Bug integration

Before reporting a Feature/Bug PR ready, confirm every material acceptance criterion has passing evidence, including required representative live/end-to-end checks and any prerequisite Technical Spike with a supported final conclusion. The downstream Issue must have been reassessed after the final Spike evidence was integrated.

A candidate with an unresolved failed required acceptance test is not ready for merge. A later rerun may support readiness only after the failure cause and a relevant corrective change are recorded; repeating the unchanged candidate cannot erase the failed result.

## Technical Spike pull-request lifecycle

A Technical Spike normally opens **one draft PR early** and keeps it for the lifetime of the Spike.

While the Spike remains open:

- commits may accumulate experiment plans, probes, sanitized evidence and updates to `technical-spike.md`;
- keep the PR draft;
- reference the controlling Spike with `Refs #<issue>` rather than a closing keyword;
- do not report the PR ready for merge merely because one iteration is valid;
- do not create a replacement PR for each failed/inconclusive hypothesis.

If repository or operational constraints genuinely require interim evidence to be merged, that merge must not close the controlling Spike or imply downstream authorization. Preserve clear references to the still-open Spike and continue from a suitable branch/workspace.

Before reporting the **final** Spike PR ready:

- final Spike validation must pass;
- the original Technical Question must be resolved;
- the final result must be `Feasible` or `Not feasible`;
- `technical-spike.md` must contain the supported technical specification or infeasibility evidence;
- downstream implications must be explicit.

Only then may the PR use `Closes #<spike>`.

## Final PR preparation

After the validated final change is ready:

1. commit all intended in-scope changes, including durable documentation and learning records;
2. push the source branch;
3. create a PR when none exists, or update the existing PR;
4. ensure the PR references the originating Issue and summarizes the implemented outcome or final Spike conclusion, relevant artifacts, validation evidence, durable-document updates and learning records;
5. identify learning records marked `SideGig review: Yes`;
6. confirm required CI/validation state and report the PR as ready for explicit human merge.

When validation is blocked, the PR remains draft and its body states the incomplete evidence/next action.

Do not bypass CI, branch protection or explicit human merge/promotion decisions. An agent prepares/updates PRs but does not merge its own work.

## Cleanup

After a human-approved final merge is confirmed, verify target branch, PR head SHA and clean worktree before removing the workspace/branch. Never clean up an open Technical Spike simply because an iteration ended. Never force-remove a worktree.

## Completion report contract

Report the Issue/type, source/target branch, PR URL/ID and draft/ready state, CI/validation state, integration state, Spike/design/durable-document updates, learning records, residual conditions, downstream reassessment required, and required human action.

Before final merge the expected terminal state is `PR prepared; human merge required`. For an open Spike iteration the expected state is `Draft PR updated; Spike remains open`.

## Learning checkpoint

Consider whether integration preparation exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
