---
name: promote-release
description: Prepare and complete the controlled production promotion of a staging-validated release candidate while preserving human merge approval and immutable release traceability.
---

# Promote Release

Promote a release candidate only after required staging validation has passed.

Before production promotion, verify:

- the active release branch/version;
- the exact candidate validated in staging;
- staging-validation evidence;
- that the proposed production state has not materially diverged from the staged candidate;
- required CI/promotion checks;
- absence of unresolved release blockers.

Open or prepare the pull request from the active release branch to `main`.

Do not merge the production-promotion pull request. The merge remains an explicit human decision.

After a human-approved merge is confirmed, continue the release completion flow:

1. verify the production commit corresponds to the validated candidate;
2. create the immutable `vMAJOR.MINOR.PATCH` tag;
3. create the corresponding GitHub Release with concise user-visible release notes and Issue/PR traceability;
4. trigger or verify production deployment from the tagged state according to repository/platform configuration;
5. run the required production smoke/health check;
6. reconcile any release-only fixes back into `dev`;
7. delete the release branch when safe;
8. close the corresponding milestone after successful production release.

If production deployment fails and the same tagged state can be retried safely, retry without changing the release contents. If code or version-controlled configuration must change, stop and use a Bug Issue plus the release-fix lifecycle; do not mutate or retag the failed release state.

Use CI Diagnostics for failed automated promotion/deployment checks where diagnosis is required.

## Completion contract

Report the version, staging evidence used, production-promotion PR, human merge state, tag and GitHub Release, production deployment result, smoke/health result, release-fix reconciliation state, release-branch cleanup, milestone state, and any remaining human action or blocker.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
