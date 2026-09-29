# Learning Record

**Learning ID:** google-news-enriched-actor-poc--issue-14--calibration-failure-diagnostics

**Origin repository:** adunato/google-news-enriched-actor-poc

**Source:** GitHub Issue #14

**Lifecycle stage / skill:** Technical Spike execution / `capture-learning`

**Date:** 2026-09-29

**Category:** Tooling/CI

**SideGig review:** Yes

**Disposition:** Applied locally

## Change context

Issue #14 investigates whether Google News marker/RPC candidates can be treated as publisher URLs with enough identity evidence to meet a 95/100 target. H4 was designed as a blind calibration using the fixed 100-row Issue #18 sample: 79 historically confirmed matches serve as positive controls, deliberate mismatches serve as negative controls, and the remaining 21 rows must stay sealed until the rule is frozen. The capture path is bounded to Google News requests, does not fetch publisher pages, and must not reveal unresolved candidate data during calibration.

## Observation

A calibration gate failure needs a safe, durable diagnostic record. Reporting only that a minimum number of positive controls was not eligible leaves operators unable to distinguish replay/request failures from insufficient identity signals. Future blinded calibration tooling should preserve immutable input and tool hashes plus aggregate diagnostics from known controls only, while excluding unresolved rows and sensitive candidate data.

## Evidence

On 2026-09-29, the operator reported that the H4 capture pass reached calibration after attempting all 100 frozen rows, then stopped with `fewer_than_76_eligible_positive_controls`. The exact eligible-positive count and cause are unknown: no calibration aggregates, request-error breakdown, freeze, or sealed candidate artifact were retained, so the completion and error are operator-observed rather than independently reproducible. No unresolved candidate outcomes were inspected or applied. This attempt does not show that H4 or the 95/100 target is infeasible.

## Impact

Without failure-only evidence, a failed calibration cannot be diagnosed or independently audited, and a later operator may be tempted to repeat a live run or tune thresholds without knowing what failed. Durable aggregates allow an owner to choose a bounded next step while preserving blindness and preventing post-hoc threshold changes.

## Local action

The H4 tooling now has a future failure-only report path in `docs/changes/14/h4/`. It atomically publishes frozen manifest, label, configuration, tool, and package-lock hashes with aggregate eligibility and categorized request/control-failure counts from the 79 historically confirmed positive controls. The report omits row identifiers, titles, hosts, URLs, URL hashes, and all unresolved-row metrics. Focused offline tests verify that unresolved-row accessors are not read and sensitive values are not serialized. This tooling was added after the recorded attempt and did not recreate diagnostics for it.

## Cross-project relevance

The lesson applies to blind evaluations, threshold calibration, and data-quality gates in other projects: safe failure reporting should be designed before execution, with immutable provenance and enough aggregate evidence to distinguish acquisition failure from rule failure. SideGig review may consider whether canonical validation or discovery guidance should recommend failure-only diagnostic artifacts for blinded calibration workflows, while retaining protections against leaking holdout data.

## Stable local references

- [GitHub Issue #14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14)
- [Draft pull request #21](https://github.com/adunato/google-news-enriched-actor-poc/pull/21)
- `docs/changes/14/technical-spike.md`
- `docs/changes/14/h4/README.md`
- `docs/changes/14/h4/h4-capture.mjs`
- `docs/changes/14/h4/h4-core.mjs`
- `docs/changes/14/h4/h4-core.check.mjs`
