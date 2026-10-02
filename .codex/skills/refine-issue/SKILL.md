---
name: refine-issue
description: Turn a rough feature, bug, or technical-spike request into a development-ready GitHub Issue with behavioural/evidence scope, dependencies and durable-context traceability.
---

# Refine Issue

Refine a rough requirement, feature request, defect report, technical unknown, or existing incomplete Issue into a development-ready GitHub Issue.

Use the current Product Definition, Architecture Definition, relevant repository behaviour, and the canonical Issue shapes under `.codex/templates/feature-issue.md`, `.codex/templates/bug-issue.md`, and `.codex/templates/technical-spike-issue.md`.

A Feature/Bug Issue defines a product/software outcome. A Technical Spike Issue is a normal GitHub Issue that owns one material technical question that must be answered empirically before downstream design or implementation can proceed.

## Feature and Bug refinement

For a feature, capture:

- the required positive outcome;
- observable acceptance criteria that state what must actually work;
- validation expectations for material acceptance behaviour;
- representative live/in-environment evidence when an external system, live-data source, deployed runtime, or platform integration is itself part of the acceptance claim;
- relevant Product/Architecture context;
- dependencies or `None`.

Do not accept a feature whose criteria only describe conditional handling such as "if successful, return X" and "if it fails, fail softly" without also stating the positive outcome that must be demonstrated.

For a bug, capture:

- observed behaviour and concise reproduction/evidence where useful;
- expected behaviour;
- observable acceptance/regression criteria;
- validation expectations for the corrected behaviour;
- representative live/in-environment evidence when the defect concerns a material external/runtime boundary;
- relevant Product/Architecture context;
- dependencies or `None`.

Keep Feature/Bug Issues behavioural and implementation-independent. Do not choose architecture, files, libraries, algorithms, or a patch unless that is itself an approved constraint.

## Technical Spike refinement

For a Technical Spike, capture the stable parts of the investigation:

- the exact Technical Question;
- why authoritative documentation/current evidence is insufficient;
- the Required Outcome that must be known well enough for downstream engineering to proceed;
- starting evidence already established;
- approved constraints and prohibited techniques;
- the intended investigation boundary, including any owner instruction to keep the Spike to a lightweight/proportionate search;
- known leads, sources or candidate approaches worth considering later, without preselecting a solution or committing hypotheses;
- completion criteria;
- blocked downstream Feature/Bug Issue(s);
- the canonical Spike artifact paths under `docs/changes/<issue>/`.

Do **not** perform or pre-empt option selection in the Issue body. The Issue is the stable problem statement and central tracking object. The Technical Investigation Design owns the problem decomposition, candidate approaches and evidence boundaries; the Spike Implementation Plan owns traversal/order/fallback rules; `technical-spike.md` owns the current approved experiment and evidence history.

A Spike is not a substitute for the SideGig Research Methodology. If refinement shows that answering the request would require broad/open-ended domain, provider, commercial or market research rather than a bounded technical investigation tied to the downstream issue, surface that boundary for an owner decision instead of silently expanding the Spike.

A Technical Spike must remain open until its original Technical Question is resolved with a supported `Feasible` or `Not feasible` conclusion. A failed or inconclusive experiment is not a new Issue and does not complete the Spike.

Create a separate Spike only when a genuinely independent technical question emerges with its own required outcome and completion condition. Do not create serial Spike Issues merely because the current hypothesis or verification method failed.

Disposable probes may be used later by the `technical-spike` skill. The Spike must not promise production implementation.

## Decomposition and readiness

One Feature/Bug Issue should represent one independently deliverable product/software outcome. One Technical Spike Issue should represent one coherent technical question. If a request contains materially independent outcomes/questions, identify the split rather than hiding unrelated work inside one Issue.

When a Feature/Bug depends on a substantial undocumented, reverse-engineered, materially volatile, environment-dependent, or otherwise unproven boundary, preserve the Feature/Bug outcome and let `assess-change` decide whether a prerequisite Technical Spike is required.

For Feature/Bug Issues, preserve the template's `Development Lifecycle Assessment` section with initial `Pending` values, including Technical Spike. Issue refinement does not perform the change assessment; `assess-change` populates it afterwards.

Technical Spike Issues follow their dedicated TID → Spike Implementation Plan → bounded experiment lifecycle and do not require the normal Feature/Bug HLD/Implementation Plan/LLD assessment before investigation begins.

If refinement exposes an unresolved product decision, architecture ambiguity, missing dependency, acceptance criterion that cannot yet be made observable, or no credible evidence path for a material positive outcome, report the Issue as not ready rather than inventing the answer.

The skill may create or update the GitHub Issue when authorized. Otherwise return the complete proposed Issue content and readiness findings.

## Completion contract

Report the Issue number/URL or proposed Issue body, type, stable scope/question, acceptance or Spike completion criteria, validation expectations, dependencies, Product/Architecture references, blocked downstream Issues for Spike work, any recommended split, readiness state, and unresolved decision that prevents implementation/investigation.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or implementation methodology. A normal defect or failed hypothesis is not automatically a learning. When a reusable lesson exists, use `capture-learning`; otherwise report `Learnings: None`.
