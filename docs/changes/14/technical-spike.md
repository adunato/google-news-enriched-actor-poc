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

| ID | Hypothesis / approach | Why test it | Evidence that would support/refute it | Status |
| --- | --- | --- | --- | --- |
| H1 | Ordinary redirect/token paths expose the publisher URL reliably. | Simplest HTTP-only mechanism. | Representative matrix resolves >=95/100 correctly. | Rejected |
| H2 | Google News page markers plus the observed RPC produce publisher destination candidates reliably. | Directly observed mechanism tied to the originating Google News article ID. | Same article-ID-bound flow returns valid non-Google destinations across representative local/hosted runs. | Supported for candidate extraction; historical 100/100 |
| H3 | Publisher-page title/content checks can independently prove candidate identity for >=95/100 rows. | Direct publisher evidence would be strong identity confirmation. | >=95 confirmed matching publisher pages under bounded requests. | Rejected as a universal verification method; 79 confirmed, 21 inaccessible/unverifiable, 0 confirmed mismatches |
| H4 | The unresolved candidates can be individually verified without publisher-body access using domain/title-path heuristics. | Attempted to replace publisher-page verification with an independent per-row rule. | A precommitted rule discriminates known positives/negatives and verifies enough held-out rows. | Inconclusive and no longer the preferred closure path. Calibration never occurred; later attempts exposed a Google acquisition/consent issue rather than an identity contradiction. |
| H5 | Mechanism-level assurance is sufficient for Issue #4: a reproducible article-ID-bound Google marker/RPC result may count as successful URL resolution without requiring the publisher page itself to be fetchable. | Issue #4 requires publisher-URL resolution, not universal publisher-page accessibility. Existing evidence is 100/100 candidate extraction, 79 direct confirmations and 0 confirmed mismatches. | Existing/offline evidence plus a minimal current-compatible replay on known controls shows the same article-bound mechanism remains reproducible, with no material contradiction across the fixed matrix. | **Current** |
| H6 | A materially different resolver is required. | Fallback only if H5 cannot support an evidence-backed resolver contract. | Existing marker/RPC mechanism cannot be reproduced or produces material contradictions under bounded current-runtime checks. | Deferred |

Publisher/news-site access, anti-bot techniques, proxy/browser escalation and access-policy boundaries are now owned by independent Spike #22. They are not part of Issue #14 closure.

## 5. Current Iteration

**Iteration:** `6`  
**Hypothesis / approach:** `H5 — mechanism-level assurance for publisher-URL resolution`  
**Executor:** `ChatGPT-led evidence synthesis; Codex only for repository-local/offline checks or a separately approved minimal replay`  
**Owner approval:** `Approved direction (2026-09-29)`

### Why this iteration

The investigation had become too focused on independently re-proving each returned publisher URL. That conflated three different capabilities:

1. Google News publisher-URL resolution;
2. ability to access the publisher website automatically;
3. ability to extract readable article content.

Issue #14 blocks #4 and should answer only the first question. Issue #22 now owns the general automated publisher-site access problem, and #5 depends on that Spike.

Historical evidence already shows:

- marker/RPC returned 100/100 syntactically valid non-Google candidates on the fixed representative matrix;
- the marker/article ID matched the originating Google News article ID for all 100 rows;
- 79 candidates were independently confirmed by publisher-page title evidence;
- 0 candidate mismatches were confirmed;
- the remaining 21 were not shown wrong; they were inaccessible or otherwise unverifiable by the page-access method.

The H4/H4a work did not produce contradictory identity evidence. Its latest failure occurred before marker/RPC extraction because the replay path encountered `consent.google.com`.

### Hypothesis

A valid non-Google destination returned by the reproducible Google marker/RPC mechanism for the same originating Google News article ID can be treated as a successful publisher-URL resolution for Issue #4, without requiring the publisher page itself to be directly fetchable, provided the combined representative evidence shows no material contradiction.

### Experiment / evidence synthesis

