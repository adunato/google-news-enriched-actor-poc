# Technical Spike: Google News publisher URL resolution

> Living investigation artifact for Issue #14. Historical Technical Discovery artifacts under Issues #14 and #18 remain retained evidence; this document is now the controlling research/design record.

**Artifact ID:** `technical-spike-14-google-news-publisher-url`  
**Status:** `Feasible`  
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
- The owner approved H5's mechanism-level attribution rule: a parseable non-Google destination from the RPC request bound to a matching Google News article-ID marker may count as URL resolution, independently of publisher-page accessibility.
- #18's strict-success measure was 76/100 because it additionally required HTTP 200 HTML and an article-like marker. That measure combines URL-resolution evidence with publisher-page accessibility.
- The 21 unverifiable hosted rows were not demonstrated to be incorrect destinations. Their identity could not be confirmed with the publisher-page-title method.
- Issue #4's current acceptance wording requires >=95/100 successful resolution to valid non-Google HTTP(S) publisher URLs. It does not require >=95 independent publisher-page identity confirmations.

### Unresolved questions

The original Technical Question is resolved under the owner-approved H5 attribution rule. The remaining uncertainties are implementation/maintenance risks rather than blockers to this Spike conclusion:

- whether the undocumented Google acquisition path still works unchanged in a fresh implementation-time live sample;
- how often the marker/RPC mechanism changes over time;
- exact independent story identity for the 21 rows that publisher-page title checks could not verify.

### Rejected / unsupported assumptions

- Plain Google News redirect following is not a viable publisher resolver in the tested environment.
- Legacy token decoding is not a viable publisher resolver in the tested sample.
- A syntactically valid non-Google URL alone is not enough to prove article identity. Under the approved H5 rule, the additional request-side article-ID binding supports operational attribution but does not become independent publisher-page identity evidence.
- Requiring publisher HTTP 200/article-body access for every resolved URL is not yet justified as part of URL-resolution success; it measures a downstream capability that Issue #5 also depends on.
- An inconclusive experiment does not complete this Spike.

Historical source evidence:

- `docs/changes/14/technical-discovery.md`
- `docs/changes/14/probe-results.json`
- `docs/changes/14/hosted-probe-results.json`
- `docs/changes/18/technical-discovery.md`
- `docs/changes/18/hosted-results.json`

## 4. Investigation Backlog

| ID  | Hypothesis / approach                                                                                                                                                                                              | Why test it                                                                                                                                                                                    | Evidence that would support/refute it                                                                                                                        | Status                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Ordinary redirect/token paths expose the publisher URL reliably.                                                                                                                                                   | Simplest HTTP-only mechanism.                                                                                                                                                                  | Representative matrix resolves >=95/100 correctly.                                                                                                           | Rejected                                                                                                                                                                            |
| H2  | Google News page markers plus the observed RPC produce publisher destination candidates reliably.                                                                                                                  | Directly observed mechanism tied to the originating Google News article ID.                                                                                                                    | Same article-ID-bound flow returns valid non-Google destinations across representative local/hosted runs.                                                    | Supported for candidate extraction; historical 100/100                                                                                                                              |
| H3  | Publisher-page title/content checks can independently prove candidate identity for >=95/100 rows.                                                                                                                  | Direct publisher evidence would be strong identity confirmation.                                                                                                                               | >=95 confirmed matching publisher pages under bounded requests.                                                                                              | Rejected as a universal verification method; 79 confirmed, 21 inaccessible/unverifiable, 0 confirmed mismatches                                                                     |
| H4  | The unresolved candidates can be individually verified without publisher-body access using domain/title-path heuristics.                                                                                           | Attempted to replace publisher-page verification with an independent per-row rule.                                                                                                             | A precommitted rule discriminates known positives/negatives and verifies enough held-out rows.                                                               | Inconclusive and no longer the preferred closure path. Calibration never occurred; later attempts exposed a Google acquisition/consent issue rather than an identity contradiction. |
| H5  | Mechanism-level assurance is sufficient for Issue #4: a reproducible article-ID-bound Google marker/RPC result may count as successful URL resolution without requiring the publisher page itself to be fetchable. | Issue #4 requires publisher-URL resolution, not universal publisher-page accessibility. Existing evidence is 100/100 candidate extraction, 79 direct confirmations and 0 confirmed mismatches. | Existing/offline evidence shows 100/100 candidates under the approved mechanism-level attribution rule, with no material contradiction in the retained data. | **Supported under the approved attribution rule; see Iteration 6**                                                                                                                  |
| H6  | A materially different resolver is required.                                                                                                                                                                       | Fallback only if H5 could not support an evidence-backed resolver contract.                                                                                                                     | Existing marker/RPC mechanism cannot be reproduced or produces material contradictions under bounded current-runtime checks.                                 | Not required for Spike closure because H5 is supported                                                                                                                              |

