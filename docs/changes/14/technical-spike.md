# Technical Spike: Google News publisher URL resolution

> Living investigation artifact for Issue #14. Historical Technical Discovery artifacts under Issues #14 and #18 remain retained evidence; this document is now the controlling research/design record.

**Artifact ID:** `technical-spike-14-google-news-publisher-url`  
**Status:** `Open`  
**Owner:** Project owner; executor recorded per iteration  
**Created / updated:** `2026-09-28`  
**GitHub Spike Issue:** [#14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14)  
**Blocked downstream Issue(s):** [#4](https://github.com/adunato/google-news-enriched-actor-poc/issues/4); #5, #6 and #7 transitively  
**Spike branch / draft PR:** `spike/14-google-news-publisher-url-resolution` / [PR #21](https://github.com/adunato/google-news-enriched-actor-poc/pull/21)  
**Product Definition:** `docs/product.md`, PR-006, PR-007, PR-010, PR-011, PR-013 and Sections 3-5  
**Architecture Definition:** `docs/architecture.md`, Sections 2-5 and 8-9

## 1. Technical Question

Can Google News RSS article links be resolved to the correct publisher article URL at Issue #4's required rate of at least 95/100 using the approved lightweight HTTP-only approach, and what exact evidence-backed mechanism may downstream design rely on?

This question remains stable across experiments. A failed verification method changes the next experiment; it does not create a replacement Spike.

## 2. Required Outcome and Constraints

### Required outcome

Establish a technical specification that tells downstream Issue #4:

- the supported Google News resolution mechanism/sequence;
- how the returned publisher URL is tied to the originating Google News item;
- what constitutes successful URL resolution independently of later publisher-page/full-text accessibility;
- runtime/environment assumptions, failure modes and maintenance risks;
- demonstrated success against the fixed five-query × GB/US × 10-row matrix.

A Feasible conclusion requires evidence supporting at least 95 correct publisher URLs from the 100-row matrix. A Not feasible conclusion requires evidence that this cannot be achieved within the approved constraints.

### Constraints

- Lightweight HTTP-first only.
- No browser rendering/automation.
- No residential proxies.
- No paid extraction/news APIs.
- No paywall bypass.
- Preserve the Google News URL as provenance/fallback.
- Keep requests, redirects, concurrency, response sizes, timeouts, retries and retained evidence bounded.
- Do not commit credentials, cookies or account state.
- Do not implement production Issue #4 resolver code in this Spike.

## 3. Current Understanding

### Established facts

- Google documentation reviewed in historical #14 does not define a supported RSS article-link publisher resolver, marker contract or `batchexecute` RPC for this use case.
- Historical #14 direct redirect and legacy token-decoding probes produced 0/100 publisher destinations on the representative sample.
- Historical #14 marker/RPC probes produced 100/100 syntactic non-Google candidate destinations in local Node 24 and Apify Node 20. The Google page/article ID matched the originating input article ID for all 100 rows before the RPC result was obtained.
- Historical #18 used the same bounded marker/RPC candidate mechanism and a frozen 100-row matrix. Hosted results recorded 79 confirmed title matches, 21 unverifiable identities and 0 confirmed mismatches.
- #18's strict-success measure was 76/100 because it additionally required HTTP 200 HTML and an article-like marker. That measure combines URL-resolution evidence with publisher-page accessibility.
- The 21 unverifiable hosted rows were not demonstrated to be incorrect destinations. Their identity could not be confirmed with the publisher-page-title method.
- Issue #4 requires >=95/100 successful publisher URL resolution, so at least 16 of those 21 unresolved rows must be independently verified, assuming the existing 79 confirmed rows remain valid.

### Unresolved questions

- Can enough of the 21 inaccessible/unverifiable candidates be tied to the correct originating story without successfully loading the publisher article body?
- What combination of independent signals is sufficiently discriminating to count as verification rather than plausibility?
- Does the resulting evidence support >=95/100 correct publisher URLs under the same representative matrix and hosted runtime constraints?
- What minimum runtime verification should production #4 perform, versus what evidence is only needed to validate the design?

### Rejected / unsupported assumptions

- Plain Google News redirect following is not a viable publisher resolver in the tested environment.
- Legacy token decoding is not a viable publisher resolver in the tested sample.
- A syntactically valid non-Google URL alone is not enough to prove article identity.
- Requiring publisher HTTP 200/article-body access for every resolved URL is not yet justified as part of URL-resolution success; it measures a downstream capability that Issue #5 also depends on.
- An inconclusive experiment does not complete this Spike.

Historical source evidence:

- `docs/changes/14/technical-discovery.md`
- `docs/changes/14/probe-results.json`
- `docs/changes/14/hosted-probe-results.json`
- `docs/changes/18/technical-discovery.md`
- `docs/changes/18/hosted-results.json`

## 4. Investigation Backlog

| ID | Hypothesis / approach | Why test it | Evidence that would support/refute it | Status |
| --- | --- | --- | --- | --- |
| H1 | Ordinary redirect/token paths expose the publisher URL reliably. | Simplest HTTP-only mechanism. | Representative matrix resolves >=95/100 correctly. | Rejected |
| H2 | Google News page markers plus the observed RPC produce publisher destination candidates reliably. | Historical community/implementation lead; direct observation possible. | Same article-ID-bound flow returns non-Google destinations across representative local/hosted runs. | Supported for candidate extraction |
| H3 | Publisher-page title/content checks can independently prove candidate identity for >=95/100 rows. | Direct publisher evidence would be strong identity confirmation. | >=95 confirmed matching publisher pages under bounded requests. | Rejected as universal verification method; 79 confirmed, 21 unverifiable |
| H4 | The unresolved candidates can be verified without publisher article-body access using independently validated origin/domain/URL-binding signals. | Direct page access is what prevented verification of the remaining rows; these signals exist earlier in the resolution flow. | A precommitted rule discriminates known matches from controlled mismatches, then verifies enough unresolved rows for the full matrix to reach >=95/100. | Proposed |
| H5 | A materially different HTTP-only resolver/verification path is required. | Fallback only if H4 cannot establish the required confidence. | Another bounded approach outperforms the current evidence under the same matrix/constraints. | Deferred |

## 5. Current Iteration

**Iteration:** `3`  
**Hypothesis / approach:** `H4 — verify blocked candidates without publisher article-body access`  
**Executor:** `Codex`  
**Owner approval:** `Pending`

### Why this iteration

The current mechanism already generates 100/100 candidates and has 79 direct identity confirmations with zero confirmed mismatches. The immediate gap is therefore not another resolver implementation; it is whether the remaining 21 candidates can be verified by evidence that does not depend on publishers allowing the Actor to fetch the article body.

This is the smallest experiment that can answer that gap while reusing the existing matrix and evidence.

### Experiment

Use the frozen #18 100-row matrix and the existing marker/RPC probe path. Do not refresh the matrix unless the retained evidence is technically insufficient; if a refresh becomes necessary, stop for owner approval because it changes comparability.

For all 100 rows, derive verification signals that do not require a successful publisher article-body response:

1. **Google article-ID binding**
   - confirm that the Google News page/markers used for the RPC correspond to the same article ID as the originating RSS item;
   - confirm that the RPC request is constructed from those markers for that row.

2. **Publisher/source-domain binding**
   - canonicalise the registrable domain of the candidate publisher URL;
   - canonicalise the source URL/domain carried by the originating Google News RSS item;
   - record exact/registrable-domain agreement and any redirect/domain-alias case separately.

3. **Title-to-URL binding**
   - when the candidate URL exposes meaningful path/query tokens, normalise the RSS title and candidate URL slug/path and calculate a deterministic token-correspondence measure;
   - record URLs whose path is opaque separately rather than forcing them through the rule.

4. **Repeatability as supporting evidence**
   - for rows still requiring evidence, perform one independent bounded repeat of the same article-ID/marker/RPC resolution and record whether it returns the same candidate destination;
   - repeatability is supporting evidence only and must not be treated as standalone identity proof.

5. **Calibrate the decision rule before looking at the 21 unresolved outcomes**
   - use the 79 previously confirmed matches as positive controls;
   - create deliberately mismatched negative controls by pairing candidate URLs with incorrect RSS title/source records, including same-publisher mismatches where the sample permits;
   - define and freeze the verification rule/thresholds from the positive/negative controls;
   - report sensitivity on known matches and false-positive behaviour on controlled mismatches.

6. **Apply the frozen rule to the 21 unresolved rows**
   - classify each as `verified`, `contradicted`, or `still unverifiable`;
   - do not lower thresholds after seeing these rows;
   - combine these results with the 79 direct title-confirmed rows and report the resulting full-matrix count against 95/100.

### Expected evidence

H4 is supported strongly enough to advance the Spike if:

- the non-page-access verification rule demonstrates strong discrimination on the known positive/negative controls;
- it does not introduce a material false-positive concern;
- at least 16 of the 21 unresolved rows are newly verified, giving at least 95/100 supported correct publisher URLs overall;
- no evidence contradicts the marker/RPC article-ID binding.

If the rule cannot be validated responsibly, produces material false positives, or verifies fewer than 16 of the 21 rows, record that result without changing the threshold and propose the next materially different hypothesis inside this same Spike.

### Operational bounds

- Reuse retained #18 inputs/evidence wherever possible.
- No publisher-body fetch is required by this experiment except existing historical evidence; do not add browser/proxy/paywall bypass techniques.
- At most one independent repeat marker/RPC request for a row when required for the repeatability signal.
- Preserve existing bounded timeouts, redirect limits and concurrency unless the experiment demonstrates a reason to change them; any material change requires owner review.
- Do not retain unnecessary article bodies, RPC bodies, cookies, credentials or account state.
- Candidate URLs may be processed transiently to calculate domain/path evidence; retain only the minimum reproducibility evidence consistent with existing repository privacy/evidence practice.

### Stop conditions

Stop and return to the project owner before:

- changing the fixed sample or Issue #4's >=95/100 target;
- introducing a new paid/proxy/browser dependency;
- redefining publisher-page accessibility as URL-resolution success/failure;
- selecting thresholds after inspecting the 21 unresolved outcomes;
- moving to H5 or another materially different resolver approach;
- changing Product/Architecture constraints.

## 6. Experiment Log

### Iteration 1 — identify a viable resolution mechanism

**Hypothesis:** Direct redirect/token approaches or marker/RPC may yield publisher destinations.  
**Executor:** Codex / prior Technical Discovery execution  
**Environment/data:** Local Windows Node 24 and Apify Linux Node 20; five queries × GB/US × 10 rows.  
**Method:** Bounded RSS, redirect, legacy token and marker/RPC probes.  
**Evidence:** `docs/changes/14/technical-discovery.md` and retained #14 probe/result files.  
**Result:** `Supported` for marker/RPC candidate extraction; direct redirect/token alternatives rejected.  
**Learning:** Marker/RPC produced 100/100 syntactic non-Google destinations in both tested runtimes, but candidate identity remained unproven.  
**Next proposed iteration:** Verify candidate article identity.  
**Owner checkpoint:** Historical iteration completed before current Spike lifecycle.

### Iteration 2 — direct publisher-page identity verification

**Hypothesis:** Publisher-page title signals can verify marker/RPC candidates strongly enough to establish the >=95/100 requirement.  
**Executor:** Codex / Issue #18 execution  
**Environment/data:** Frozen 100-row GB/US matrix; local Node 24 and Apify Node 20.  
**Method:** Bounded publisher GET, title normalisation/matching, article marker, explicit mismatch/unverifiable classification.  
**Evidence:** `docs/changes/18/technical-discovery.md`, `docs/changes/18/hosted-results.json` and retained #18 probe files.  
**Result:** `Inconclusive` for the overarching question.  
**Learning:** 79 hosted rows were confirmed matches, 0 were confirmed mismatches, and 21 were unverifiable. Direct publisher-page access cannot serve as the only verification mechanism because access restrictions prevent evidence on otherwise plausible candidates.  
**Next proposed iteration:** H4 — independently verify the unresolved candidates without requiring publisher article-body access.  
**Owner checkpoint:** Historical iteration completed before current Spike lifecycle.

## 7. Supported Technical Specification

> Partial while the Spike remains Open.

### Supported behaviour

- Google News RSS supplies the originating article URL/ID and source metadata used by this POC.
- In the tested samples, the Google News marker/RPC sequence can produce a non-Google publisher candidate for 100/100 rows in both local Node 24 and Apify Node 20.
- The page marker extraction used in #14 matched the input Google News article ID for all 100 tested rows.
- 79/100 hosted candidates have independent publisher-page title evidence confirming correspondence to the originating RSS title.
- No confirmed candidate mismatch has yet been observed in the frozen #18 matrix.

### Required sequence / mechanism

1. Preserve the originating Google News article URL/ID and source metadata.
2. Follow the bounded Google News page flow required to obtain markers for that same article ID.
3. Call the observed marker/RPC endpoint using those row-bound markers.
4. Parse the returned candidate and reject Google-owned destinations.
5. Apply the final verification rule established by this Spike before treating the candidate as successfully resolved.

Step 5 remains unresolved and is the subject of the current iteration.

### Failure modes and handling constraints

- Ordinary redirect/token paths can yield no publisher destination.
- Google marker/RPC is undocumented and may change without notice.
- Publisher sites may return 401/403/405/451 or otherwise prevent direct identity verification even when the destination may be correct.
- Publisher accessibility must remain distinguishable from URL-resolution correctness.

### Environment / variability

- Evidence covers the retained local Node 24 and Apify Node 20 runs described in #14/#18.
- Runtime/network identity and future Google behaviour may change observed results.
- Current sample is a fixed 100-row snapshot and not a permanent corpus.

### Confidence and evidence boundary

Candidate extraction is strongly demonstrated on the tested matrix. Exact identity is directly confirmed for 79 rows. The remaining 21 require additional evidence before the >=95/100 publisher-resolution requirement can be claimed.

## 8. Remaining Uncertainty

- Whether a validated non-page-access rule can independently verify at least 16 of the 21 unresolved candidates.
- The false-positive/false-negative characteristics of domain/URL-binding signals.
- Whether any unresolved rows require a genuinely different HTTP-only resolution/verification path.
- The production-time verification rule Issue #4 should implement after the Spike establishes design evidence.

## 9. Final Conclusion

**Result:** `Pending`

### Feasible

Pending.

### Not feasible

Pending.

The Spike remains open. Historical #14/#18 experiment completion does not complete this controlling Spike.

## 10. Downstream Implications

- Issue #4 remains blocked.
- #5, #6 and #7 remain transitively dependent on #4.
- #20 is superseded by this Spike and should not be used as a parallel investigation.
- No HLD, Implementation Plan or further production resolver implementation should resume until this Spike reaches a supported final conclusion and #4 is reassessed.

## 11. Reproducibility

Historical reproducibility details remain authoritative in:

- `docs/changes/14/technical-discovery.md`
- `docs/changes/14/hosted-probe-handoff.md`
- `docs/changes/14/probe.mjs`
- `docs/changes/14/rpc-probe.mjs`
- `docs/changes/14/probe-results.json`
- `docs/changes/14/hosted-probe-results.json`
- `docs/changes/18/technical-discovery.md`
- `docs/changes/18/hosted-results.json`
- `docs/changes/18/frozen-input.json`
- retained #18 probe/package files.

The current iteration should add its experiment-specific design/probe/evidence under `docs/changes/14/experiments/03-independent-verification/` if files beyond this living artifact materially improve reproducibility.

## Completion

**Spike state:** `Open`  
**Rationale:** 79/100 publisher candidates are directly confirmed and 21 remain unverifiable; the original >=95/100 technical question is therefore unresolved.  
**Required next action:** Project-owner review of Iteration 3. If approved, execute H4 using the `technical-spike` skill, update this artifact/evidence, report the result, and stop at the next owner checkpoint.
