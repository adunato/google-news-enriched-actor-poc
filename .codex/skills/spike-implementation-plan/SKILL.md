---
name: spike-implementation-plan
description: Translate an approved Technical Investigation Design into the ordered execution and fallback route for a Technical Spike.
---

# Spike Implementation Plan

Use the canonical `.codex/templates/spike-implementation-plan.md` template for every Technical Spike after the TID is approved and before the first experiment is executed.

This is a Spike-specific plan. It does not replace the normal Feature/Bug Implementation Plan.

## Inputs

Read:

- the controlling Technical Spike Issue;
- the approved TID;
- blocked downstream Issue(s);
- relevant repository/runtime constraints.

## Planning responsibility

Define the investigation route across the TID without predefining individual experiments.

For each TID workstream/option, make explicit:

- whether it is primary, conditional/fallback, reference-only or excluded;
- when it becomes eligible for testing;
- the evidence/condition that ends that path;
- whether success stops the workstream or further comparison is required;
- which fallback/next state follows failure or option rejection;
- dependencies on other workstreams/options.

The plan must make clear that candidate options are not automatically all tested. Stop when the TID's required evidence is established.

## Boundary with Technical Spike execution

The plan does not contain the hypothesis backlog or detailed experiment procedures.

The `technical-spike` skill owns the next bounded hypothesis/experiment within the currently authorised TID option and requires owner approval for each experiment.

A material change to the TID search space requires TID review first. A material change to workstream/option order, entry/exit criteria or fallback route requires this plan to be updated/reviewed before execution continues.

## Troubleshooting control

Preserve the experiment-level approval boundary. The plan must not grant blanket authority for open-ended troubleshooting.

Straightforward corrections may be handled inside the approved experiment. When troubleshooting becomes a new investigation direction, requires material new machinery/dependencies, or becomes disproportionate to the experiment's information value, the Technical Spike skill must stop at an Experiment Viability Checkpoint.

## Approval

Prepare the plan for explicit owner approval before the first experiment.

## Completion contract

Report the artifact path/ID, Issue/TID references, workstream/option execution map, dependencies, transitions/fallbacks, completion path, open questions and approval state.