Publisher/news-site access, anti-bot techniques, proxy/browser escalation and access-policy boundaries are now owned by independent Spike #22. They are not part of Issue #14 closure.

## 5. Current Iteration

**Iteration:** `6`  
**Hypothesis / approach:** `H5 — mechanism-level assurance for publisher-URL resolution`  
**Executor:** `ChatGPT-led evidence synthesis; Codex only for repository-local/offline checks or a separately approved minimal replay`  
**Owner approval:** `Approved H5 mechanism-level attribution rule (2026-09-29)`

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

**Supported:** The retained #18 matrix has a successful ID-bound marker/RPC candidate for all 100 rows, each yielding a syntactically valid non-Google destination. Its publisher-title assessment confirmed 79 rows, left 21 unverifiable, and found no confirmed mismatch. Under the owner-approved mechanism-level attribution rule, this supports >=95/100 URL resolutions. It does not mean 100 rows were independently confirmed as the exact publisher story; that distinction and the consequence of a stricter #4 interpretation are recorded below.

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

### Iteration 6 — H5 mechanism-level assurance

**Authorization:** The project owner approved the H5 direction and its mechanism-level attribution rule on 2026-09-29. This iteration is limited to offline evidence synthesis. No new live replay, publisher request, production implementation, sample change, threshold change, or Issue #4 acceptance change was authorized or performed.

**Method:** Reconcile the retained #18 hosted 100-row result against the fixed sample and the historical #14 marker/RPC results; inspect the retained request-side article-ID binding, RPC response parser, title-confirmation labels, and H4 redirect diagnostic; review independent community implementations only as corroborating leads. Treat a candidate as a supported resolver output only where a Google News page marker is bound to the originating article ID and the corresponding `Fbv4je` / `garturlreq` response parses as an HTTP(S), non-Google destination. Do not infer publisher-page accessibility or exact story identity from that operational rule.

**Evidence:** `docs/changes/18/hosted-results.json` and `hosted-run-metadata.json` retain 100/100 `success_rpc` candidates on the fixed 100-row matrix, with 79 `confirmed_match`, 21 `unverifiable`, and 0 `confirmed_mismatch`. The final hosted run was Apify Linux Node `v20.20.2` (`oiLOkd2rSc4WAYTAg`, build `bhBBv5ohtKDQamR4D`); the matrix has ten rows in each of five query × two edition cells. The same result records 81 HTTP 200 HTML publisher responses, 19 HTTP errors, 78 article-like pages and 76 strict confirmed successes; these access-dependent measures are not the H5 URL-resolution numerator.

Comparing exact full-`googleNewsUrl` SHA-256 values yields 83 distinct shared input URLs, appearing as 88 row occurrences in each artifact. Because duplicate multiplicities differ, at most 87 one-to-one row pairs can be formed. #14's RPC candidate rows lack exact input-URL keys, and `articleIdHash` is nonunique, so the persisted data support no cross-run candidate or identity comparison. #18 itself retains the full 100-row marker/RPC result and records 79 confirmed matches, 21 unverifiable rows and zero confirmed mismatches. The #18 manifest file SHA differs from an earlier pretty-printed file SHA (`d1ed2bea…` versus `aaa88dc2…`), while the canonical row-array SHA is unchanged (`fdbab474…`); this is a serialization/hash-scope difference, not a changed sample.

The retained implementation extracts `garturlres` as a URL string and applies HTTP(S)/non-Google destination checks (`docs/changes/18/probe.mjs:230-252,317-333`; see also `docs/changes/14/hosted-probe-rpc.mjs:122-146,232-250`). The RPC response contains no separately checked response-side article ID, publisher identity, or title. Therefore, article-ID binding is established on the Google-page marker/request side; the destination attribution is the approved mechanism-level inference, not a second identity proof embedded in the RPC response.