Use the fixed #18 evidence set and avoid publisher-page access.

1. **Reassess the acceptance meaning**
   - separate `urlResolved` from later publisher accessibility/full-text status;
   - confirm Issue #4's >=95/100 criterion is a resolver-output capability criterion rather than a requirement for >=95 direct publisher-page confirmations.

2. **Offline full-matrix assurance**
   - inspect the retained 100 candidate outputs and article-ID binding evidence;
   - assess source/domain association or other already-retained provenance signals where available;
   - identify any positive contradiction rather than treating missing page access as a resolver failure.

3. **Independent current corroboration**
   - review current implementations of the same Google marker/signature/`Fbv4je` mechanism as leads;
   - record the current-compatible acquisition pattern, especially explicit article-ID parameter-page requests with locale parameters, without treating community code as authoritative specification.

4. **Minimal current-runtime replay only if required**
   - use known historical positives only;
   - use the current-compatible Google parameter-page acquisition path rather than publisher-page access;
   - prove that the article-ID-bound marker/RPC mechanism can still reproduce valid publisher destinations at a representative rate;
   - do not follow publisher destinations, investigate CAPTCHA/anti-bot workarounds, or broaden into the #22 access problem.

5. **Final specification**
   - define exactly what Issue #4 may count as successful resolution;
   - define fail-soft statuses for Google-resolution failure separately from publisher-page access failure;
   - state the residual risk that the Google RPC is undocumented and may change.

### Expected evidence

**Supported:** The retained matrix and any minimum current replay show that the same originating article ID is bound to a valid non-Google publisher destination with no material contradictory evidence, sufficient to support >=95/100 resolution under the Issue #4 definition.

**Rejected:** Material mismatches/contradictions are found, or the mechanism can no longer be reproduced sufficiently in the intended runtime.

**Inconclusive:** Existing evidence cannot establish the resolver contract and a bounded minimal replay cannot distinguish mechanism failure from transient/environmental acquisition failure.

### Operational bounds

- No publisher-page/body requests for identity verification.
- No browser automation, residential proxies, managed unblockers, CAPTCHA handling or publisher anti-bot circumvention; those belong to #22.
- Preserve the fixed sample and >=95/100 Issue #4 requirement unless a separate Product/POC decision changes them.
- Prefer offline retained evidence; make new network requests only where they materially resolve the mechanism-level question.
- No production Issue #4 implementation.

### Stop conditions

Stop for owner review before:

- changing Issue #4's acceptance criterion;
- introducing a different resolver family or paid/excluded dependency;
- expanding into publisher-site access techniques owned by #22;
- making Product/Architecture changes;
- implementing the production resolver.

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
**Owner checkpoint:** Iteration 4 / H4a was approved on 2026-09-29. Its single live attempt is recorded below; it stopped before calibration and did not authorize `h4-apply.mjs`.

### Iteration 4 — H4a control-set integrity and calibratability

**Hypothesis:** At least 76 of the 79 historical positives replay to the exact #18 candidate, remain eligible under binding/domain/path signals, and are distinguishable from at least 76 distinct realistic negative pairs.

**Executor:** Codex

**Environment/data:** Fixed #18 100-row manifest; one bounded capture invocation; no publisher-page requests.

**Method:** One capture pass with a one-request-per-row limit; exact historical candidate-hash matching; same-publisher-first deterministic real-title mismatch controls, deduplicated and supplemented to 76 unique valid pairs; positive-only aggregate failure reporting.

**Evidence:** `docs/changes/14/h4/h4-failure-attempt-2026-09-29T09-37-53-703Z-c81c53ad/h4-failure-report.json` (SHA-256 `d03e92968095412b525143dd18d5458521508ed39346914816de3109242327d8`). The report records 79 expected positives, zero candidates/hash-stable rows/bound rows/domain matches/path-eligible rows/eligible positives, zero request errors, and `input_article_id_hash_mismatch` for all 79 known positives.

