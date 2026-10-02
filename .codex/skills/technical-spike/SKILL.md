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

Before every new experiment, give the project owner a self-contained approval summary.

Write it for a person who understands the product at a general level but may not have looked at this Issue or Spike for days or weeks. They must not need to open the Issue, TID, Spike Implementation Plan, `technical-spike.md`, previous checkpoints, code or PR history to understand the decision.

### Communication rules

Apply these rules throughout the whole checkpoint:

- Start from the product/problem context and progressively narrow down to the proposed experiment.
- Use clear, non-specialist language wherever possible.
- Do not use an Issue number as an explanation. If mentioning `#4`, first explain what Issue #4 is and what it is trying to achieve, then use the number as shorthand.
- Do not use TID workstream IDs, approach IDs, hypothesis IDs, PR numbers, artifact names, library names, internal mechanism names or historical experiment names without first explaining what they mean and why they matter.
- Do not assume the owner remembers previous experiments, previous decisions, architecture discussions or implementation history.
- Introduce technical terminology only when it is necessary to understand the decision, and explain it when first introduced.
- Describe technical mechanisms in terms of what they do before naming them.
- Separate the information needed to make the decision from execution detail. Do not fill the owner summary with fixture hashes, commands, request counts, file paths, configuration values or other implementation parameters unless one of those values is itself material to the decision.
- Prefer explaining cause, consequence and decision over reproducing the technical record.
- The checkpoint must be understandable from top to bottom without knowledge introduced elsewhere.

### 1. Product and Issue context

Re-establish the wider context before discussing the Spike.

Explain:

- what part of the product or capability this work relates to;
- what the relevant downstream Issue or Issues are trying to achieve, in normal language;
- why those Issues matter;
- what currently prevents them from progressing.

If Issue numbers are useful for traceability, mention them only after explaining what each Issue means.

The reader should finish this section understanding the underlying product problem even if they remember nothing about the Spike.

### 2. Why this Spike exists

Explain:

- what important technical uncertainty prevents the Issue from being solved normally;
- why experimentation is needed;
- what the Spike is ultimately trying to establish.

Then explain where the investigation currently is in that wider journey.

If referring to a TID workstream or candidate approach, first explain what that part of the investigation is trying to determine in ordinary language, then provide the ID in parentheses if useful.

Do not begin with IDs such as `W1/A1`.

### 3. What we have learned so far

Summarise only the previous evidence necessary to understand the next decision.

Explain:

- what we previously believed or needed to establish;
- what was tested or observed;
- what the result tells us;
- what it does **not** tell us;
- what question therefore remains.

Do not present a chronological experiment log.

Do not say only that “H3 failed”, “Readability timed out”, or “the RPC path worked”. Explain what was being attempted, why it mattered to the wider problem, and what that result means.

If this is the first experiment, state that clearly and summarise the historical evidence that led to this starting point.

### 4. What we propose to do next

Describe exactly one experiment.

Start with the question the experiment is intended to answer.

Then explain, at the level needed for an owner decision:

- what we will try;
- why this experiment is the next sensible way to reduce the remaining uncertainty;
- how it differs from what has already been established;
- what a successful result would tell us;
- what a failed result would tell us.

Keep detailed execution instructions in the technical Spike record unless they materially affect the owner's decision.

### 5. Direction and complexity check

Explicitly step back from the immediate experiment.

State:

- why continuing in this direction still makes sense given the original Issue;
- whether the proposed experiment stays within the existing TID and Spike Implementation Plan;
- whether it introduces any new architecture, infrastructure, dependency, runtime mechanism, security mechanism, significant operational burden, cost or scope.

If none are introduced, say so plainly.

If the proposed experiment requires new machinery or materially deeper troubleshooting, explain why the investigation has become more complicated than expected and do not proceed without the owner's decision.

### 6. Recommendation

Give one clear recommendation in normal language.

Explain briefly why this is preferable to:

- continuing to troubleshoot the previous experiment;
- switching to another known approach;
- stopping or reconsidering the current direction.

The agent owns this recommendation. Do not make the owner reconstruct it from the evidence.

### 7. Decision requested

End with a short, explicit choice:

**Approve this experiment / Redirect the investigation / Stop and reconsider the approach.**

State in one sentence exactly what approval authorises.

Approval applies only to this bounded experiment and straightforward mechanical corrections within it. It does not authorise a new troubleshooting strategy, new technical mechanism or subsequent experiment.

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
