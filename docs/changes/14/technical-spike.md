# Technical Spike: Google News publisher URL resolution

> Living investigation artifact for Issue #14. Historical Technical Discovery artifacts under Issues #14 and #18 remain retained evidence; this document is now the controlling research/design record.

**Artifact ID:** `technical-spike-14-google-news-publisher-url`  
**Status:** `Open`  
**Owner:** Project owner; executor recorded per iteration  
**Created / updated:** `2026-09-29`  
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

| ID  | Hypothesis / approach                                                                                                                            | Why test it                                                                                                                  | Evidence that would support/refute it                                                                                                                   | Status                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| H1  | Ordinary redirect/token paths expose the publisher URL reliably.                                                                                 | Simplest HTTP-only mechanism.                                                                                                | Representative matrix resolves >=95/100 correctly.                                                                                                      | Rejected                                                                             |
| H2  | Google News page markers plus the observed RPC produce publisher destination candidates reliably.                                                | Historical community/implementation lead; direct observation possible.                                                       | Same article-ID-bound flow returns non-Google destinations across representative local/hosted runs.                                                     | Supported for candidate extraction                                                   |
| H3  | Publisher-page title/content checks can independently prove candidate identity for >=95/100 rows.                                                | Direct publisher evidence would be strong identity confirmation.                                                             | >=95 confirmed matching publisher pages under bounded requests.                                                                                         | Rejected as universal verification method; 79 confirmed, 21 unverifiable             |
| H4  | The unresolved candidates can be verified without publisher article-body access using independently validated origin/domain/URL-binding signals. | Direct page access is what prevented verification of the remaining rows; these signals exist earlier in the resolution flow. | A precommitted rule discriminates known matches from controlled mismatches, then verifies enough unresolved rows for the full matrix to reach >=95/100. | Iteration 3 inconclusive; Iteration 4 control-integrity/calibratability test proposed |
| H5  | A materially different HTTP-only resolver/verification path is required.                                                                         | Fallback only if H4 cannot establish the required confidence.                                                                | Another bounded approach outperforms the current evidence under the same matrix/constraints.                                                            | Deferred                                                                             |

## 5. Current Iteration

**Iteration:** `4`  
**Hypothesis / approach:** `H4a — establish control-set integrity and calibratability before unresolved-row application`  
**Executor:** `Codex`  
**Owner approval:** `Pending`

### Why this iteration

Iteration 3 did not reject H4. It stopped before threshold selection because fewer than 76 positive controls were eligible, and the failed attempt retained too little aggregate evidence to determine why. The failure-only diagnostic path has since been added and validated.

Review of the H4 protocol also exposed two evidence-integrity conditions that must be fixed before another live calibration can support a conclusion:

1. the 79 historical positive labels prove the identity of the **historical #18 candidate URLs**. A replayed row may be treated as a positive control only when its current candidate hash matches the historical #18 candidate hash; otherwise the historical identity label is stale for the current candidate;
2. realistic negative controls are required to demonstrate discrimination. Same-publisher title swaps should be used where available; fallback controls must use deterministic real nonmatching titles rather than trivially unrelated synthetic text.

This iteration therefore tests whether H4 is calibratable on a trustworthy control set without examining or classifying the 21 unresolved rows.

### Hypothesis

At least 76 of the 79 historically confirmed rows will replay to the same candidate URL previously confirmed in #18, retain the required article-ID/source-domain/title-path signals, and be distinguishable from realistic precommitted title-mismatch controls with zero accepted negative controls.

If this hypothesis is supported, H4 remains viable and a frozen verification rule may be reviewed before a separately approved application to the 21 unresolved rows. If it is not supported, the retained aggregate diagnostics should show whether H4 fails because of candidate instability, request/binding failure, insufficient path evidence, or inadequate discrimination.

### Experiment

Use the unchanged #18 100-row manifest and the existing bounded Google marker/RPC capture. Do not refresh the sample and do not fetch publisher article bodies.

1. **Historical-candidate continuity**
   - for each of the 79 historical `confirmed_match` controls, compare the replayed candidate URL hash with the candidate hash retained in #18;
   - only a hash-stable row may inherit its historical positive identity label for calibration;
   - record only aggregate counts in failure diagnostics: candidate available, historical candidate hash stable, marker/article-ID binding, source-domain match, title-path eligibility and combined eligibility.