**Result:** `Inconclusive`; calibration stopped before threshold selection. All 79 known positives were rejected by pre-request input article-ID hash validation, so none reached Google News network I/O. The capture pass iterated the fixed manifest; the control-only report does not expose unresolved-row request outcomes or an exact whole-run outbound request total. No freeze or sealed `h4-evidence/` directory was written; the separate failure-attempt directory and report are preserved.

**Post-run diagnosis:** Debug review established that #18 defines `articleIdHash` as SHA-256 of the full exact `googleNewsUrl`, truncated to 16 hex characters (`docs/changes/18/probe.mjs:40-41,163-164`). The H4a guard incorrectly hashed the extracted path article ID. This was a capture-tool defect, not evidence of network failure or a negative resolver result. The guard now hashes the full exact URL, retains path-ID extraction for marker/RPC binding, and preflights all 100 frozen inputs before any request. Offline preflight reports zero invalid inputs; this correction has not been live-replayed.

**Learning:** None.

**Next proposed iteration:** One corrected H4a rerun was owner-authorized and executed as recorded below. Any further capture requires a new owner decision after assessing the redirect-destination failure.

**Owner checkpoint:** The corrected H4a rerun is complete. No additional live pass, threshold tuning, unresolved-outcome inspection, or `h4-apply.mjs` run is authorized by that approval.

### Corrected H4a rerun — capture-path gate failure

**Authorization:** One corrected H4a live rerun from clean PR #21 head `421d7dd0b9138ebf7507e75073f135d2a4175956`, using the fixed manifest and existing DPAPI-protected external seal key. The run made one capture invocation; no repeat mode was used.

**Preflight and bounds:** The full 100-row manifest passed the exact-full-URL hash preflight with zero invalid inputs. Capture retained the fixed 10-second request timeout, five-redirect limit, 2 MiB response limit, concurrency four, and maximum one marker/RPC capture per row. The 21 unresolved rows remained sealed; no outcomes were inspected or classified.

**Evidence:** `docs/changes/14/h4/h4-failure-attempt-2026-09-29T10-25-05-752Z-c399a709/h4-failure-report.json` (SHA-256 `c1537bdf4291634a382bce7dc264ad7106da30b53d8c8043d97e6646193cbb18`). The positive-only report records 79 expected positives, zero candidate availability, zero historical-hash-stable candidates, zero marker bindings, zero source-domain matches, zero title-path eligible rows, zero eligible positives, and 79 row-level request errors, all categorized as `unexpected_redirect_destination`.

**Result:** `Inconclusive`; the gate `fewer_than_76_eligible_positive_controls` stopped calibration. The 76-positive-acceptance criterion and negative-control acceptance criterion were not evaluated; no negative controls were replayed or scored. No freeze, sealed candidate pack, or successful `h4-evidence/` directory was written. The separate control-only failure directory/report exists. The report does not expose unresolved-row outcomes or independently establish the exact whole-pass outbound HTTP request count.

**Interpretation:** The corrected input hash preflight succeeded offline and did not reject the manifest. The capture accepts only HTTPS redirects whose host is exactly `news.google.com`; it rejects a different destination before fetching that hop, parsing a marker, or issuing the RPC. All 79 known-positive rows stopped with `unexpected_redirect_destination`. The rejected `Location` and hop are not retained, so the cause is unknown. A `consent.google.com` hop is plausible but unproven. This is evidence that the current bounded capture path did not accept those redirect destinations; it does not determine whether the frozen identity rule discriminates controls, establish resolver identity accuracy, or assess H4 against the 95/100 target. No destination or unresolved-row details were inspected. Do not broaden the allowlist based on this unverified possibility.

**Learning:** None.

**Diagnostic result:** The owner-approved single pass completed on 2026-09-29. It selected and completed all 79 historical positive controls with 79 total HTTP requests. Every response was HTTP 302 at hop 0 from `https://news.google.com` to sanitized origin `https://consent.google.com`, rejected as `unexpected_redirect_destination` before the destination was fetched. The request path shape was `/letters/letters/letters-and-digits` for 76 controls and `/letters/letters/mixed` for three; every destination path shape was `/letters`. Response bodies were canceled without reading. No marker/RPC or publisher requests were made and unresolved rows were not requested or inspected.

