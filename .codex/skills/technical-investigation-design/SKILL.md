---
name: technical-investigation-design
description: Produce the top-down Technical Investigation Design for a Technical Spike before experiment execution begins.
---

# Technical Investigation Design

Use the canonical `.codex/templates/technical-investigation-design.md` template for every Technical Spike.

The TID is a Spike-specific design artifact. It is not the normal Feature/Bug HLD and does not change the downstream HLD/Implementation Plan/LLD lifecycle.

## Inputs

Read:

- the controlling Technical Spike Issue;
- blocked downstream Issue(s);
- current Product Definition and Architecture Definition;
- relevant repository behaviour/configuration;
- authoritative external documentation;
- retained prior evidence, including historical Spike evidence where applicable.

The dedicated Spike branch/workspace must already exist.

## Design responsibility

Build a coherent top-down investigation model before experiments begin:

1. explain the Issue/downstream context;
2. separate established facts from material unknowns;
3. define stable workstreams where useful;
4. perform a proportionate scan of materially credible technical approaches;
5. describe each option's high-level technical shape, system fit, dependencies, constraints and known limitations;
6. define the interaction/responsibility boundaries that experiments must preserve;
7. define representative evidence and decision criteria;
8. make excluded directions/non-goals explicit.

Do not turn the TID into an experiment log, detailed troubleshooting plan, file-level design or production HLD.

Candidate approaches do not all need testing. Initial disposition/prioritisation belongs in the TID; the Spike Implementation Plan decides the actual traversal and fallback route.

## Evidence discipline

Official/provider specifications and direct retained observations are authoritative within their demonstrated scope. Third-party/community implementations are useful evidence about possible approaches but are not specifications unless the provider explicitly says so.

Do not fill unknowns by assumption. It is valid for the TID to state what the Spike must establish empirically.

## Change boundary

The TID should remain relatively stable during execution. Update/review it only when evidence materially changes:

- the workstream decomposition;
- the credible option set or selected architectural direction;
- product/architecture/dependency boundaries;
- material evidence criteria;
- explicit non-goals.

Do not allow `technical-spike.md` chronology to redefine the investigation design implicitly.

## Approval

Prepare the TID for explicit owner approval before Spike Implementation Planning. Approval means the investigation design is suitable to constrain experimentation; it does not claim feasibility.

## Completion contract

Report the artifact path/ID, Issue, workstreams, candidate options and dispositions, technical interaction model, evidence criteria, boundaries/non-goals, open questions and approval state.
