---
name: technical-investigation-design
description: Produce the top-down Technical Investigation Design for a Technical Spike before individual experiments begin.
---

# Technical Investigation Design

Use the canonical `.codex/templates/technical-investigation-design.md` template for every Technical Spike.

Start from the controlling Spike Issue, Product Definition, Architecture Definition, relevant repository state, authoritative external documentation, and proportionate upstream/community evidence.

The TID gives the Spike perspective before execution. It defines the technical search space, not the experiment history.

## Responsibilities

Define:

- the stable investigation objective and downstream decision;
- established facts and material unknowns;
- workstreams/boundaries where useful;
- materially credible candidate approaches and their high-level technical shape;
- candidate priority/disposition and why;
- investigation strategy across those candidates;
- evidence/success/escalation criteria;
- constraints, exclusions and the design-change rule.

Perform a proportionate option scan sufficient to identify credible approaches. Do not turn the Spike into broad market/domain research.

Do not define individual hypotheses, iteration numbers, experiment procedures, chronological findings, production file edits, or a production HLD.

Use stable IDs for workstreams and candidate approaches so the Spike Implementation Plan and `technical-spike.md` can reference them directly.

## Approval

The TID requires explicit owner approval before the Spike Implementation Plan is approved and experiments begin.

If evidence later materially changes the workstream decomposition, candidate set, architectural mechanism, constraints or investigation strategy, update/review the TID before continuing down the changed direction.

## Completion contract

Report the TID path/ID, Issue, workstreams, candidate approaches/dispositions, investigation strategy, evidence criteria, boundaries, unresolved design questions and approval state.

## Learning checkpoint

Consider whether creating the TID exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
