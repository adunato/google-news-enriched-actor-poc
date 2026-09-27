---
name: refine-issue
description: Turn a rough feature request or bug report into a development-ready GitHub Issue with behavioural scope, acceptance criteria, dependencies and durable-context traceability.
---

# Refine Issue

Refine a rough requirement, feature request, defect report, or existing incomplete Issue into a development-ready GitHub Issue.

Use the current Product Definition, Architecture Definition, relevant repository behaviour, and the canonical Issue shapes under `.codex/templates/feature-issue.md` and `.codex/templates/bug-issue.md`.

For a feature, capture:

- the required positive outcome;
- observable acceptance criteria that state what must actually work;
- validation expectations for material acceptance behaviour;
- representative live/in-environment evidence when an external system, live-data source, deployed runtime, or platform integration is itself part of the acceptance claim;
- relevant Product/Architecture context;
- dependencies or `None`.

Do not accept a feature whose criteria only describe conditional handling such as "if successful, return X" and "if it fails, fail softly" without also stating the positive outcome that must be demonstrated. A feature cannot be development-ready when zero successful real outcomes would satisfy its written criteria.

For a bug, capture:

- observed behaviour and concise reproduction/evidence where useful;
- expected behaviour;
- observable acceptance/regression criteria;
- validation expectations for the corrected behaviour;
- representative live/in-environment evidence when the defect concerns a material external/runtime boundary;
- relevant Product/Architecture context;
- dependencies or `None`.

Keep the Issue behavioural and implementation-independent. Do not choose architecture, files, libraries, algorithms, or a patch unless that is itself an approved constraint.

Validation expectations define what kind of evidence can prove acceptance, not the implementation technique. Mocked evidence may be appropriate for local logic but must not be presented as proof that a material external/runtime integration actually works. When representative live or in-environment validation is required, describe the boundary and meaningful variation to cover rather than defaulting to a single token smoke test.

One Issue should represent one independently deliverable outcome. If the request contains materially separable outcomes, identify the split rather than hiding multiple changes inside one Issue.

Preserve the template's `Development Lifecycle Assessment` section with its initial `Pending` values. Issue refinement does not perform the change assessment; the `assess-change` step populates that section afterwards.

If refinement exposes an unresolved product decision, architecture ambiguity, missing dependency, acceptance criterion that cannot yet be made observable, or no credible evidence path for a material positive outcome, report the Issue as not ready rather than inventing the answer.

The skill may create or update the GitHub Issue when authorized. Otherwise return the complete proposed Issue content and readiness findings.

## Completion contract

Report the Issue number/URL or proposed Issue body, type, scope, acceptance criteria, validation expectations, external/runtime evidence requirements, dependencies, Product/Architecture references, any recommended split, readiness state, and unresolved decision that prevents implementation.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
