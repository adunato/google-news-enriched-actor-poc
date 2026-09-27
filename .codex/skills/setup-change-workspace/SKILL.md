---
name: setup-change-workspace
description: Prepare or adopt an isolated Git workspace for one GitHub Issue while preserving repository conventions and unrelated work.
---

# Setup Change Workspace

Prepare a safe workspace for the originating GitHub Issue before change-specific design or implementation begins.

Read the repository instructions and the GitHub Delivery Model. Use the Issue type and repository branch conventions to create or adopt the correct change branch/worktree. Normal changes are based on `dev`; an approved release-fix change is based on the active release branch.

For a new worktree, resolve the primary checkout by reading the first `worktree <path>` record from `git worktree list --porcelain`; this works when the current directory is itself a linked worktree. Create the Issue worktree at `<primary-checkout>/.worktrees/issue-<issue-number>/`, while choosing the branch name and base branch from the repository's own branch policy. The bootstrap installer ensures the repository root `.gitignore` excludes `/.worktrees/` and preserves any existing ignore rules.

Adopt an existing suitable branch/worktree when present. Never reset, overwrite, or discard unrelated changes to force setup.

If a suitable worktree already exists outside the canonical location, adopt it in place and report the location exception. Never move it automatically. If the canonical target path exists but is not the suitable registered worktree for this Issue, stop without changing it. Do not create a second worktree for the same Issue and branch.

Inspect the Issue, Product Definition, Architecture Definition, `AGENTS.md`, and relevant repository state so the downstream lifecycle can determine proportionately whether HLD, implementation planning, or LLD are required. Workspace setup itself must not require those artifacts to exist.

## Completion contract

Report the Issue reference, branch, worktree, base branch, created/adopted state, conventions applied, unrelated-change safety, and any readiness blocker. The workspace is ready only when subsequent design or implementation work can proceed safely in isolation.

## Safe cleanup

Do not remove the Issue worktree or branch before a human confirms that its pull request was integrated into the intended target branch. Verify the pull request is merged to that target and its recorded head SHA matches the local branch HEAD; this ensures the local branch has no commits beyond the reviewed pull request, including when the target uses squash merging. Also verify the worktree is clean. Then remove it with `git worktree remove <path>` and delete the local branch. If any check fails, preserve both and report the blocker. Never force-remove a worktree.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
