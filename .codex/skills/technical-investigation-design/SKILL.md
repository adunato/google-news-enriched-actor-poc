---
name: technical-investigation-design
description: Produce the complete pre-execution Technical Investigation Design for a Technical Spike, including its bounded experiments, sequence, conditional routing and evidence criteria.
---

# Technical Investigation Design

Use the canonical `.codex/templates/technical-investigation-design.md` template for every Technical Spike.

Start from the controlling Spike Issue, Product Definition, Architecture Definition, relevant repository state, authoritative external documentation, and proportionate prior/community evidence.

The TID is the **single pre-execution design and routing artifact** for a Technical Spike. It must be sufficiently complete that an executor can follow the approved experiment sequence without inventing a second implementation plan.

## Responsibilities

Define:

- the stable Technical Question and downstream decision;
- the product/capability context in plain language;
- established evidence that materially shapes the investigation;
- optional Investigation Areas only where genuinely separable technical questions improve clarity;
- the bounded experiments needed to resolve each area;
- for every experiment: objective, why it exists, test, measures, execution rule and decision/next step;
- a concise experiment-sequence table showing order, optionality, prerequisites and success/failure routing;
- representative evidence and quantitative success/exit criteria;
- constraints, exclusions and the rule for returning to TID review;
- how completed areas combine into a final Feasible or Not feasible conclusion.

Do not create abstract workstreams or candidate-approach taxonomies when the investigation can be expressed directly as experiments. Do not split one experiment's rationale, evidence criteria and transition logic across unrelated sections.

The TID defines **planned experiments**. It does not record chronological execution findings; those belong in `technical-spike.md`.

## Human-readable design rules

Write for an owner who understands the product generally but may not remember the Issue or repository history.

- Explain the capability/problem before introducing the Spike mechanics.
- Name an Issue or capability in words before using `#number` as shorthand.
- Do not use an identifier as an explanation.
- Explain what a technical mechanism does in ordinary language before relying on its technical name.
- State why each experiment exists in light of prior evidence; do not include a baseline test with no explanation of what it discriminates.
- Prefer concrete, familiar measures over clever proxy metrics.
- Make experiment order and conditionality mechanical rather than inferable from prose.
- Avoid overlapping sections that restate the same concept from different angles.
- Keep each Investigation Area and each experiment understandable on its own.

Third-party/community implementations may support a hypothesis or comparison but are not authoritative specifications unless the provider explicitly documents them as such.

## Approval and execution authority

The TID requires explicit owner approval before experiment execution begins.

Approval authorises the executor to run the experiments and conditional transitions already defined in the TID. Do **not** request separate owner approval for every experiment.

Return for TID review/owner decision when evidence would require:

- a new experiment not represented by the approved design;
- a materially different mechanism, dependency, runtime, architecture or security model;
- changed representative data, evidence meaning, success threshold or scope;
- troubleshooting that has become a distinct investigation rather than a straightforward correction inside the approved experiment.

A straightforward mechanical correction may be made autonomously when it is necessary to execute the approved test and does not change what is being tested or what the evidence would mean.

## Completion contract

Report the TID path/ID, Issue, Investigation Areas where used, experiment sequence and conditional routing, evidence/success criteria, boundaries, unresolved design questions and approval state.

## Learning checkpoint

Consider whether creating the TID exposed a reusable lesson. Use `capture-learning` when warranted; otherwise report `Learnings: None`.
