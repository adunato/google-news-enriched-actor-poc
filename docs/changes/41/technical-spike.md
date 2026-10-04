# Technical Spike: Google News publisher resolution and full-text viability

> Living execution/evidence record for Technical Spike [**Prove Google News publisher resolution and full-text viability (#41)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/41). The Issue defines the stable question and the approved TID defines the experiment sequence, routing, evidence criteria and boundaries.

**Artifact ID:** `spike-41-google-news-resolution-full-text`  
**Status:** `Open`  
**Owner:** `Project owner`  
**Created:** `2026-10-04`  
**Updated:** `2026-10-04`  
**GitHub Spike Issue:** `Prove Google News publisher resolution and full-text viability (#41)`  
**Technical Investigation Design:** `docs/changes/41/technical-investigation-design.md` / `tid-41-google-news-resolution-full-text` — **Approved**  
**Spike branch:** `spike/41-google-news-resolution-full-text`  
**Blocked downstream Issues:** `Resolve Google News links to publisher URLs with fail-soft status (#4)`; `Add optional best-effort article full-text extraction (#5)`

## 1. Technical Question and Required Outcome

Establish whether the approved lightweight hosted Actor can:

1. satisfy the publisher-URL feature's **95/100** live resolution target; and
2. satisfy the full-text feature's **50/100** readable-text target.

If either cannot be achieved within the approved constraints, identify the exact Product/Architecture boundary preventing it.

## 2. Current Understanding

### Established facts

- An existing Google News publisher-resolution mechanism is present in the repository.
- Hosted Google News requests can encounter a consent redirect before that resolver executes.
- Publisher-page access is partial in the hosted runtime.
- Current representative hosted evidence does not yet establish the full 50/100 readable-text target through the approved lightweight path.

### Remaining uncertainty

- whether hosted Google News access changes across repeated requests from one execution/session;
- whether ordinary HTTP/session handling provides a stable route to the existing resolver;
- whether the final publisher-URL flow reaches 95/100;
- whether at least 50/100 publisher rows provide usable HTML;
- whether the approved generic extraction path reaches 50/100 readable-text successes.

## 3. Current Investigation Position

**Investigation Area:** `A — Reach and prove the Google News publisher resolver`  
**TID experiment:** `A1 — Reproduce and characterise hosted Google News access`  
**Route status:** `Ready`

A1 is the first mandatory experiment.

The approved TID authorises A1 and every subsequent conditional transition already defined by the design. No separate experiment approval is required.

## 4. Current Experiment Execution

**TID authorisation:** `tid-41-google-news-resolution-full-text — Approved 2026-10-04`

### Experiment definition

Execute **A1 — Reproduce and characterise hosted Google News access** exactly as defined in the TID.

The experiment uses a small fixed set of known-good Google News controls in one normal Apify Node 20 Actor run, with an ordered sequence covering the first request after startup, several subsequent requests, and a repeat of an earlier URL.

### Operational bounds

Keep the run deliberately small and bounded.

Record the exact fixtures, request count, runtime settings and retained evidence when the experiment is implemented.

Do not add browser automation, proxies/unblocking, custom egress/security machinery or another runtime.

### Permitted straightforward corrections

Only obvious mechanical corrections required to execute A1 without changing its purpose, mechanism, representative evidence or architectural boundary.

### Stop conditions

Stop for TID/owner review if completing A1 would require a materially different access mechanism, infrastructure, runtime, evidence basis or a separate troubleshooting investigation.

## 5. Experiment Log

No experiment has yet been executed under Spike #41.

## 6. Supported Technical Specification

No new technical specification has yet been established by Spike #41.

The current approved investigation boundary is defined by the TID.

## 7. Remaining Uncertainty

The unresolved questions are exactly those represented by the remaining TID experiments.

Do not create additional experiments implicitly through troubleshooting.

## 8. Final Conclusion

**Result:** `Pending`

Neither downstream capability is yet unblocked.

## 9. Downstream Implications

- Keep **Resolve Google News links to publisher URLs with fail-soft status (#4)** blocked until the relevant Spike conclusion is integrated and #4 is reassessed.
- Keep **Add optional best-effort article full-text extraction (#5)** blocked until the relevant Spike conclusion is integrated and #5 is reassessed.
- Do not modify either downstream Issue as part of this Spike setup.

## 10. Reproducibility

For every experiment record:

- exact Spike branch commit/probe version;
- commands/scripts;
- runtime/environment;
- exact representative input/sample definition;
- execution date/window;
- bounded run configuration;
- retained sanitized evidence paths;
- credential/environment prerequisites without secret values.

## Completion

**Spike state:** `Open`  
**Rationale:** The TID is approved and the first experiment is ready, but no Spike #41 execution evidence has yet been produced.  
**Required next action:** `Execute TID experiment A1 and follow its decision/next-step rule.`
