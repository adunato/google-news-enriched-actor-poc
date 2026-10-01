# Learning: explain iteration context before asking for approval

**Learning ID:** google-news-enriched-actor-poc--issue-22--context-before-approval

**Origin repository:** adunato/google-news-enriched-actor-poc

**Source:** GitHub Issue #22

**Lifecycle stage / skill:** Technical Spike iteration checkpoint / technical-spike and capture-learning

**Date:** 2026-10-01

**Category:** Methodology

**SideGig review:** Yes

**Disposition:** Captured

## Change context

Issue #22 is a technical investigation into whether an Apify Actor can retrieve useful article text from Google News results using a bounded HTTP-first approach and the Readability extraction library. Iteration 10's single approved hosted run exited before producing results, leaving startup failure as the immediate unknown and leaving Readability's success on real publishers unmeasured. At the next checkpoint, the proposed Iteration 11 was a one-article synthetic fixture diagnostic using the same Readability component, intended to locate the hosted startup failure before returning to a live publisher cohort. The owner authorized implementation and local preflight for this diagnostic; any hosted fixture run still required separate explicit approval.

## Observation

An approval request at a lifecycle checkpoint must give enough plain-language context for an owner who is not tracking every prior experiment. State what the current result means, what the proposed action will do, how it relates to the existing solution or hypothesis, what it can establish and what it cannot establish, and the exact scope of authorization requested. Experiment labels such as “fixture-only startup diagnostic” alone do not communicate these consequences.

## Evidence

The first request for Iteration 11 described a “smaller diagnostic” using a “built-in sample article” to record the startup step, but did not explain how it related to the Readability approach or distinguish startup viability from extraction performance on real publisher pages. The owner asked for more context, then specifically asked whether it was the same solution at smaller scale. After the explanation clarified that it used the same Readability component on one built-in article, aimed to diagnose hosted startup, and could not assess live publisher success, the owner approved implementation and local preflight only and requested more context in future approval requests. A hosted run remained outside that authorization and required separate approval.

## Impact

When approval requests omit this context, owners must reconstruct the investigation from earlier discussion before they can understand the decision. This adds avoidable back-and-forth and can make a technically precise checkpoint sound like a change of solution or a smaller version of the original success test. Clear context helps owners authorize the intended bounded work with an accurate view of what the evidence will mean.

## Local action

This record captures the observation. No repository skill or template was changed; guidance that applies across SideGig projects should be considered through SideGig review.

## Cross-project relevance

Lifecycle skills across projects create approval checkpoints for spikes, deployments, releases, and other consequential actions. Their prompts may be technically correct yet assume familiarity with prior work. SideGig review may consider whether canonical lifecycle skills or templates should require approval requests to include plain-language context, the decision's relationship to prior work, evidence limits, and the precise authorization scope. This repository records the evidence and does not modify shared SideGig guidance.

## Stable local references

- `docs/changes/22/technical-spike.md`
- `docs/changes/22/experiments/10-direct-readability/experiment.md`
- `docs/changes/22/experiments/10-direct-readability/hosted-run-evidence.json`
- `https://github.com/adunato/google-news-enriched-actor-poc/issues/22`
