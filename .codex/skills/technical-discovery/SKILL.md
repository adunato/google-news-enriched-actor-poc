---
name: technical-discovery
description: Execute a prerequisite technical investigation for a material undocumented or unknown external/runtime boundary and produce reproducible evidence before downstream design or implementation proceeds.
---

# Technical Discovery

Use this skill only for a GitHub Technical Discovery Issue created because a material technical unknown prevents responsible downstream design or implementation.

Technical Discovery answers a technical question. It does **not** implement the blocked product feature.

## Inputs

Read:

- the Technical Discovery Issue and its evidence/exit criteria;
- each blocked downstream Feature/Bug Issue;
- `docs/product.md`;
- `docs/architecture.md`;
- relevant source/tests/configuration;
- existing official documentation and retained repository evidence;
- relevant third-party/community implementations or reports as leads, not as authoritative specifications unless the provider explicitly documents them.

Create or update:

`docs/changes/<discovery-issue-number>/technical-discovery.md`

from the canonical template.

## Investigation discipline

1. State the exact unknown and the downstream decision it blocks.
2. Separate established facts from hypotheses and third-party claims.
3. Define representative environments, data, accounts/permissions, providers, protocol variants, or other dimensions needed to answer the question responsibly.
4. Design bounded, reproducible probes or experiments before drawing conclusions.
5. Prefer direct observation of the real boundary when legally, safely, and practically possible.
6. Compare materially credible alternatives when the question is which integration approach is viable.
7. Preserve enough evidence to reproduce and audit the result without retaining secrets or unnecessary sensitive/raw content.
8. Record variability and limitations; do not generalise beyond the evidence.
9. Conclude only `Feasible`, `Not feasible`, or `Inconclusive`.

A third-party library, script, blog post, issue, or reverse-engineered implementation is evidence about a possible approach. It is not the external system's specification. Validate the material behaviour independently before a downstream design relies on it.

## Code and repository boundaries

Disposable probes are allowed when needed to generate evidence. Keep them outside production/runtime code unless the Issue explicitly authorizes reusable investigation tooling.

Do not:

- implement the blocked production feature;
- silently turn a probe into production architecture;
- expand product scope;
- relax approved constraints merely to obtain a positive result.

If investigation shows that the product/architecture constraint itself must change, record that implication and stop. Route the decision through the appropriate Product/Architecture or POC methodology step.

## Completion gate

Technical Discovery is complete only when:

- every material exit criterion has evidence;
- representative variability has been covered proportionately;
- observations are distinguishable from inference;
- limitations are explicit;
- the conclusion is supported;
- downstream Issue implications are explicit.

An `Inconclusive` result is a valid discovery outcome but does not unblock implementation that depends on the unresolved behaviour.

After the discovery PR is integrated, rerun `assess-change` on every blocked downstream Issue. That reassessment decides HLD and Implementation Plan requirements using the discovery evidence.

## Validation and integration

Use the repository validation contract for any committed scripts/configuration and use the `validation` skill to check the discovery Issue's evidence/exit criteria and artifact consistency.

A Technical Discovery PR may contain the evidence artifact and narrowly scoped reproducibility tooling. It must not claim the downstream product feature is implemented.

## Completion contract

Report the discovery Issue, blocked downstream Issue(s), artifact path, environments/data investigated, probes/experiments, retained evidence, findings, limitations, conclusion, downstream implications, repository validation result, and whether downstream reassessment is authorized.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or implementation methodology. A normal failed hypothesis is not automatically a learning. When a reusable lesson exists, use `capture-learning`; otherwise report `Learnings: None`.
