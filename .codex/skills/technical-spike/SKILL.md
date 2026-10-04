---
name: technical-spike
description: Execute an approved Technical Spike TID autonomously through its bounded experiment sequence while recording evidence and stopping when execution would leave the approved design.
---

# Technical Spike

Use this skill only for a GitHub Technical Spike Issue.

A Technical Spike answers one stable technical question through bounded experiments.

The **Issue is the central work item**. The dedicated Spike branch is the working container. Do not open a pull request while the investigation is still active.

## Required inputs

Before the first experiment, read and confirm:

- the controlling Technical Spike Issue;
- approved `docs/changes/<issue>/technical-investigation-design.md`;
- `docs/changes/<issue>/technical-spike.md`;
- blocked downstream Issue(s);
- Product Definition and Architecture Definition;
- relevant source, tests, configuration and retained evidence.

If the TID is missing or unapproved, create or complete it through the dedicated skill before experiment execution.

## Authority model

The Issue defines **what must be answered**.

The approved TID defines **the bounded experiments, why they exist, their order and conditionality, evidence criteria, boundaries and mechanical next-step rules**.

`technical-spike.md` records **the detailed current experiment, evidence and accumulated technical conclusions**.

Do not allow chronological experiment history to redefine the TID implicitly.

## Experiment boundary

TID approval authorises execution of its defined bounded experiment sequence.

Do **not** stop for owner approval before every experiment.

For each experiment:

1. confirm that its TID `Run when` condition is satisfied;
2. execute the test defined by the TID within its stated constraints;
3. record evidence and classify the result as `Supported`, `Rejected` or `Inconclusive`;
4. update `technical-spike.md`;
5. follow the TID's stated next-step rule automatically.

Conditional experiments are skipped when their trigger is not met. Do not run every experiment merely because it exists in the TID.

A failed required acceptance run remains failed for that code/configuration. Do not rerun it unchanged merely to seek a pass.

The agent may autonomously make a **straightforward correction** only when it is required to complete the TID-authorised experiment and does not materially change:

- the experiment objective or mechanism;
- architecture, dependency or runtime shape;
- scope, cost or risk;
- representative environment or data;
- what the resulting evidence would mean.

Examples include correcting a typo, malformed fixture, obvious invocation defect or equivalent mechanical error.

Stop and return to the owner when continuing would require:

- a new experiment not defined by the TID;
- a materially different mechanism, dependency, runtime, architecture, infrastructure/security model or scope;
- changing representative data, success criteria or evidence meaning;
- more than a straightforward correction because troubleshooting has become a distinct investigation;
- a Product/Architecture constraint change;
- effort disproportionate to the information value of the current experiment.

Do not turn this checkpoint into a micro-approval for the next experiment already authorised by the TID.

# Owner approval checkpoint

When a boundary checkpoint is required, generate a **new owner-facing checkpoint**.

This is not a summary of `technical-spike.md`.

Do not copy, compress or lightly rewrite the technical Spike record and present that as the checkpoint.

Instead, reconstruct the situation for the project owner from the relevant Issue, product context, approved TID and accumulated evidence.

The owner checkpoint is a separate communication artefact whose purpose is to let the owner understand the situation and make one informed decision without opening any repository artefact.

## Mandatory output contract

When requesting an owner boundary decision, the response **must contain these seven headings, in this order**:

1. `## Product and Issue context`
2. `## Why this Spike exists`
3. `## What we have learned so far`
4. `## What we propose to do next`
5. `## Direction and complexity check`
6. `## Recommendation`
7. `## Decision requested`

Do not replace these headings with alternative wording such as:

- `Checkpoint user summary`;
- `Why we need this experiment`;
- `Experiment summary`;
- `Current state`;
- `Approval request`.

Do not omit or merge sections.

If the response does not satisfy this structure, it is **not a valid owner checkpoint** and must be rewritten before being shown to the owner.

## Communication rules

Apply these rules throughout the entire checkpoint.

### Assume no recent context

Write for a project owner who understands the product at a general level but may not have looked at this Issue, Spike or repository for days or weeks.

The owner must not need to open:

- the Issue;
- the TID;
- `technical-spike.md`;
- previous checkpoints;
- previous PRs;
- code;
- experiment evidence;

to understand the decision.

### Start broad and narrow progressively

