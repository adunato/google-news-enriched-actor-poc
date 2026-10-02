---
name: spike-implementation-plan
description: Translate an approved Technical Investigation Design into the ordered execution route for a Technical Spike without predefining individual experiments.
---

# Spike Implementation Plan

Use the canonical `.codex/templates/spike-implementation-plan.md` template for every Technical Spike after its TID is approved.

Start from the controlling Spike Issue and approved TID. Use the TID's workstream and candidate IDs directly.

## Responsibilities

Define:

- which TID workstream/candidate is investigated first;
- dependencies that constrain order;
- entry and exit conditions;
- when sufficient evidence stops a workstream;
- when a fallback candidate becomes eligible;
- when the route returns to TID review;
- the execution envelope inside which individual experiments may vary;
- the final route to a supported Spike conclusion.

Do not duplicate the TID's architecture/option analysis and do not create a second naming scheme such as unrelated stages. Do not define the current hypothesis, exact experiment, diagnostic procedure or chronological findings; those belong to `technical-spike.md`.

The plan need not test every TID candidate. It must make explicit when testing stops because the required outcome has already been demonstrated.

## Approval

The plan requires explicit owner approval before the first experiment begins.

Update/review the plan when evidence changes major ordering, dependencies, entry/exit/fallback rules or execution boundaries. A new technical approach not present in the TID requires TID review first.

## Completion contract

Report the plan path/ID, TID reference, execution map, dependencies, execution envelope, stop/return rules, completion route, unresolved planning questions and approval state.

## Learning checkpoint

Consider whether planning exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