Independent implementations reviewed as leads describe the same article-page signature/timestamp plus `Fbv4je` / `batchexecute` pattern: [newspaper4k](https://github.com/AndyTheFactory/newspaper4k/blob/master/newspaper/google_news.py), [dbernheisel/google_news_decoder](https://github.com/dbernheisel/google_news_decoder), and [SSujitX/google-news-url-decoder](https://github.com/SSujitX/google-news-url-decoder). They corroborate that this mechanism is independently used; they do not specify Google's contract or prove per-row publisher identity.

The H4a redirect diagnostic records that the current bounded capture path stopped all 79 known-positive controls at an HTTP 302 to `consent.google.com`, before marker/RPC extraction (`docs/changes/14/h4/h4-redirect-diagnostic-2026-09-29T11-54-04-963Z-f3c8ad9b/redirect-diagnostic.json`, SHA-256 `fee1f24724e44a1ae73f19eb10f7a89d86d288b3e519e71ad85dbd7bae732b08`). This is an acquisition-path compatibility failure, not a contradictory marker/RPC destination. No redirect was followed and no policy changed. A current replay was not needed to evaluate H5 from the retained hosted matrix; the available replay path did not reach the mechanism being assessed.

**Result:** `Supported` for H5 under the expressly approved mechanism-level attribution rule. The evidence supports 100/100 operational URL resolutions on the retained #18 matrix and exceeds the unchanged 95/100 threshold as interpreted by that rule. It does not establish 100/100 independently confirmed exact publisher identities. Direct title evidence remains 79/100, and 21 rows remain unverifiable by that method.

**Learning:** Captured as [`docs/learnings/issue-14-stable-evidence-row-keys.md`](../../learnings/issue-14-stable-evidence-row-keys.md) (`google-news-enriched-actor-poc--issue-14--stable-evidence-row-keys`, SideGig review: Yes). The record covers stable per-occurrence evidence keys and explicit hash-input contracts for cross-run comparisons.

**Next checkpoint:** Integrate this evidence, then rerun `assess-change` on #4. Keep #4 blocked until that review confirms the approved success meaning is compatible with #4's acceptance criteria. If #4 reviewers require independently confirmed identity for every counted row, the current direct-evidence numerator is 79/100, below 95; obtain an explicit issue decision before changing the criterion or resuming implementation. The cross-artifact input overlap cannot raise that identity count because it has no keyed candidate/identity comparison.

## 7. Supported Technical Specification

> Partial while the Spike remains Open.

### Supported behaviour

- Google News RSS supplies the originating article URL/ID and source metadata used by this POC.
- In the retained #14 and #18 samples, the Google News marker/RPC sequence produced a syntactically valid HTTP(S), non-Google candidate for all 100 rows in both local Node 24 and Apify Node 20.
- The page-marker extraction used in #14 matched the input Google News article ID for all 100 tested rows. In #18, all 100 hosted candidates were `success_rpc`; 88 of the 100 #14 row occurrences had an exact-input match in #18. The retained fields do not support a candidate-destination comparison for those overlapping row occurrences.
- 79/100 hosted candidates have independent publisher-page title evidence confirming correspondence to the originating RSS title.
- No confirmed candidate mismatch has been observed in the frozen #18 matrix; 21 rows remain unverifiable by the publisher-title method.
- **Approved H5 counting rule:** For Issue #4's URL-resolution result, count a row as `urlResolved: true` when the originating `googleNewsUrl` is preserved, Google page markers are accepted only after their article ID matches that row's article ID, the corresponding marker/RPC call returns a parseable HTTP(S) URL, and the destination is not a Google-owned host. This is mechanism-level attribution under the owner-approved H5 rule. It is not independent confirmation that the destination page is the exact story.

### Required sequence / mechanism

1. Preserve the originating Google News article URL/ID and source metadata.
2. Follow the bounded Google News page flow required to obtain markers for that same article ID.
3. Call the observed marker/RPC endpoint using those row-bound markers.
4. Parse the returned candidate and accept only an HTTP(S) URL whose host is not Google-owned.
5. Set `urlResolved: true` under the approved H5 mechanism-level rule when steps 1–4 succeed. Retain the original `googleNewsUrl` as provenance/fallback and the returned URL as `publisherUrl`. If any resolution step fails, isolate the failure to that row and return `urlResolved: false` with `publisherUrl: null` while preserving `googleNewsUrl`.
6. Track publisher-page accessibility separately. A later publisher fetch failure does not reverse `urlResolved`; full-text extraction has its own independent outcome. General publisher access/anti-bot work is owned by #22.

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

Candidate extraction is strongly demonstrated on the tested matrix. Exact identity is directly confirmed for 79 rows and remains unverifiable by the publisher-title method for 21. Under the approved H5 mechanism-level attribution rule, the retained 100/100 ID-bound marker/RPC candidate results support the URL-resolution threshold; they do not establish 95 independent identity confirmations.

## 8. Remaining Uncertainty

The following uncertainties remain explicit but do **not** prevent the Spike from closing Feasible:

- the Google marker/RPC mechanism is undocumented and may change without notice;
- H5 relied on retained hosted evidence rather than a new live replay because the later H4 capture path stopped at `consent.google.com` before marker/RPC extraction;
- Issue #4 must still perform its own mandatory fresh 100-row external/runtime acceptance validation during implementation/validation, which will establish current compatibility at that point;
- the RPC result has no independently checked response-side article ID or title, so 21/100 rows remain unconfirmed by the publisher-title method even though they satisfy the approved mechanism-level URL-resolution rule;
- publisher-site reachability, anti-bot controls, browser/proxy escalation and permission/policy boundaries are outside this Spike and owned by #22.

## 9. Final Conclusion

**Result:** `Feasible under the owner-approved H5 mechanism-level attribution rule`

### Feasible

The retained #18 hosted fixed matrix yielded 100/100 article-ID-bound marker/RPC candidates with syntactically valid non-Google destinations. Historical #14 evidence independently demonstrated the mechanism locally and in Apify Node 20. The standalone #18 labels are 79 direct title-confirmed rows, 21 unverifiable rows and zero confirmed mismatches. The retained evidence contains no confirmed contrary destination. Under the approved H5 rule, these results support 100/100 operational URL resolutions, above the unchanged 95/100 threshold.

This feasibility result depends on the approved interpretation that an ID-bound Google marker/RPC result is sufficient attribution for URL-resolution success. It is not a finding that all 100 publisher identities were independently verified: 79 are directly title-confirmed, 21 remain unverifiable by that method, and the RPC parser does not inspect response-side identity fields. Issue #4's current acceptance criteria require >=95 valid resolved publisher URLs, not >=95 independent publisher-page identity confirmations.

### Not feasible

Not selected. The approved H5 interpretation satisfies the Spike's required outcome and Issue #4's current URL-resolution acceptance meaning. A future requirement for >=95 independent publisher-page identity confirmations would be a separate change to the downstream acceptance contract, not a reason to keep this Spike open.

The Technical Spike is complete with a supported `Feasible` conclusion.

## 10. Downstream Implications

- Merge of PR #21 integrates the final Spike evidence and closes Issue #14.
- After that merge, rerun `assess-change` on Issue #4 using the current installed SideGig skills before HLD, Implementation Planning or production resolver work resumes.
- Issue #4 retains its mandatory fresh representative 100-row external/runtime acceptance validation; the historical Spike evidence does not replace that implementation-time/current-runtime gate.
- #5, #6 and #7 remain transitively dependent through #4.
- #20 remains superseded and should not be revived as a parallel investigation.
- Publisher-site access remains a separate capability owned by #22.

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

## Completion

**Spike state:** `Ready to close`

**Rationale:** H5 supports 100/100 operational publisher-URL resolutions on the retained fixed matrix under the owner-approved mechanism-level attribution rule, exceeding the unchanged >=95/100 requirement. The 79 direct confirmations / 21 publisher-title-unverifiable distinction remains an explicit evidence limitation but does not contradict the accepted URL-resolution rule or Issue #4's current wording.

**Required next action:** Merge PR #21, which closes Issue #14. Then rerun `assess-change` on Issue #4 using the newly refreshed SideGig skills and proceed according to that assessment. Do not continue H4 publisher-access or consent-circumvention work; general automated news-site access is owned by #22.
