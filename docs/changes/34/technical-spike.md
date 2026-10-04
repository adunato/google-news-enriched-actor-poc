# Technical Spike: Google News access and publisher full-text

> Living execution/evidence record for Technical Spike [**Rebaseline Google News access and publisher full-text for the publisher-URL and full-text features (#34)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/34). The Issue defines the stable question and the approved TID defines the experiments, sequence, routing, evidence criteria and boundaries.

**Artifact ID:** `spike-34-news-access-full-text`  
**Status:** `Open`  
**Owner:** `Project owner`  
**Created:** `2026-10-02`  
**Updated:** `2026-10-04`  
**Technical Investigation Design:** `docs/changes/34/technical-investigation-design.md` / `tid-34-news-access-full-text` — **Approved**  
**Spike branch:** `spike/34-news-access-full-text`  
**Blocked downstream Issue(s):** Resolve Google News links to publisher URLs with fail-soft status (#4); Add optional best-effort article full-text extraction (#5)

## 1. Technical Question and Required Outcome

Within the approved lightweight HTTP-first POC boundary, establish whether the Apify Node 20 Actor can:

1. reliably reach the existing Google News publisher-URL resolver and satisfy the defined **95/100** publisher-URL target; and
2. retrieve and extract readable article text from public publisher pages often enough to satisfy the defined **50/100** full-text target.

If either capability cannot meet its target within the approved architecture, identify the exact boundary requiring a Product/Architecture decision.

## 2. Current Understanding

### Established facts

- The completed publisher-resolution investigation (#14) supports the existing Google News marker/RPC resolver mechanism.
- A later hosted diagnostic stopped before that resolver because 79/79 known-positive Google News requests redirected to `consent.google.com`.
- Earlier hosted execution had successfully exercised the resolver, so the current access behaviour may differ by session/request/network conditions; the cause is not yet established.
- Historical publisher testing obtained HTTP 200 HTML from a material majority of the representative sample, so publisher access is partial but potentially sufficient for the full-text target.
- Historical Extractus testing timed out without producing useful extraction-quality evidence.
- Mozilla Readability has local mechanical evidence but not yet a clean representative hosted test through the normal Actor path.
- Custom egress/security harnessing is not part of the product architecture and is excluded from this Spike.

### Remaining uncertainty

- Whether Google News access degrades across repeated requests from the same hosted execution/network identity.
- Whether ordinary HTTP/session handling can provide a stable route to the existing resolver.
- Whether the publisher-URL flow satisfies the final 95/100 acceptance sample.
- Whether at least 50/100 publisher rows can provide readable article text through the approved lightweight extraction path.

## 3. Current Investigation Position

**Investigation Area:** `A — Reach the existing Google News resolver`  
**TID experiment:** `A1 — Reproduce and characterise Google News access`  
**Route status:** `Ready`

A1 is the first mandatory experiment. It establishes the current hosted access baseline and explicitly tests whether behaviour changes as multiple known-good Google News requests are made from the same hosted execution/session.

The approved TID authorises A1 and all subsequent conditional transitions already defined by the design. No separate experiment approval is required.

## 4. Current Experiment Execution

**TID authorisation:** `tid-34-news-access-full-text — Approved 2026-10-04`

### Experiment definition

Execute **A1 — Reproduce and characterise Google News access** exactly as defined in the TID:

- start with a known-good Google News article immediately after hosted Actor startup;
- issue several additional known-good article requests sequentially from the same execution/session;
- repeat an earlier article near the end;
- record request order, status/redirect behaviour, ordinary session state, marker reachability and, where safely observable, network-identity continuity.

The experiment is intended to distinguish immediate consent behaviour from degradation associated with repeated requests. It is not a re-test of publisher-URL identity.

### Operational bounds

Keep the run deliberately small and bounded. Record the exact fixtures, request count, runtime settings and retained evidence when the experiment is implemented. Do not add browser automation, proxy/unblocking services, custom egress/security machinery or another runtime.

### Permitted straightforward corrections

Only obvious mechanical corrections required to execute A1 without changing its purpose, mechanism, representative evidence or architectural boundary.

### Stop conditions

Stop for TID/owner review if completing A1 would require a materially different access mechanism, infrastructure, runtime, evidence basis or a separate troubleshooting investigation.

## 5. Experiment Log

No experiment has yet been executed under Spike #34.

Historical #14/#22 evidence is input to the approved TID and is not duplicated as #34 experiment iterations.

## 6. Supported Technical Specification

### Supported behaviour

- The existing marker/RPC mechanism remains the publisher-URL resolver core unless new evidence requires TID review.
- Publisher-resolution and full-text failures remain row-local and preserve the original Google News URL.
- Publisher-page access and readable-text extraction are separate technical claims.
- The target architecture remains one lightweight TypeScript/Node.js 20 Apify Actor using ordinary HTTP-first access.

### Required investigation route

The approved TID is authoritative:

1. A1 establishes current Google News access/repeated-request behaviour.
2. A2 runs only if ordinary access is not already stable.
3. A3 runs only if A2 evidence specifically points to a local request/session-construction fault.
4. A4 is the final 100-row publisher-URL acceptance run once a stable resolver path exists.
5. B1 measures publisher-page access.
6. B2 runs only if enough usable HTML exists to make the 50/100 target possible.
7. B3 runs only if extraction quality on accessible HTML is the remaining blocker.

## 7. Remaining Uncertainty

The unresolved questions are exactly those represented by the remaining TID experiments. Do not create additional experiments implicitly through troubleshooting.

## 8. Final Conclusion

**Result:** `Pending`

Neither downstream capability is yet unblocked. An individual failed or inconclusive experiment is not a terminal Spike result.

## 9. Downstream Implications

- Keep the publisher-URL feature (#4) blocked until Investigation Area A reaches a supported conclusion and final Spike evidence is integrated.
- Keep the full-text feature (#5) blocked until Investigation Area B reaches a supported conclusion and final Spike evidence is integrated.
- After final integration, rerun `assess-change` on both downstream Issues.

## 10. Reproducibility

For every #34 experiment record the exact Spike commit/probe version, commands/scripts, hosted/local runtime, input/sample definition, execution window, bounded run configuration, retained sanitized evidence paths and credential/environment prerequisites without secret values.

## Completion

**Spike state:** `Open`  
**Rationale:** The TID is approved and the first experiment is ready, but no #34 execution evidence has yet been produced.  
**Required next action:** `Execute TID experiment A1 and follow its decision/next-step rule.`
