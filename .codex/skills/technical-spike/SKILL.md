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

## Option discovery and prioritisation

Before selecting the first experimental hypothesis, perform a **proportionate option scan** for the bounded Technical Question.

The goal is to identify the materially credible ways to resolve the blocking uncertainty before committing to one implementation path. Use the smallest useful combination of:

- official/provider documentation;
- current repository and retained evidence;
- established libraries, mechanisms or implementation approaches;
- relevant upstream issues/releases and community experience where they illuminate maturity, reliability or known limitations.

Record the credible option set, evidence/rationale, material known limitations, and investigation priority in the living Spike artifact. Do not select a candidate merely because it is easy to install, familiar, or the first plausible search result.

This is a lightweight technical-research step, **not a replacement for the SideGig Research Methodology**. Keep it proportionate to the downstream development question. If a responsible scan would require broad/open-ended domain research, many provider classes, commercial-market analysis or a materially wider objective, state that boundary and return to the owner instead of expanding the Spike silently. Respect any explicit owner instruction to keep the investigation at Spike depth.

## Iteration planning

Before executing an iteration, update the living Spike artifact with:

1. the current understanding;
2. the current ranked option set and status;
3. the ordered hypothesis backlog for the selected option;
4. the selected option and hypothesis;
5. why it is the next useful test;
6. the exact bounded experiment;
7. representative environment/data;
8. expected evidence and interpretation;
9. operational bounds and stop conditions.

The Issue body holds the stable problem/outcome. The living Spike artifact holds the evolving option selection, investigation design and evidence.

## Owner checkpoint

Default mode is **one approved iteration at a time**.

An owner checkpoint is an **authorization and decision boundary, not a transfer of investigative ownership**. The executing agent remains responsible for understanding what the evidence means, selecting the best next step, diagnosing ordinary execution problems, and presenting a decision-ready recommendation.

After each completed iteration:

1. record the evidence and result in the Experiment Log;
2. update Current Understanding, Supported Technical Specification and Remaining Uncertainty;
3. decide whether the evidence still justifies the current option or triggers an option-viability checkpoint; if the option remains viable, select and **recommend** the next hypothesis/experiment with the highest current information value; if not, return to the ranked option set and recommend the next option;
4. explain why that recommendation is next and what uncertainty it resolves;
5. identify any prerequisite, blocker or execution problem and classify it explicitly:
   - whether it affected the completed iteration;
   - whether it blocks the recommended next iteration;
   - whether it is an ordinary operational prerequisite or a material owner/product/architecture/risk decision;
   - the concrete supported recovery/action required;
6. for ordinary operational prerequisites, use or identify the repository/platform's standard recovery path before escalating manual work to the owner;
7. state the exact owner decision requested, normally in a form such as **Approve Iteration N: <bounded experiment>**, **Redirect to <alternative>**, or **Decide <material choice>**;
8. report back to the project owner and stop only after the hand-off is decision-ready.

Proceed to the next iteration only after owner approval.

The project owner may explicitly authorize autonomous continuation across multiple iterations. Even with that authorization, stop before proceeding when the next iteration would materially change:

- the original Technical Question or required outcome;
- product scope or acceptance criteria;
- Product/Architecture constraints;
- dependency model or use a previously excluded dependency;
- expected cost/spend or operational burden;
- security, privacy, legal or safety posture;
- representative environment/data in a way that changes what the evidence means.

## Option-viability checkpoint

Do not respond to repeated or unexplained failure by automatically adding progressively deeper diagnostics to the same candidate.

Trigger an option-viability checkpoint when evidence materially raises doubt about whether the selected option is itself suitable, including repeated timeouts/failures, behaviour inconsistent with its expected maturity or documented use, or a growing need for candidate-specific workarounds.

At that checkpoint:

1. summarize what is failing and what has already been ruled out;
2. inspect proportionate upstream evidence such as official documentation, release notes, issue trackers and community reports;
3. distinguish evidence for an environment/integration-specific problem from evidence of a candidate-level reliability, compatibility or maintenance problem;
4. compare the cost/information value of deeper diagnosis with returning to the next ranked credible option;
5. record an explicit option decision: `Continue`, `Deprioritise`, or `Reject`, with evidence.

A rejected/deprioritised option remains part of the Spike evidence. Return to the existing ranked option set; do not create a new Spike merely because one option failed.

## Investigation discipline

For each iteration:

1. Separate established facts from hypotheses and third-party claims.
2. Prefer direct observation of the real boundary when legally, safely and practically possible.
3. Use representative environments/data/permissions/providers/protocol variants proportionate to the question.
4. Make the experiment reproducible before drawing conclusions.
5. Keep hypotheses tied to the currently selected option and return to the ranked option set when the option-viability checkpoint says deeper diagnosis is no longer justified.
6. Compare materially credible alternatives proportionately; the initial option scan establishes the comparison set and later evidence may add/remove options.
7. Preserve enough evidence to audit the result without retaining secrets or unnecessary sensitive/raw content.
8. Record variability and limitations; do not generalise beyond the evidence.
9. Classify the experiment result as `Supported`, `Rejected`, or `Inconclusive`.
10. Update the option status and investigation backlog from what was learned.

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

If evidence shows that a product/architecture constraint itself must change, record the implication, recommend the resulting decision path, state exactly what must be decided, and stop for the owner/product decision.

Do not use passive checkpoint language as a substitute for ownership. Statements such as "the next experiment awaits owner review", "a token was unavailable", or "the Spike remains open" are incomplete unless accompanied by the recommended next action, blocker impact, recovery path and exact owner decision required.

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

For an iteration, report the Spike Issue, current iteration, hypothesis, experiment, environment/data, retained evidence, result, learning and updated current understanding.

Then provide a **decision-ready checkpoint** containing:

- **Recommended next iteration/action:** one clear recommendation owned by the agent;
- **Why this is next:** the uncertainty resolved and why it has the highest current information value;
- **Prerequisite/blocker status:** `None` or, for each item, whether it affected the completed iteration, whether it blocks the next iteration, and the concrete recovery/action;
- **Owner decision requested:** the exact approval, redirect or material decision required;
- **Consequence of approval:** what the agent will execute next;
- **Consequence of non-approval/redirect:** what remains unresolved.

Do not end an iteration report with only "awaiting review", "owner review required", an open-ended problem statement, or a missing prerequisite with no impact/recovery explanation.

For final completion, additionally report the supported technical specification or infeasibility conclusion, limitations, downstream implications, validation result, final PR state and downstream reassessment required.

## Learning checkpoint

Before completing each iteration, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or implementation methodology. A normal failed hypothesis is not automatically a learning. When a reusable lesson exists, use `capture-learning`; otherwise report `Learnings: None`.
