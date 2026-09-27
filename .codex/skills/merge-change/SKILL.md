---
name: merge-change
description: Prepare a validated change for integration through the repository's GitHub Delivery Model, including mandatory branch push and pull-request preparation, and safely conclude workspace state.
---

# Merge Change

Use this skill only after validation is complete.

Confirm the originating GitHub Issue, change branch/worktree, target branch, intended commits, required change artifacts, durable Product/Architecture updates, validation evidence, captured learning records, and unrelated local changes.

Before integration preparation, complete the learning checkpoint. For every learning record marked `SideGig review: Yes`, verify that it satisfies the portable context contract defined by `capture-learning`: repository-qualified Learning ID, origin repository, stable source, lifecycle context, self-contained change context, evidence, impact, local action, cross-project relevance, and stable local references. Do not leave a SideGig-review learning dependent on unstated pull-request context.

Follow the GitHub Delivery Model. Normal changes target `dev`; release fixes target the active release branch.

After the validated change is ready:

1. commit all intended in-scope changes, including durable documentation and learning records;
2. push the source branch to GitHub;
3. create a pull request when one does not already exist, or update the existing pull request when it does;
4. ensure the pull request references the originating Issue and summarizes the implemented outcome, relevant design/planning artifacts, validation evidence, durable-document updates, and captured learning records;
5. explicitly identify learning records marked `SideGig review: Yes` in the pull-request body;
6. confirm the required CI/validation state and report the pull request as ready for the explicit human merge decision.

Do not stop after committing or pushing when no pull request exists. Pull-request preparation is a required part of normal change closure.

Do not bypass required CI, branch protection, or explicit human merge/promotion decisions. A coding agent prepares or updates the pull request but does not merge or promote its own change and must not claim that an unmerged pull request is integrated.

After a human-approved merge is confirmed, verify the pull request is merged into its intended target and its recorded head SHA matches the local branch HEAD. This confirms the branch contains no commits beyond the reviewed pull request, including when the target uses squash merging. Also verify the worktree is clean, then remove it with `git worktree remove <path>` and delete the local branch. If any check fails, preserve the worktree and branch; never force-remove a worktree. New worktrees use `<primary-checkout>/.worktrees/issue-<number>/`; resolve the primary checkout with `git worktree list --porcelain`, and adopt a suitable existing worktree outside that location in place rather than moving it. The product repository's post-merge learning-dispatch workflow triggers central SideGig collection automatically; the product-repository agent must not copy learning records into or modify the SideGig repository itself.

## Completion report contract

Report the Issue reference, source branch, target branch, pull request URL/ID, CI/validation state, integration state, durable-document updates, learning-record paths and review flags, workspace cleanup, residual conditions, and required human action. Before merge, the expected terminal state is `PR prepared; human merge required`. The change is integrated only when the human-approved merge is confirmed according to the GitHub Delivery Model.

## Learning checkpoint

Before completing this skill, consider whether integration preparation itself exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later automated collection and SideGig review rather than changing cross-project standards from the product repository.