The explanation must follow this conceptual sequence:

**product capability/problem → affected Issue(s) → why they are blocked → why the Spike exists → what has been learned → where the investigation is now → proposed experiment → recommendation → decision**

Do not begin at the Spike, experiment, library, error, hypothesis or implementation level.

### Explain identifiers before using them

Do not use an identifier as an explanation.

Before using an Issue number such as `#4`, explain in normal language what that Issue is trying to achieve.

Before using any of the following, first explain what it means and why it matters:

- Issue numbers;
- TID investigation-area IDs;
- hypothesis IDs;
- experiment IDs;
- PR numbers;
- artifact names;
- branch names;
- library names;
- internal mechanism names;
- historical experiment names.

For example, do not write:

> A1 tests the marker/RPC flow required by #4.

Instead explain the meaning first:

> The first experiment is trying to establish whether ordinary web requests can reliably reach the existing publisher-link resolution mechanism. That experiment is tracked internally as A1.

Identifiers may then be used as shorthand after their meaning is established.

### Use owner-facing language

Use clear, concise, non-specialist language wherever possible.

Introduce technical terminology only when it is necessary for the owner to understand the decision.

When technical terminology is necessary:

1. explain what the mechanism does in ordinary language;
2. then give its technical name if useful.

Do not assume familiarity with terminology simply because it appears throughout the repository.

### Explain meaning, not chronology

Do not reproduce the experiment log.

Summarise evidence in terms of:

- what question we were trying to answer;
- what we observed;
- what that observation means;
- what it does not establish;
- what remains uncertain.

Avoid presenting a sequence of experiment IDs, commits, runs or historical implementation details unless they are directly necessary to understand the current decision.

### Separate decision context from execution detail

The owner checkpoint is not the experiment specification.

Detailed execution information belongs in `technical-spike.md` and supporting evidence.

Do not include details such as:

- fixture hashes;
- exact URLs;
- file paths;
- shell commands;
- individual request counts;
- exact redirect limits;
- response-size caps;
- memory allocation;
- low-level log fields;
- internal evidence filenames;
- detailed configuration values;

unless that particular detail materially affects the decision being requested.

For example, a proposed experiment having a meaningful financial exposure may require stating the cost ceiling.

The fact that a request timeout is 10 rather than 15 seconds normally does not.

### Prefer cause, consequence and decision

For every material technical fact included, explain why it matters.

The checkpoint should optimise for:

- understanding;
- direction;
- trade-offs;
- consequences;
- decision-making;

not technical completeness.

The detailed technical record already exists elsewhere.

## 1. Product and Issue context

Re-establish the wider context before discussing the Spike.

Explain:

- what part of the product or capability this work relates to;
- what the relevant downstream Issue or Issues are trying to achieve, in ordinary language;
- why those capabilities matter;
- what currently prevents those Issues from progressing.

If Issue numbers are useful for traceability, mention them **after** explaining what each Issue means.

The owner should finish this section understanding the underlying product problem without needing to know anything about the Spike.

Do not introduce TID investigation-area IDs, experiment IDs, hypotheses, libraries or experiment details in this section.

## 2. Why this Spike exists

Explain:

- what important technical uncertainty prevents normal implementation from proceeding;
- why existing documentation, code or previous evidence is insufficient;
- why empirical investigation is necessary;
- what the Spike ultimately needs to establish before downstream work can continue.

Then explain where the investigation currently sits in that wider journey.

If referring to a TID investigation area or experiment:

1. explain what that part of the investigation is trying to determine in ordinary language;
2. then provide the internal ID in parentheses if useful.

Do not start with wording such as:

> A1 is active.

Instead write the meaning first.

## 3. What we have learned so far

Summarise only the evidence necessary to understand the next decision.

Explain:

- what we previously believed or needed to establish;
- what was tested or observed;
- what the result tells us;
- what it does **not** establish;
- what important question remains.

Do not present a chronological experiment history.

Do not write statements such as:

> H3 failed.

> Readability timed out.

> RPC worked.

without explaining:

- what was actually being attempted;
- why that mattered to the wider product problem;
- what the observed result means.

If this is the first experiment under the current Spike, state that clearly and summarise only the historical evidence that explains why this is the proposed starting point.

## 4. What we propose to do next

