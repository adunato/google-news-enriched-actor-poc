---
name: technical-spike
description: Run an iterative technical Spike for a material undocumented or unknown external/runtime boundary, preserving one controlling Issue until the original technical question is resolved or shown infeasible.
---

# Technical Spike

Use this skill only for a GitHub Technical Spike Issue created because a material technical unknown prevents responsible downstream design or implementation.

A Technical Spike answers one stable technical question through iterative, bounded experiments. It does **not** implement the blocked production feature.

## Core lifecycle rule

The Spike Issue is the controlling work item and remains open until its original Technical Question is resolved with a supported **Feasible** or **Not feasible** conclusion.

A failed or inconclusive experiment is not Spike completion. Record it, update the current understanding, propose the next hypothesis/experiment, and continue within the same Spike after the required owner checkpoint.

Do not create serial follow-up Spike Issues merely because an experiment failed. Create another Spike only when a genuinely independent technical question emerges with a distinct completion condition.

## Inputs

Read:

- the Technical Spike Issue and its completion criteria;
- each blocked downstream Feature/Bug Issue;
- `docs/product.md`;
- `docs/architecture.md`;
- `AGENTS.md`;
- relevant source/tests/configuration;
- official external documentation and retained repository evidence;
- relevant third-party/community implementations or reports as leads, not authoritative specifications unless the provider explicitly documents them.

Create or update:

`docs/changes/<spike-issue-number>/technical-spike.md`

from the canonical template.

Use one long-lived Spike branch/workspace for the controlling Issue. Open a draft pull request early, reference the Spike with `Refs #<issue>`, and keep it open while the Spike remains unresolved. Do not use a closing keyword until final Spike completion.

## Iteration planning

Before executing an iteration, update the living Spike artifact with:

1. the current understanding;
2. the ordered investigation backlog;
3. the selected hypothesis/approach;
4. why it is the next useful test;
5. the exact bounded experiment;
6. representative environment/data;
7. expected evidence and interpretation;
8. operational bounds and stop conditions.

The Issue body holds the stable problem/outcome. The living Spike artifact holds the evolving investigation design.

## Owner checkpoint

Default mode is **one approved iteration at a time**.

After each completed iteration:

1. record the evidence and result in the Experiment Log;
2. update Current Understanding, Supported Technical Specification and Remaining Uncertainty;
3. propose the next hypothesis/experiment;
4. report back to the project owner and stop.

Proceed to the next iteration only after owner approval.

The project owner may explicitly authorize autonomous continuation across multiple iterations. Even with that authorization, stop before proceeding when the next iteration would materially change:

- the original Technical Question or required outcome;
- product scope or acceptance criteria;
- Product/Architecture constraints;
- dependency model or use a previously excluded dependency;
- expected cost/spend or operational burden;
- security, privacy, legal or safety posture;
- representative environment/data in a way that changes what the evidence means.

## Investigation discipline

For each iteration:

1. Separate established facts from hypotheses and third-party claims.
2. Prefer direct observation of the real boundary when legally, safely and practically possible.
3. Use representative environments/data/permissions/providers/protocol variants proportionate to the question.
4. Make the experiment reproducible before drawing conclusions.
5. Compare materially credible alternatives when the technical question is about choosing an integration approach.
6. Preserve enough evidence to audit the result without retaining secrets or unnecessary sensitive/raw content.
7. Record variability and limitations; do not generalise beyond the evidence.
8. Classify the experiment result as `Supported`, `Rejected`, or `Inconclusive`.
9. Update the investigation backlog from what was learned.

A third-party library, script, blog post, issue, or reverse-engineered implementation is evidence about a possible approach. It is not the external system's specification. Validate material behaviour independently before downstream design relies on it.

## Code and repository boundaries

Disposable probes and reproducibility tooling are allowed. Keep them under the Spike change area or another clearly non-production location unless the Issue explicitly authorizes reusable investigation tooling.

A normal Spike tree may contain:

```text
docs/changes/<issue>/
  technical-spike.md
  experiments/
    01-<slug>/
      experiment.md
      <probe scripts>
      <sanitized retained evidence>
    02-<slug>/
      ...
```

Use subdirectories only when they make a material experiment reproducible/auditable; do not create ceremony for trivial probes.

Do not:

- implement the blocked production feature;
- silently turn a probe into production architecture;
- expand product scope;
- relax approved constraints merely to obtain a positive result;
- treat an inconclusive iteration as authority to close the Spike.

If evidence shows that a product/architecture constraint itself must change, record the implication and stop for the owner/product decision.

## Draft PR behaviour

The Spike branch and draft PR are long-lived working containers for the investigation.

Each iteration may add commits containing:

- the updated `technical-spike.md`;
- experiment notes;
- bounded probe/reproducibility code;
- sanitized evidence;
- learning records where warranted.

Keep the PR draft while the Spike is unresolved. Interim experiment commits/PR updates do not need to be merged merely to preserve evidence. If repository or operational constraints require an interim evidence merge, the controlling Spike remains open and the merge must not use a closing keyword or imply that downstream work is unblocked.

## Completion gate

The Spike is ready to close only when the original Technical Question is resolved.

A **Feasible** conclusion requires enough representative evidence to state a supported technical specification/approach that downstream design may rely on.

A **Not feasible** conclusion requires enough evidence to show that the Required Outcome cannot be achieved within the approved constraints and to identify the resulting Product/Architecture/POC decision.

There is no terminal `Inconclusive` Spike state. An inconclusive experiment keeps the Spike Open and drives the next iteration unless the owner explicitly changes/stops the original objective.

Before completion confirm:

- the original Technical Question is answered;
- material hypotheses/alternatives were covered proportionately;
- experiment evidence is reproducible and observations are distinguished from inference;
- limitations/variability are explicit;
- the Supported Technical Specification contains only evidence-backed behaviour;
- downstream implications are explicit;
- the final result is Feasible or Not feasible.

After the final Spike PR is integrated, rerun `assess-change` on every blocked downstream Issue.

## Validation and integration

Use the repository validation contract for committed tooling and the `validation` skill to validate both individual experiment evidence and final Spike completion.

Validation may return **Iteration valid / Spike remains open** when an experiment is correctly executed but the original Technical Question is unresolved.

Only final Spike validation may authorize the PR to become ready for merge with a closing keyword.

## Completion contract

For an iteration, report the Spike Issue, current iteration, hypothesis, experiment, environment/data, retained evidence, result, learning, updated current understanding, next proposed iteration and whether owner approval is required.

For final completion, additionally report the supported technical specification or infeasibility conclusion, limitations, downstream implications, validation result, final PR state and downstream reassessment required.

## Learning checkpoint

Before completing each iteration, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or implementation methodology. A normal failed hypothesis is not automatically a learning. When a reusable lesson exists, use `capture-learning`; otherwise report `Learnings: None`.
