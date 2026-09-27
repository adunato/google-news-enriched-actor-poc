---
name: prepare-release
description: Prepare a SideGig release candidate from a green dev state, verify milestone scope, create the release branch and staging promotion PR without performing the human merge decision.
---

# Prepare Release

Prepare the next release candidate according to the GitHub Delivery Model.

Use:

- the target GitHub Milestone and Semantic Version;
- the current `dev` branch and required integrated CI state;
- the Issues/PRs included in the milestone;
- the current Product Definition and Architecture Definition where useful to understand release impact;
- repository release/deployment configuration.

Verify before creating the candidate:

- the milestone represents exactly one release;
- intended release Issues are integrated into `dev`;
- no known blocking Issue remains inside the intended scope;
- the selected `dev` commit is green under required integrated validation;
- the target version is consistent across milestone, release branch and later tag/Release naming.

Create or prepare `release/vMAJOR.MINOR.PATCH` from the selected green `dev` commit.

Freeze release scope except for fixes needed to make the candidate acceptable. Do not cherry-pick unrelated later features into the release branch.

Open or prepare the promotion pull request from the release branch to `staging`, with release scope and candidate commit clearly identified.

Do not merge the staging promotion pull request. Promotion remains an explicit human action.

If preparation reveals a release blocker, leave the candidate unpromoted and report the blocker. Corrective software work must follow the normal Issue/release-fix lifecycle.

## Completion contract

Report the version/milestone, selected `dev` commit and CI state, release-branch name/commit, included Issues/PRs, excluded or blocking work, staging-promotion PR URL/ID, candidate readiness, and required human action.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
