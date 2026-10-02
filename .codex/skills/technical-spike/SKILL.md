---
name: technical-spike
description: Execute one owner-approved Technical Spike experiment at a time within an approved Technical Investigation Design and Spike Implementation Plan.
---

# Technical Spike

Use this skill only for a controlling GitHub Technical Spike Issue.

The Issue is the central work item. The dedicated Spike branch is the working container. Do not open or maintain a draft pull request during ordinary investigation; the final PR is created only after the Spike reaches a supported conclusion and final validation passes.

## Required inputs

Before proposing the first experiment, read:

- the Technical Spike Issue and completion criteria;
- each blocked downstream Issue;
- the approved `docs/changes/<issue>/technical-investigation-design.md`;
- the approved `docs/changes/<issue>/spike-implementation-plan.md`;
- `docs/product.md`, `docs/architecture.md` and `AGENTS.md`;
- relevant source/tests/configuration and retained evidence.

Create/update:

`docs/changes/<issue>/technical-spike.md`

from the canonical template.

If the TID or Spike Implementation Plan is missing/unapproved, do not begin experimentation.

## Experiment selection

Use the Spike Implementation Plan to identify the currently eligible workstream/option. Within that boundary, select the single bounded hypothesis/experiment with the highest current information value.

Do not silently move to another TID option, add an unplanned subsystem/dependency, or redefine the investigation route. Those changes require the appropriate TID/plan review first.

## Owner approval boundary

**One experiment is approved at a time.** Do not treat approval of an option/workstream as blanket authority for open-ended troubleshooting or multiple experiments.

Before every experiment, present the following self-contained checkpoint. Assume the owner has not looked at this work for several days and has no Issue, TID, plan, previous checkpoint or code open.

### Spike experiment approval checkpoint

**1. Issue context**

Explain the underlying Issue first:

- what capability/problem the Issue is trying to resolve;
- why that matters to the product or downstream work;
- what currently prevents the Issue from being completed.

Do not start with the experiment, library, error, hypothesis or implementation detail.

**2. Spike context**

Explain why a Technical Spike is being used and what uncertainty it must resolve. Then identify:

- current TID workstream;
- current candidate/option;
- why that option is being investigated now;
- what evidence would complete this part of the investigation or cause a planned transition.

Expand acronyms/mechanisms enough for a reader who has not followed previous iterations.

**3. Previous experiment**

Explain:

- what was tested;
- why that test was necessary in the wider investigation;
- what it was expected to establish;
- what actually happened.

For the first experiment, state that there is no previous experiment.

Do not use internal labels such as hypothesis IDs, fixture names or library names as if they are self-explanatory.

**4. Current understanding**

State:

- what the evidence established;
- what it ruled out;
- what remains unknown;
- whether the current option still appears sensible.

Separate evidence from interpretation.

**5. Proposed next experiment**

Describe exactly one bounded experiment:

- what will be tested;
- why this is the next question;
- what changes compared with the previous experiment;
- what evidence supports/rejects the hypothesis.

**6. Direction check**

Explain why the experiment is proportionate to the original Issue and consistent with the TID and Spike Implementation Plan.

Explicitly state whether it introduces any new architecture, infrastructure, dependency, runtime/security mechanism or broader scope. If it does, this is a material decision and the relevant design/plan must be reviewed before execution.

**7. Decision requested**

Request exactly one of:

**Approve this experiment / Redirect the investigation / Stop and reconsider the approach.**

Do not execute until the experiment is approved.

## Execution authority

After approval, execute only the approved experiment.

The agent may make **straightforward corrections** needed to complete that exact experiment when the correction is unambiguous and does not change:

- the hypothesis/question being tested;
- the technical mechanism/candidate under test;
- architecture or dependency model;
- representative environment/data in a way that changes evidence meaning;
- cost/risk/security boundaries;
- the experiment's intended evidence.

Examples include an obvious typo, path error, deterministic configuration mistake or similarly mechanical defect with one clear correction.

## Experiment Viability Checkpoint

Stop and return to the owner when troubleshooting ceases to be straightforward. Trigger this checkpoint when any of the following occurs:

- the first reasonable correction does not resolve the problem and there is no obvious next fix;
- the proposed fix requires new machinery, infrastructure, dependencies, guards, wrappers or architecture not present in the approved experiment;
- troubleshooting becomes materially different from the question the experiment was meant to answer;
- several plausible causes exist and choosing among them requires a new investigation;
- diagnosis effort/risk becomes disproportionate to the information value of the experiment;
- increasingly specialised diagnostics are being added without clear progress on the original hypothesis.

Do **not** choose another deeper diagnostic direction before owner review.

Present a self-contained checkpoint that again starts with the Issue/Spike context, then states:

**Original experiment purpose:** what this experiment was meant to establish and why it matters.  
**What went wrong:** failure and straightforward correction(s) already attempted.  
**Why this is no longer routine troubleshooting:** the new complexity/decision now required.  
**Perspective check:** whether continuing this experiment/candidate still has better information value than modifying/abandoning it or returning to the TID option set.  
**Recommendation:** Continue troubleshooting / Modify the experiment / Abandon this experiment and return to the plan/TID.  
**Decision requested:** Approve the recommendation / Redirect / Stop.

## After an experiment

1. retain reproducible/sanitized evidence;
2. record the result as `Supported`, `Rejected` or `Inconclusive`;
3. update Current Understanding and Supported Technical Specification;
4. assess the result against the current plan transition/exit conditions;
5. if the Spike remains open, propose the next experiment through the full approval checkpoint above.

A failed/inconclusive experiment does not create a replacement Spike Issue.

If evidence changes the credible search space or architectural assumptions, update/review the TID first. If it changes only workstream/option order, entry/exit conditions or fallback route, update/review the Spike Implementation Plan first.

## Code and repository boundaries

Disposable probes and reproducibility tooling are allowed. Keep experiment-specific files under `docs/changes/<issue>/experiments/<NN>-<slug>/` or another clearly non-production location when they materially improve reproducibility/auditability.

Do not:

- implement the blocked production feature;
- turn a probe into production architecture implicitly;
- expand product scope;
- relax approved constraints to obtain a positive result;
- open a PR merely to provide an in-progress Spike workspace.

## Completion gate

The Spike can conclude only when the original Technical Question is resolved:

- **Feasible** — representative evidence supports a technical specification/approach sufficiently for downstream design;
- **Not feasible** — representative evidence shows the Required Outcome cannot be achieved within approved constraints and identifies the resulting decision.

Before final integration, run final Spike validation. Only after final validation passes should `merge-change` create the integration PR with the Issue/TID/plan/technical-spike evidence.

After human merge, rerun `assess-change` on every blocked downstream Issue.

## Completion contract

For each experiment report the Issue, workstream/option, approved hypothesis/experiment, evidence, result, corrections attempted, viability-checkpoint status and updated technical understanding.

For final completion additionally report the Feasible/Not feasible conclusion, evidence boundary, downstream implications, final validation result and readiness for final PR.

## Learning checkpoint

Before completing each experiment, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI or implementation methodology. A normal failed hypothesis is not automatically a learning. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
