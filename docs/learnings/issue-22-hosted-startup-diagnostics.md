# Learning: fixture-only startup validation for hosted Actors

**Learning ID:** google-news-enriched-actor-poc--issue-22--hosted-startup-diagnostics

**Origin repository:** adunato/google-news-enriched-actor-poc

**Source:** GitHub Issue #22

**Lifecycle stage / skill:** Technical Spike iteration checkpoint / technical-spike and capture-learning

**Date:** 2026-10-01

**Category:** Methodology

**SideGig review:** Yes

**Disposition:** Captured

## Change context

Issue #22 investigates whether bounded HTTP access and generic article extraction can support downstream news acquisition and publisher full-text work in an Apify Node 20 Actor. The POC constrains the publisher experiment to public pages, aggregate-only evidence, no browser rendering or paid extraction service, and explicit run cost, memory and time limits. Before a live publisher cohort, Iteration 10 used a 37-check offline preflight and a gated private Actor launch. The single authorized hosted run exited 1 after 2.508 seconds before writing an aggregate; its failing stage is unknown.

## Observation

A passing offline preflight built around mocked launch/runtime boundaries does not establish that the complete Actor entrypoint starts successfully in the hosted runtime. When an early hosted failure provides only a generic exit code and no aggregate, with its stage unknown, a fixture-only full-entrypoint run in a representative runtime image, with networking disabled and fixed sanitized startup stages, is a higher-value next diagnostic than repeating a live cohort or adding more mock checks.

## Evidence

The corrected local preflight passed all 37 checks under Node 20.19.0. The sole approved hosted run passed its explicit `I10_GATE` but exited 1 after 2.508 seconds, with zero dataset items and no aggregate; its failing stage is unknown. Logs contained no stage marker, exception or stack trace and did not establish whether external requests occurred. A separate network-disabled Node 20 container diagnostic also exited 1 before `Actor.init()` without a visible error, but the exact Dockerfile dependency installation did not complete offline, so dependency/image parity was not established. The hosted run therefore did not test Readability or publisher access. Sanitized details are retained in `docs/changes/22/experiments/10-direct-readability/hosted-run-evidence.json`.

## Impact

The distinction between component/mocked preflight and complete-entrypoint runtime validation can determine whether a costly or externally connected experiment is safe and interpretable. Without stage-level evidence for early execution, a failed hosted run may consume its authorization while leaving the technical hypothesis entirely untested.

## Local action

Issue #22 now proposes Iteration 11 as a fixture-only full-entrypoint startup diagnosis. It requires an offline representative-image preflight, exact fixture-only input rejection before any network path, fixed startup-stage identifiers and allowlisted error codes, aggregate/status-only evidence, and fresh owner approval before any hosted fixture run. See `docs/changes/22/technical-spike.md` and `docs/changes/22/experiments/10-direct-readability/experiment.md`.

## Cross-project relevance

This may generalize to SideGig's technical-spike methodology and canonical validation guidance: mocked preflight should be clearly distinguished from full-entrypoint checks in the target runtime, and unexplained early hosted failures before aggregate output may warrant a fixture-only startup diagnostic before another live run. SideGig review can decide whether shared skills/templates need an explicit evidence distinction or recommended fixture-first recovery pattern. This repository records the observation only; it does not alter shared SideGig materials.

## Stable local references

- `docs/changes/22/technical-spike.md`
- `docs/changes/22/experiments/10-direct-readability/experiment.md`
- `docs/changes/22/experiments/10-direct-readability/hosted-run-evidence.json`
- `https://github.com/adunato/google-news-enriched-actor-poc/issues/22`
