---
name: refine-issue
description: Turn a rough feature, bug, or technical-spike request into a development-ready GitHub Issue with behavioural/evidence scope, dependencies and durable-context traceability.
---

# Refine Issue

Refine a rough requirement, feature request, defect report, technical unknown, or existing incomplete Issue into a development-ready GitHub Issue.

Use the current Product Definition, Architecture Definition, relevant repository behaviour, and canonical Issue shapes under `.codex/templates/feature-issue.md`, `.codex/templates/bug-issue.md`, and `.codex/templates/technical-spike-issue.md`.

A Feature/Bug Issue defines a product/software outcome. A Technical Spike Issue owns one material technical question that must be answered empirically before downstream design or implementation can proceed.

## Feature and Bug refinement

For a feature, capture:

- the required positive outcome;
- observable acceptance criteria;
- validation expectations for material behaviour;
- representative live/in-environment evidence when a real external/runtime boundary is part of acceptance;
- relevant Product/Architecture context;
- dependencies or `None`.

For a bug, capture:

- observed behaviour and reproduction/evidence where useful;
- expected behaviour;
- observable acceptance/regression criteria;
- validation expectations;
- relevant Product/Architecture context;
- dependencies or `None`.

Keep Feature/Bug Issues behavioural and implementation-independent.

## Technical Spike refinement

For a Technical Spike, capture the stable investigation contract:

- the exact Technical Question;
- why authoritative documentation/current evidence is insufficient;
- the Required Outcome;
- starting evidence already established;
- approved constraints/prohibited techniques;
- intended investigation boundary;
- known leads/sources/candidate approaches worth considering without selecting them;
- completion criteria;
- blocked downstream Feature/Bug Issue(s);
- the dedicated Spike branch/workspace expectation;
- canonical artifact paths:
  - `docs/changes/<issue>/technical-investigation-design.md`;
  - `docs/changes/<issue>/spike-implementation-plan.md`;
  - `docs/changes/<issue>/technical-spike.md`.

Do **not** perform option selection, workstream design, execution routing or hypothesis design in the Issue body. The Issue is the stable management/tracking object:

- TID owns problem decomposition and candidate approach strategy;
- Spike Implementation Plan owns route/order/transition rules;
- `technical-spike.md` owns bounded experiment execution and evidence.

A Spike is not a substitute for the SideGig Research Methodology. If refinement shows the question needs broad/open-ended domain/provider/commercial/market research rather than bounded technical investigation, surface that boundary for owner decision.

A Technical Spike remains open until its original Technical Question has a supported `Feasible` or `Not feasible` conclusion. Failed/inconclusive experiments remain within the same Issue unless a genuinely independent technical question emerges.

Disposable probes may be used later by the `technical-spike` skill. The Spike must not promise production implementation.

## Decomposition and readiness

One Feature/Bug Issue should represent one independently deliverable outcome. One Technical Spike Issue should represent one coherent technical question.

When a Feature/Bug depends on a material unproven external/runtime boundary, preserve the Feature/Bug outcome and let `assess-change` determine whether a prerequisite Technical Spike is required.

Feature/Bug Issues preserve the template's `Development Lifecycle Assessment` with initial `Pending` values until `assess-change` populates it.

Technical Spike Issues follow their dedicated Issue → TID → Spike Implementation Plan → bounded experiment loop → final PR lifecycle. They do not use the normal Feature/Bug HLD/Implementation Plan/LLD assessment before investigation begins.

If refinement exposes an unresolved product decision, architecture ambiguity, missing dependency or no credible evidence path for a material outcome, report the Issue as not ready rather than inventing the answer.

## Completion contract

Report the Issue number/URL or proposed body, type, stable scope/question, acceptance or Spike completion criteria, validation expectations, dependencies, Product/Architecture references, blocked downstream Issues, readiness state and any unresolved decision preventing implementation/investigation.

## Learning checkpoint

Consider whether refinement exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
