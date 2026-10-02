---
name: technical-spike
description: Execute a Technical Spike through individually approved bounded experiments using its Issue, TID and Spike Implementation Plan as the controlling context.
---

# Technical Spike

Use this skill only for a GitHub Technical Spike Issue.

A Technical Spike answers one stable technical question through bounded experiments. The **Issue is the central work item**. The dedicated Spike branch is the working container. Do not open a pull request while the investigation is still active.

## Required inputs

Before the first experiment, read and confirm:

- the controlling Technical Spike Issue;
- approved `docs/changes/<issue>/technical-investigation-design.md`;
- approved `docs/changes/<issue>/spike-implementation-plan.md`;
- `docs/changes/<issue>/technical-spike.md`;
- blocked downstream Issue(s);
- Product Definition and Architecture Definition;
- relevant source/tests/configuration and retained evidence.

If the TID or Spike Implementation Plan is missing/unapproved, create/complete it through the dedicated skills before experiment execution.

## Authority model

The Issue defines **what must be answered**.

The TID defines **the technical search space, workstreams, candidate approaches, boundaries and evidence criteria**.

The Spike Implementation Plan defines **how that space is traversed: order, dependencies, entry/exit/fallback rules and stop/return conditions**.

`technical-spike.md` records **the current bounded experiment, evidence and accumulated technical conclusions**.

Do not allow chronological experiment history to redefine the TID or plan implicitly.

## Experiment boundary

Default execution is **one approved experiment at a time**.

The agent may autonomously make a **straightforward correction** only when it is required to complete the already-approved experiment and does not materially change:

- the hypothesis;
- the mechanism/approach being tested;
- architecture, dependency or runtime shape;
- scope, cost or risk;
- representative environment/data;
- what the resulting evidence would mean.

Examples include correcting a typo, malformed fixture, obvious invocation defect or equivalent mechanical error.

If the first reasonable correction does not resolve the problem and there is no obvious next fix, or further troubleshooting requires choosing a new technical direction, stop for an **Experiment Viability Checkpoint**.

Do not treat owner approval for one experiment as authority for a sequence of new diagnostic experiments.

## Experiment approval checkpoint

Before every new experiment, present a self-contained checkpoint. Assume the owner has not looked at this work for several days and has no Issue, TID, plan, previous checkpoint or code open.

Use this structure:

### 1. Issue context

Explain the underlying Issue first:

- what capability/problem the Issue is trying to resolve;
- why it matters to the product or downstream work;
- what currently prevents the Issue from being completed.

Do not start with the current experiment, library, error, hypothesis or implementation detail.

### 2. Spike context

Explain why a Technical Spike is being used and what uncertainty it must resolve.

Then state:

- current TID workstream;
- current TID candidate/approach;
- why that candidate is being investigated now under the Spike Implementation Plan;
- what evidence would finish this part of the investigation or justify moving elsewhere.

Expand acronyms and technical mechanisms sufficiently for a reader without recent context.

### 3. Previous experiment

Explain:

- what was tested;
- why that test was necessary in the wider investigation, not merely its immediate technical purpose;
- what it was expected to establish;
- what actually happened.

Do not use experiment IDs, library names or diagnostic terms as substitutes for explanation.

### 4. Current understanding

State:

- what the evidence established;
- what it ruled out;
- what remains unknown;
- whether the current TID candidate still appears sensible.

Separate observation from interpretation.

### 5. Proposed next experiment

Describe exactly one bounded experiment:

- what will be tested;
- why it is now the next question;
- what changes from the previous experiment;
- what evidence would support, reject or leave the hypothesis inconclusive.

### 6. Direction check

Explain why the experiment is proportionate to the original Issue and consistent with the TID and Spike Implementation Plan.

Explicitly state whether it introduces any new architecture, infrastructure, dependency, runtime/security mechanism or broader scope. If any are introduced, do not treat the change as routine troubleshooting; route it through the appropriate plan/TID/owner decision first.

### 7. Decision requested

Request exactly one of:

**Approve this experiment / Redirect the investigation / Stop and reconsider the approach.**

Do not execute the new experiment until it is approved.

## Experiment Viability Checkpoint

Trigger this checkpoint before deeper troubleshooting when:

- the first reasonable correction did not resolve the problem and there is no obvious next fix;
- additional debugging requires new machinery, infrastructure, dependencies, guards, wrappers or architectural assumptions;
- the troubleshooting problem is becoming materially different from the question the experiment was intended to answer;
- several plausible causes now require a new investigation to distinguish;
- the expected troubleshooting effort/risk is becoming disproportionate to the information value of the experiment;
- the agent is progressively creating specialised diagnostics instead of making progress on the approved hypothesis.

Report:

### Original purpose
What the approved experiment was intended to establish and why that matters to the Issue.

### What went wrong
What failed and which straightforward correction(s) were already attempted.

### Why this is no longer routine troubleshooting
What additional complexity or new decision is now required.

### Perspective check
Whether continuing this experiment still has better information value than stepping back to another TID option or revisiting the plan/TID.

### Recommendation
One of: **continue troubleshooting / modify the experiment / abandon this experiment and return to the planned option set / review the TID**.

### Decision requested
Ask the owner to approve or redirect that recommendation.

The governing principle is: **troubleshooting depth must remain proportional to the value of the experiment**.

## Option viability and rabbit-hole control

Repeated, stubborn or surprising failures also require an option-level perspective check before deeper candidate-specific diagnostics.

Use the TID and Spike Implementation Plan to determine whether the current option remains justified. Explicitly decide:

- `Continue`;
- `Deprioritise`;
- `Reject`;
- `TID review required`.

Do not respond to a failing candidate by inventing progressively more specialised infrastructure merely because it could make the latest experiment pass.

## Investigation discipline

For each approved experiment:

1. keep the hypothesis tied to the current TID option and plan route;
2. prefer direct observation of the real boundary when practical;
3. use representative environment/data proportionate to the claim;
4. make the experiment reproducible;
5. separate facts, inference and third-party claims;
6. preserve only necessary sanitized evidence;
7. classify the result as `Supported`, `Rejected` or `Inconclusive`;
8. update `technical-spike.md` before proposing the next experiment.

A failed/inconclusive experiment does not complete the Spike and does not create a new Spike Issue.

## Repository and PR behaviour

Use one long-lived branch/workspace for the controlling Issue, normally `spike/<issue>-<slug>`.

Store:

```text
docs/changes/<issue>/
  technical-investigation-design.md
  spike-implementation-plan.md
  technical-spike.md
  experiments/        # only where useful
```

Commits preserve the working history. The Issue remains the tracking centre.

**Do not open or maintain a draft PR during the investigation.**

Create the pull request only after:

- the original Technical Question has a supported `Feasible` or `Not feasible` conclusion;
- final Spike validation passes;
- the branch is ready to propose for integration.

## Completion gate

A Spike is ready to close only when the original Technical Question is resolved.

A `Feasible` conclusion requires representative evidence supporting a technical specification/approach downstream work may rely on.

A `Not feasible` conclusion requires evidence showing the Required Outcome cannot be achieved within the approved constraints and identifies the resulting Product/Architecture/POC decision.

After final integration, rerun `assess-change` on every blocked downstream Issue.

## Completion contract

For each iteration, report the Issue, TID workstream/approach, approved hypothesis, experiment, representative environment/data, evidence, result, learning, current understanding and whether an experiment/option viability checkpoint was triggered.

Before a new experiment, use the full self-contained approval checkpoint above.

For final completion, report the supported technical specification or infeasibility conclusion, limitations, downstream implications, validation result and final PR state.

## Learning checkpoint

Consider whether execution exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