**Evidence:** `docs/changes/14/h4/h4-redirect-diagnostic-2026-09-29T11-54-04-963Z-f3c8ad9b/redirect-diagnostic.json` (SHA-256 `fee1f24724e44a1ae73f19eb10f7a89d86d288b3e519e71ad85dbd7bae732b08`). The report retains only aggregate counts and sanitized origin/path shapes, status, hop and fixed rejection reason. Its input hashes match the pinned #18 manifest and historical-label artifacts.

**Interpretation and next decision:** The repeated redirect destination is confirmed as `consent.google.com` for the 79 known positives. This establishes where the current capture stops; it does not establish that following consent redirects, changing the allowlist, or continuing marker/RPC resolution is safe or successful. The single diagnostic approval is exhausted. A redirect-policy change or any further live diagnostic/resolver pass requires a separate owner decision. Do not change the sample or threshold, inspect unresolved outcomes, repeat H4 capture, or run `h4-apply.mjs` under this approval.

### Iteration 5 — control-only redirect diagnostic

**Authorization:** Owner approval in the current session for one bounded diagnostic pass over the 79 historically confirmed positive controls.

**Prepared method:** `h4-redirect-diagnostic.mjs` selects exactly the 79 #18 `confirmed_match` inputs before network access. It performs one initial manual-redirect GET per control, follows at most five further redirects only while the URL remains HTTPS on exactly `news.google.com`, uses a 10-second timeout per request and concurrency four, and cancels response bodies without reading them. It does not parse page markers, issue the RPC, fetch publisher destinations, retry, or request unresolved rows. Rejected destinations are never fetched.

**Retained evidence design:** An atomic immutable report contains aggregate row/request counts and a histogram of response status, hop, fixed rejection reason, plus sanitized request/destination origin and path shapes. It omits raw `Location`, complete paths, query strings, row IDs, titles, article IDs, headers and bodies. A small fixed list of known Google hosts may be named; other dynamic subdomains are collapsed to a wildcard with subdomain depth, and other registrable domains are reduced to `other-registrable-domain`. Each path segment is reduced to a character-class label.

**Status:** The single approved diagnostic pass is complete. It explains the observed capture rejection but does not establish that following the consent redirect is safe or that the URL identity rule will meet the 95/100 target. No calibration, unresolved-row assessment, or policy change resulted.

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
5. Apply the final mechanism-level assurance rule established by this Spike before treating the candidate as successfully resolved. Direct publisher-page accessibility is not itself required for URL-resolution success; it is a separate downstream capability.

Step 5 is the subject of the current H5 iteration.

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

- Whether the retained full-matrix evidence contains any material contradiction to treating the article-ID-bound marker/RPC destination as the publisher URL.
- Whether a minimal current-compatible replay on known positives is required, and if so whether it reproduces the historical mechanism sufficiently in the intended runtime.
- The exact runtime success/failure rule Issue #4 should use for `urlResolved` independently of publisher-page accessibility.
- The maintenance risk of relying on an undocumented Google marker/RPC mechanism.
- Publisher-site reachability, anti-bot controls, browser/proxy escalation and permission/policy boundaries are explicitly outside this Spike and are owned by #22.

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
**Rationale:** Candidate extraction is historically 100/100 and 79/100 identities were directly confirmed with 0 confirmed mismatches, but the Spike has not yet stated the evidence-backed rule that allows Issue #4 to count a resolved URL independently of publisher-page accessibility.  
**Required next action:** Execute H5 as an evidence-synthesis/assurance iteration, using retained evidence first and only a minimal current-compatible known-positive replay if materially necessary. Do not continue H4 publisher-access or consent-circumvention work; general automated news-site access is owned by #22.
