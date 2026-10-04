---
name: setup-change-workspace
description: Prepare or adopt an isolated Git workspace for one GitHub Issue while preserving repository conventions and unrelated work.
---

# Setup Change Workspace

Prepare a safe workspace for the originating GitHub Issue before change-specific design, investigation, or implementation begins.

Read repository instructions and the GitHub Delivery Model. Use the Issue type and repository branch conventions to create or adopt the correct branch/worktree. Normal Feature/Bug changes are based on `dev`; an approved release-fix change is based on the active release branch.

For a new worktree, resolve the primary checkout from `git worktree list --porcelain`. Create the Issue worktree at `<primary-checkout>/.worktrees/issue-<issue-number>/`. Adopt an existing suitable branch/worktree when present. Never reset, overwrite, move or discard unrelated work to force setup.

Inspect the Issue, Product Definition, Architecture Definition, `AGENTS.md`, and relevant repository state.

For Feature/Bug work, downstream assessment determines Technical Spike/HLD/Implementation Plan/LLD depth.

For a Technical Spike:

- create or adopt one long-lived branch/workspace for the controlling Spike Issue;
- use a branch name such as `spike/<issue-number>-<slug>` where repository rules permit it;
- keep all iterations for the same Technical Question in that workspace;
- reserve `docs/changes/<issue-number>/technical-investigation-design.md` for the complete Spike investigation design/routing artifact;
- reserve `docs/changes/<issue-number>/technical-spike.md` for the living execution/evidence record;
- keep experiment-specific probes/evidence under the same change directory only when useful;
- **do not open a pull request during the active investigation**.

The Issue is the tracking centre and the branch is the working container. The TID and `technical-spike.md` are created by their dedicated lifecycle skills after workspace setup.

Workspace setup itself does not require normal Feature/Bug HLD, Implementation Plan or LLD.

## Completion contract

Report the Issue reference/type, branch, worktree, base branch, created/adopted state, conventions applied, artifact paths, unrelated-change safety and any readiness blocker. For an active Technical Spike, explicitly confirm that no PR was opened.

## Safe cleanup

For Feature/Bug work, do not remove the Issue worktree/branch before a human confirms its PR was integrated and the usual clean/SHA checks pass.

For a Technical Spike, keep the workspace/branch while the Spike remains open. Cleanup occurs only after the final Spike PR is human-merged or the owner explicitly stops/supersedes the Spike and preserved evidence has been handled.

Never force-remove a worktree.

## Learning checkpoint

Consider whether setup exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
