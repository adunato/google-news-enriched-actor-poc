---
name: setup-change-workspace
description: Prepare or adopt an isolated Git workspace for one GitHub Issue while preserving repository conventions and unrelated work.
---

# Setup Change Workspace

Prepare a safe workspace for the originating GitHub Issue before change-specific design, investigation, or implementation begins.

Read the repository instructions and GitHub Delivery Model. Use the Issue type and repository branch conventions to create or adopt the correct branch/worktree. Normal Feature/Bug changes are based on `dev`; an approved release-fix change is based on the active release branch.

For a new worktree, resolve the primary checkout from `git worktree list --porcelain`. Create the Issue worktree at `<primary-checkout>/.worktrees/issue-<issue-number>/`. Adopt an existing suitable branch/worktree when present. Never reset, overwrite, move, or discard unrelated work to force setup.

Inspect the Issue, Product Definition, Architecture Definition, `AGENTS.md`, and relevant repository state.

For Feature/Bug work, downstream assessment determines Technical Spike/HLD/Implementation Plan/LLD depth.

For a Technical Spike:

- create or adopt one long-lived branch/workspace for the controlling Spike Issue;
- use a branch name such as `spike/<issue-number>-<slug>` where repository branch rules permit it;
- keep all iterations for the same technical question in that workspace;
- store the living artifact at `docs/changes/<issue-number>/technical-spike.md`;
- keep experiment-specific probes/evidence under the same change directory when useful;
- open/reuse one draft PR for the Spike rather than creating a new branch/PR per failed hypothesis.

Workspace setup itself does not require HLD, Implementation Plan or LLD.

## Completion contract

Report the Issue reference/type, branch, worktree, base branch, created/adopted state, existing draft PR when applicable, conventions applied, unrelated-change safety, and any readiness blocker.

## Safe cleanup

For Feature/Bug work, do not remove the Issue worktree/branch before a human confirms its PR was integrated and the usual clean/SHA checks pass.

For a Technical Spike, keep the workspace/branch while the Spike remains open. Do not clean it up merely because an individual experiment or interim PR update is complete. Cleanup occurs only after the final Spike PR is human-merged or the owner explicitly stops/supersedes the Spike and preserved evidence has been handled.

Never force-remove a worktree.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