Describe exactly **one** proposed direction or bounded change requiring the owner's decision.

If the proposal is a new or revised experiment, begin with the question that experiment is intended to answer.

Then explain:

- what we propose to change or try;
- why the current approved TID cannot simply continue without this decision;
- why this is the next sensible way to reduce the remaining uncertainty;
- how it differs from what has already been established or authorised;
- what a successful result would tell us;
- what a failed result would tell us;
- what would remain unresolved afterwards.

Describe the proposal at the level necessary for an owner decision.

Do not reproduce its full technical execution specification.

Where material, state significant bounds such as:

- meaningful cost exposure;
- use of a new external service;
- new credentials or permissions;
- material runtime/infrastructure changes;
- security or privacy implications.

Leave routine execution parameters in `technical-spike.md`.

## 5. Direction and complexity check

Explicitly step back from the immediate experiment.

State:

- why continuing in this direction still makes sense given the original product/Issue problem;
- whether the proposed direction remains inside the approved TID or requires the TID to be revised;
- whether it introduces any new architecture;
- whether it introduces new infrastructure;
- whether it introduces a new dependency;
- whether it introduces a new runtime mechanism;
- whether it introduces a new security mechanism;
- whether it introduces significant operational burden;
- whether it materially increases cost;
- whether it broadens scope.

If none of these changes are introduced, say so plainly.

For example:

> This remains inside the approved investigation approach. It introduces no new architecture, infrastructure, dependency or product scope.

If the proposed experiment requires new machinery, materially deeper troubleshooting or a different technical mechanism, explain that clearly and do not present it as routine continuation.

The owner must be able to see whether the investigation is still solving the original problem or beginning to create a new one.

## 6. Recommendation

Give one clear recommendation.

Do not merely describe the available choices.

State what the agent recommends and why.

Briefly compare the recommendation with the realistic alternatives:

- revising the TID and continuing;
- taking another route already authorised by the TID, if one exists;
- changing a Product/Architecture constraint;
- stopping or reconsidering the direction.

The agent owns this recommendation.

Do not make the owner infer the recommended direction from technical evidence.

Keep this concise.

## 7. Decision requested

End with the genuine boundary decision required from the owner.

Use the smallest decision appropriate to the situation, for example:

- **Revise the TID and continue / Keep the current TID / Stop the investigation**
- **Approve the required Product/Architecture change / Keep the existing constraint / Stop**

Then state, in one plain-language sentence, exactly what the owner's decision would authorise.

Approval applies only to the explicitly described change in investigation authority.

It does **not** implicitly authorise:

- additional experiments not represented by the revised TID;
- a different troubleshooting strategy;
- a different technical mechanism;
- a new dependency;
- new infrastructure;
- a material expansion of scope.

Do not continue beyond the approved TID boundary until the decision is received.

## Checkpoint self-review

Before presenting the checkpoint to the owner, verify all of the following:

- [ ] The seven mandatory sections are present in the required order.
- [ ] The first section starts from the product/problem level rather than the experiment.
- [ ] Every Issue number is explained before it is used as shorthand.
- [ ] Every internal investigation-area/experiment/hypothesis identifier is explained before it is used.
- [ ] Necessary technical mechanisms are explained in ordinary language.
- [ ] The owner does not need another artifact to understand the situation.
- [ ] Historical evidence is summarised by meaning rather than chronology.
- [ ] Routine execution details have been left out.
- [ ] The remaining uncertainty is explicit.
- [ ] The direction/complexity check explicitly states whether new machinery or scope is being introduced.
- [ ] The agent gives a clear recommendation.
- [ ] The requested decision is a genuine boundary decision rather than approval of an experiment already authorised by the TID.
- [ ] Any approval requested is explicitly bounded to the described change in authority.

If any check fails, rewrite the checkpoint before presenting it.

# Experiment Viability Checkpoint

Trigger this checkpoint before deeper troubleshooting when:

- the first reasonable correction did not resolve the problem and there is no obvious next fix;
- additional debugging requires new machinery, infrastructure, dependencies, guards, wrappers or architectural assumptions;
- the troubleshooting problem is becoming materially different from the question the experiment was intended to answer;
- several plausible causes now require a new investigation to distinguish;
- expected troubleshooting effort or risk is becoming disproportionate to the information value of the experiment;
- the agent is progressively creating specialised diagnostics instead of making progress on the approved hypothesis.

