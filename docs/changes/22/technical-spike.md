# Technical Spike Execution: Issue #22

> Current execution record for Issue #22. This file starts a clean execution history after the HLD rebaseline.

**Status:** Not started  
**Issue:** #22  
**HLD:** `docs/changes/22/hld.md`  
**Superseded historical execution:** PR #23

## Execution authority

This PR is the active workspace for future Issue #22 experiments and findings.

Before beginning execution:

1. PR #30 must be merged so `docs/changes/22/hld.md` is present on `dev`.
2. Sync this branch with the updated `dev`.
3. Read Issue #22 and the HLD before selecting or implementing the next experiment.

The HLD defines the current architecture and experiment sequence. This file records what is executed, what evidence is observed, and what that evidence changes.

PR #23 is historical evidence only. Its previous "current iteration", "next step", H14/H15/H15-B direction, and other execution instructions are superseded unless the HLD explicitly incorporates them.

## Current starting point

Start from the HLD's experiment sequence:

1. clean standard Apify Actor hosted runtime baseline;
2. #4 Google consent/session experiment against the existing marker/RPC resolver;
3. #5 bounded publisher HTTP + structured-data fast path + Mozilla Readability;
4. reserve extraction candidate only if the primary extraction path fails for extraction reasons.

Do not continue the custom API-origin/network-security harness from PR #23 as the default path.

## Findings log

No post-HLD execution has occurred yet.

For each meaningful experiment, record:

- objective;
- implementation/change tested;
- environment/sample;
- result;
- evidence;
- interpretation;
- next action;
- whether the HLD remains valid or requires review.

Keep this record concise. Detailed logs or reproducible evidence may live in linked experiment artifacts.

## Historical evidence retained from PR #23

The following findings remain relevant inputs to the HLD and future execution:

- hosted direct publisher HTTP returned 200 HTML for 72/100 representative rows;
- Extractus timed out on 78/78 eligible hosted extraction calls in the replacement cohort;
- direct Mozilla Readability has not yet received a valid representative hosted publisher test;
- controlled local fixture work showed Readability can execute in a Node/Apify-compatible environment;
- #4's hosted acceptance path encountered Google consent/interstitial behaviour before the existing marker/RPC mechanism could run.

For full chronology and retained experiment evidence, consult PR #23 only when needed.

## Design-change rule

If evidence implies a material change to the architecture, selected technical direction, product boundary, or experiment sequence, stop treating this execution record as design authority. Update/review the HLD first, then continue execution from the revised design.
