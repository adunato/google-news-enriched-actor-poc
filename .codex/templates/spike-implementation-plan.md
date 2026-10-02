# Spike Implementation Plan: <Spike question / boundary>

> Canonical Spike-specific execution-plan artifact. It translates the approved Technical Investigation Design into an ordered investigation route. It does not define individual hypotheses or experiment procedures.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<#issue or URL>`  
**Technical Investigation Design:** `<path and artifact ID>`  
**Spike branch:** `<branch>`  
**Blocked downstream Issue(s):** `<#issue(s) or URL(s)>`

## 1. Execution Purpose

<Explain how this plan traverses the TID's workstreams/options to answer the controlling Technical Question without predefining the detailed experiments.>

## 2. Execution Authority

- The **Issue** defines the stable question, constraints and completion criteria.
- The **TID** defines the approved workstreams, candidate approaches and evidence boundaries.
- This **Spike Implementation Plan** defines the order, dependencies, entry/exit conditions and fallback transitions.
- `technical-spike.md` owns the current hypothesis, approved experiment, evidence and experiment history.

If evidence requires a material change to the TID search space, revise/review the TID before changing this plan.

## 3. Workstream and Option Execution Map

Make explicit whether an option is always tested, conditionally tested, reference-only or excluded, and when investigation stops instead of testing every candidate.

| Workstream | TID option | Execution role / order | Entry condition  | Exit condition                  | Fallback / next state       |
| ---------- | ---------- | ---------------------- | ---------------- | ------------------------------- | --------------------------- |
| W1         | O1         | <Primary / first>      | <when eligible>  | <evidence that ends this path>  | <O2 / conclude / TID review> |

## 4. Dependencies and Sequencing

<Describe only material dependencies between workstreams/options and any evidence that must exist before another path can be tested responsibly.>

## 5. Experiment Boundary

Each experiment is individually proposed and owner-approved through the Technical Spike skill.

This plan does **not** prescribe the experiment backlog. Within the currently authorised workstream/option, the agent proposes the next bounded hypothesis/experiment based on evidence.

The agent may make only straightforward corrections needed to complete the approved experiment. Non-trivial troubleshooting triggers an Experiment Viability Checkpoint before a new diagnostic direction is pursued.

## 6. Transition and Fallback Rules

<State the decision rules for moving between TID options/workstreams, including when success ends a workstream, when option viability requires fallback, and when evidence requires TID review instead of deeper troubleshooting.>

## 7. Spike Completion Path

<Map the TID evidence criteria to the conditions needed for a supported `Feasible` or `Not feasible` Spike conclusion.>

## 8. Open Planning Questions

<Questions that prevent this execution route from being approved. If none: “No outstanding Spike planning questions.”>

### Approval

**Decision:** `<Approve Spike execution plan | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up before first experiment:** `<actions or None>`

### Completion contract

The plan is complete when every active TID workstream has an explicit execution/fallback route, dependencies and transition conditions are clear, the per-experiment approval boundary is preserved, and no unresolved planning decision prevents the first bounded experiment.