The purpose is to prevent a failed experiment from silently becoming a new engineering project.

## Viability checkpoint owner communication

The same owner-facing communication rules defined above apply here.

Do not begin with the technical failure.

First re-establish enough product, Issue and Spike context for the owner to understand why the failed experiment mattered.

Then explain:

### Original purpose

What the TID-authorised experiment was intended to establish and why that matters to the underlying Issue.

### What went wrong

Explain in ordinary language:

- what failed;
- what straightforward correction was attempted;
- what remains unexplained.

Include low-level diagnostic information only where necessary to understand the decision.

### Why this is no longer routine troubleshooting

Explain what additional investigation, complexity, machinery or technical decision would now be required.

### Perspective check

Step back to the original Issue and TID.

Explain whether continuing this experiment still appears to have better information value than:

- following another route already authorised by the TID;
- revising the TID;
- stopping the approach.

### Recommendation

Give one clear recommendation:

- **follow another route already authorised by the TID**;
- **revise the TID and continue**;
- **change a Product/Architecture constraint**;
- **stop the investigation**.

Explain why.

### Decision requested

Ask the owner to approve or redirect that recommendation.

The governing principle is:

**Troubleshooting depth must remain proportional to the value of the experiment.**

# Option viability and rabbit-hole control

Repeated, stubborn or surprising failures also require an option-level perspective check before deeper candidate-specific diagnostics.

Use the TID to determine whether the current experiment and route remain justified.

Explicitly decide:

- `Continue`;
- `Deprioritise`;
- `Reject`;
- `TID review required`.

Do not respond to a failing candidate by inventing progressively more specialised infrastructure merely because it could make the latest experiment pass.

A diagnostic mechanism is not automatically justified merely because it may help explain the previous failure.

Always compare its complexity and information value with the alternatives already represented by the TID or returning to TID review.

# Investigation discipline

For each TID-authorised experiment:

1. keep the experiment tied to the current TID question and authorised route;
2. prefer direct observation of the real boundary when practical;
3. use representative environment and data proportionate to the claim;
4. make the experiment reproducible;
5. separate observed facts, inference and third-party claims;
6. preserve only necessary sanitised evidence;
7. classify the result as `Supported`, `Rejected` or `Inconclusive`;
8. update `technical-spike.md`;
9. follow the TID's explicit next-step rule automatically;
10. generate an owner checkpoint only when execution reaches a genuine boundary outside the approved TID.

A failed or inconclusive experiment does not complete the Spike and does not create a new Spike Issue.

# Repository and PR behaviour

Use one long-lived branch/workspace for the controlling Issue, normally:

`spike/<issue>-<slug>`

Store:

```text
docs/changes/<issue>/
  technical-investigation-design.md
  technical-spike.md
  experiments/        # only where useful
```

Commits preserve the working history.

The Issue remains the tracking centre.

Do not open or maintain a draft PR during the investigation.

Create the pull request only after:

- the original Technical Question has a supported `Feasible` or `Not feasible` conclusion;
- final Spike validation passes;
- the branch is ready to propose for integration.

# Completion gate

A Spike is ready to close only when the original Technical Question is resolved.

A `Feasible` conclusion requires representative evidence supporting a technical specification or approach downstream work may rely on.

A `Not feasible` conclusion requires evidence showing that the Required Outcome cannot be achieved within the approved constraints and identifies the resulting Product, Architecture or POC decision.

After final integration, rerun `assess-change` on every blocked downstream Issue.

# Completion contract

For each experiment, maintain the detailed technical record in `technical-spike.md`, including:

- Issue;
- TID investigation area and experiment;
- experiment objective/hypothesis where applicable;
- representative environment/data;
- evidence;
- result;
- learning;
- current understanding;
- current TID route and any boundary status where applicable.

When requesting an owner boundary decision, do **not** present that technical record as the response.

Generate the separate owner-facing checkpoint defined by this skill.

For final Spike completion, report:

- the supported technical specification or infeasibility conclusion;
- material limitations;
- downstream implications;
- validation result;
- final PR state.

# Learning checkpoint

Consider whether execution exposed a reusable lesson.

Use `capture-learning` when warranted; otherwise report:

`Learnings: None`.