2. **Realistic negative controls**
   - use a different real title from the same publisher where the frozen sample permits;
   - otherwise select a deterministic real nonmatching title from the known-positive corpus using a precommitted selection rule;
   - keep the positive row's original source domain so the domain gate cannot make the negative trivially fail;
   - do not use the synthetic `unrelated controlled mismatch <rowId>` fallback as calibration evidence.

3. **Blind calibration**
   - keep the 21 unresolved rows sealed and excluded from all calibration/diagnostic output;
   - require at least 76 hash-stable eligible positives and at least 76 realistic negative controls;
   - freeze the rule only if at least 76/79 historical positives are accepted and zero negative controls are accepted;
   - do not alter thresholds after any unresolved-row outcome is available.

4. **Owner checkpoint after calibration**
   - if calibration fails, retain the safe control-only failure report and stop;
   - if calibration succeeds, retain the immutable calibration/freeze evidence and stop **before** running `h4-apply.mjs`;
   - application to the 21 unresolved rows is a separate owner-approved iteration.

### Expected evidence

**Supported:** at least 76 historical positives replay to the exact previously confirmed candidate and pass the frozen binding/domain/path rule; at least 76 realistic negative controls are evaluated; zero negatives pass.

**Rejected for this rule:** fewer than 76 historical positives are hash-stable/eligible, or any realistic negative control passes the selected rule.

**Inconclusive:** the run cannot reach a trustworthy calibration verdict because of a bounded execution/evidence failure rather than the rule itself.

A successful calibration does **not** complete H4 or Issue #14. It establishes only that the verification rule is safe enough to test against the held-out 21 unresolved rows.

### Operational bounds

- Fixed #18 100-row sample; no refresh.
- One bounded marker/RPC capture per row; no unresolved-row repeat request in this iteration.
- No publisher-body requests, browser automation, proxies, paid APIs or paywall bypass.
- Preserve the existing timeout, redirect, response-size and concurrency limits unless a material change is separately approved.
- Retain immutable input/tool/config hashes and aggregate control diagnostics only; do not expose unresolved-row metrics or candidate URLs.
- Keep the candidate pack sealed if calibration succeeds.
- No production Issue #4 implementation.

### Stop conditions

Stop and return to the project owner before:

- applying a frozen rule to any of the 21 unresolved rows;
- changing the fixed sample or >=95/100 requirement;
- relaxing the positive/negative calibration gates;
- accepting replayed historical positives whose candidate hash no longer matches #18;
- introducing a different dependency/resolver family or changing Product/Architecture constraints;
- moving to H5.

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

### Iteration 3 — H4 blind-calibration attempt

**Hypothesis:** The 79 historical positives could calibrate a non-page-access domain/title-path verification rule strongly enough to freeze it before evaluating the 21 unresolved rows.  
**Executor:** Codex / operator-assisted live execution  
**Environment/data:** Unchanged #18 frozen 100-row matrix; bounded Google News marker/RPC requests; no publisher-page requests.  
**Method:** Capture current candidates, calibrate only on the 79 historical positives plus deliberate negatives, and freeze only after the precommitted gates pass.  
**Evidence:** Operator-observed completion of the 100-row capture followed by `fewer_than_76_eligible_positive_controls`; no calibration/freeze/application artifact was retained. The later failure-only diagnostic tooling is documented under `docs/changes/14/h4/` but did not recreate the failed run.  
**Result:** `Inconclusive`  
**Learning:** The attempt did not establish why fewer than 76 positives were eligible and therefore did not reject H4. Review also identified that replayed positive controls must prove candidate-hash continuity with #18 and that fallback negative controls must be realistic enough to test discrimination rather than use trivially unrelated synthetic titles.  
**Next proposed iteration:** Iteration 4 / H4a — establish historical-candidate continuity and realistic-control calibratability while keeping the 21 unresolved rows sealed.  
**Owner checkpoint:** Pending approval for Iteration 4; no rerun or unresolved-row application authorized.

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

- Whether at least 76 of the 79 historical positive controls replay to the exact candidate URLs whose identities were confirmed in #18.
- Whether the path/domain rule can reject realistic title mismatches with zero false positives before it is exposed to the unresolved set.
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
**Required next action:** Project-owner decision whether to approve Iteration 4 / H4a as specified above. The 2026-09-29 H4 attempt is logged as Inconclusive. No live rerun, threshold change or unresolved-row application is authorized until the next iteration is approved.
