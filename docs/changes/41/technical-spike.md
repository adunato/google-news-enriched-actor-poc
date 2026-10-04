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
- A1 reached the resolver-ready page state for all five bounded controls using stateless hosted HTTP requests.
- A4 resolved 100/100 rows in the frozen representative sample to valid non-Google publisher URLs.
- B1 classified 53/100 rows as eligible cached HTML under its recorded response-status, content-type, body-size and challenge-marker rule.
- The B1 challenge-marker check is a body-text heuristic; its 29 `challenge_html` results are not confirmed access denials.
- B2 has not produced row-level extraction evidence; the 50/100 readable-text target remains unresolved.

### Remaining uncertainty

- whether the B2 candidate's early exit came from a fixture/hash/count gate, opening the prior run's key-value store, or another startup-stage failure;
- whether the approved generic extraction path produces readable article text for at least 50 of the full 100 rows;
- how much the B1 challenge-marker heuristic overclassified ordinary article text.

## 3. Current Investigation Position

**Investigation Area:** `B — Retrieve readable publisher article text`

**TID experiment:** `B2 — Extract with structured data plus Mozilla Readability`
**Route status:** `On Hold — B2 candidate emitted no experiment output`

A1 completed with a stable resolver-input path in its small control sequence. A4 met the publisher-URL acceptance threshold on all 100 frozen sample rows. B1 then produced 53 rows of eligible cached HTML, meeting the TID's 50-row gate. Area A is supported and B2 was eligible, but its first candidate run emitted no dataset rows or text evidence. B2 is on Hold pending bounded triage; the full-text target remains unresolved.

The approved TID authorised its defined sequence through B2 after B1 met the 50-row gate. It does not authorize a new troubleshooting direction beyond that sequence; the proposed diagnostic below is not approved.

## 4. Current Experiment Execution

**TID authorisation:** `tid-41-google-news-resolution-full-text — Approved 2026-10-04`

### Experiment definition

The approved next experiment is **B2 — Extract with structured data plus Mozilla Readability**, on only the exact 53 HTML response bodies retained by B1. Reuse structured article data when present; otherwise apply Mozilla Readability. Do not refetch publisher pages or allow hidden network retrieval. The first candidate run is on Hold because it produced no experiment output; do not rerun unchanged or proceed to B3 until that candidate is triaged.

Score the 53 accessible-HTML rows against the full 100-row denominator. For every row retain the Issue 18 row ID, original Google News URL and resolved publisher URL; distinguish rows with no HTML from extraction outcomes. Report non-empty readable text, extraction method, a consistent word count and failure class where applicable.

### Operational bounds

Keep the run deliberately small and bounded.

Record the exact fixtures, request count, runtime settings and retained evidence when the experiment is implemented.

Do not add browser automation, proxies/unblocking, custom egress/security machinery or another runtime.

### Permitted straightforward corrections

Only obvious mechanical corrections required to execute B2 without changing its purpose, mechanism, representative evidence or architectural boundary.

### Stop conditions

Stop for TID/owner review if completing B2 would require a materially different access mechanism, infrastructure, runtime, evidence basis or a separate troubleshooting investigation.

## 5. Experiment Log

### A1 — Reproduce and characterise hosted Google News access

**Eligibility and result:** A1 was the first mandatory experiment. It is classified **Supported** for establishing a stable stateless path to the resolver input on the bounded controls. This is not evidence for the 95/100 product acceptance target.

**Controls and provenance:** Four controls were selected from `docs/changes/18/input-manifest.json`: `q1-gb-01` (`www.bbc.co.uk`), `q1-gb-02` (`www.bbc.com`), `q1-us-01` (`www.tcu.edu`) and `q1-us-02` (`www.pbs.org`). Each had `success_rpc` and `confirmed_match` in the prior hosted result `oiLOkd2rSc4WAYTAg`, completed 2026-09-28. The retained evidence was six days old at A1 execution and establishes control provenance only. The request sequence was those four controls in that order, followed by a repeat of `q1-gb-01`.

**Hosted execution:** Private disposable Actor `JIogcgdHyCqAMHQ1P`. The first instrumentation build `9P7ZyZFLtjXe7jIpc` / `0.1.1`, run `kctNNzjl4N1SCREa5`, succeeded but retained only redirect hosts, so its redirect-destination evidence was incomplete. The probe was changed only to retain sanitized redirect origin+path (without query, fragment or credentials), then rebuilt as `3Kfn6KAjPexTZSoxs` / `0.2.1`; corrected run `bwAR2du9Ogv191p4i` succeeded and is the controlling A1 result. It ran on Apify Linux x64, Node `v20.20.2`, with 256 MiB configured memory and a 900-second timeout, from 2026-10-04 18:16:30.819 UTC to 18:16:35.584 UTC; platform usage was `$0.000122403726814522`.

**Bounds and session state:** Five ordered control attempts, with a 350 ms pause between attempts; at most five redirects and 10 seconds per control including redirects; at most 2 MiB of final HTML read per control. Requests used the existing resolver probe's user-agent. The probe used no cookie jar and sent no `Cookie` header. It retained cookie names only, never values. It did not inspect outbound network identity because the runtime did not expose a safe value to this probe.

**Observed evidence:** The corrected five-attempt sequence generated 10 outbound GET requests. Each control followed one HTTP 302 from `news.google.com` to the same `news.google.com/rss/articles/<article-id>` path (the redirect dropped the original query), then received HTTP 200 `text/html` from `news.google.com`. All five pages contained the resolver's article-ID, timestamp and signature markers, with the article ID matching its input; `AF_initDataCallback` was also present. All five attempts, including the repeated first control, were marked resolver-ready. Each 302 response exposed `Set-Cookie` names `NID` and `GN_PREF`; no cookie was replayed. No consent host appeared. No RPC request was made in A1; resolver readiness is based on the input-page markers, and actual resolution is measured by A4.

**Interpretation and route:** The normal stateless hosted path consistently reached the existing resolver's required page state for all five attempts in this run. A1 therefore supports stable access for these controls. It does not establish cookie/session reuse behaviour or a stable outcome across executions. The TID rule routes directly to A4 and skips A2/A3 because consent/interstitial behaviour or access instability was not reproduced. A4 must still prove at least 95 valid non-Google URLs out of 100.

**Retained evidence:** `docs/changes/41/experiments/a1/controls.json`, `a1-results-destination-capture.json`, `a1-run-metadata-destination-capture.json` and `a1-run-log-destination-capture.txt` are the corrected run artifacts. `a1-results.json`, `a1-run-metadata.json` and `a1-run-log.txt` retain the earlier evidence-incomplete run. Dataset evidence contains no response bodies, cookie values or credentials; exact control URLs remain in the fixture, and redirect queries/fragments are omitted.

### A4 — Run the publisher-URL acceptance sample

**Eligibility and result:** A4 was eligible after A1 established a stable stateless resolver-input path. It is classified **Supported**: the production-like hosted flow resolved 100/100 retained sample rows to valid non-Google publisher URLs, exceeding the 95/100 target. All 100 outcomes were `success_rpc`; there were no failures to exclude or deduplicate. The evidence validates this fixed sample and candidate only, not universal publisher reachability or future stability.

**Sample and method:** The exact Issue 18 input manifest was copied byte-for-byte to `docs/changes/41/experiments/a4/input-manifest.json` (SHA-256 `d1ed2bea31efc54358ac24d991a9037ec0f0840ccd50547c01bd794c64389f3c`; normalized row-array SHA-256 `fdbab474e5764350c547080c0002f042b062e03f157a270d5b9474d846ad2f2a`). It contains 100 unique row IDs, 76 source hosts, 10 query/edition cells, and five duplicate Google News URL occurrences; all 100 row occurrences were measured without deduplication. The existing Issue 14 marker/RPC resolver was reused, with only the bounded classifier adaptation to reject Google country/edition domains and service roots as publisher targets. Its per-row timeout was 10 seconds, response limit 2 MiB, redirect limit five and concurrency four. Each output row maps the original row ID and Google News URL to its resolution status and publisher URL.

**Hosted execution and outcome:** Private disposable Actor `JIogcgdHyCqAMHQ1P`, build `BAh1hAwf5Jns6mhoc` / `0.3.1`, run `xxaa9DrYUPmi11Gdl`, dataset `QKdt4yQSOqmslTRZk`; run status `SUCCEEDED`. Runtime was Apify Linux x64, Node `v20.20.2`, configured at 256 MiB and 900 seconds. The 100 rows generated 300 HTTP requests (100 redirecting page requests, 100 landing-page requests, 100 decoder RPC requests); all returned `302`, `200`, and `200` respectively. The run completed in 7.981 seconds and cost `$0.0007326819104088678` by final Apify usage total. No residential proxy or unblocking units were used.

**Interpretation and route:** A4 supports the approved lightweight hosted resolver against the defined representative sample: 100/100 valid non-Google publisher URLs with original Google News provenance retained and no row-level failures. A2/A3 remain skipped. Area A is supported, so the TID's Area B sequence is now eligible; B1 is mandatory first after Area A. This does not establish the full-text 50/100 target.

**Retained evidence:** `docs/changes/41/experiments/a4/input-manifest.json`, `a4-results.json`, `a4-dataset.json`, `a4-run-metadata.json` and `a4-run-log.txt` preserve the frozen sample, row-level results, hosted run metadata and logs. Dataset rows contain public Google News and publisher URLs but no response bodies, cookie values or credentials.

**Evidence normalization:** The local A4 results JSON was regenerated from the retained hosted dataset and sanitized run metadata after correcting a serialization newline. JSON whitespace in generated dataset/metadata artifacts was normalized for the repository formatter; their parsed values were verified unchanged. The hosted run was not repeated, and the frozen A4 manifest and its recorded hashes were not modified.

### B1 — Measure current publisher-page access

**Eligibility and result:** B1 followed the supported Area A result and was the mandatory first Area B experiment. It is classified **Supported for the TID's access gate**: 53/100 rows met the explicit usable-HTML eligibility rule, reaching the 50-row condition for B2. This establishes access eligibility for this fixed sample/candidate; it does not establish readable article text or full-text feasibility.

**Sample and method:** B1 used all 100 resolved URLs from the A4 rows, preserving each original Issue 18 row ID, Google News URL and publisher URL/hash. It performed bounded ordinary HTTP only, with four concurrent rows, a 10-second per-row timeout, a 2 MiB body limit and at most five redirects. No extraction ran. Eligible HTML was retained as exact response bytes in the run key-value store for B2; 53 records total 1,683,170 bytes. The eligibility rule was a final 2xx `text/html` or `application/xhtml+xml` response with a non-empty body under the cap and no explicit challenge/access-denial marker.

**Hosted execution and outcomes:** Private disposable Actor `JIogcgdHyCqAMHQ1P`, build `gHv4JmdlSO8RgczOg` / `0.4.1`, run `g7ndwu3G1M4orPt2h`, dataset `J4MaTPxn3EDcjuUIO`, key-value store `C1KYtogOgGpkRyF2H`; run status `SUCCEEDED`. It ran on Apify Linux x64, Node `v20.20.2`, configured at 256 MiB and 900 seconds, from 2026-10-04 18:48:02.916 UTC to 18:48:29.119 UTC. The run made 101 HTTP requests and cost `$0.0036840330466909542` by final Apify usage total, including 101 dataset writes and 54 key-value writes. Outcome classes were 53 `usable_html`, 18 `http_denied` and 29 `challenge_html`; all 100 row mappings are present, and all 53 eligible rows have retained HTML keys.

**Interpretation and route:** The TID's B2 gate is met because 53 rows qualify under the declared transport/content-type/body eligibility rule. The `challenge_html` classification is a body-text heuristic and may conservatively match ordinary article text; those 29 rows are not described as a confirmed access boundary, and this heuristic does not prove extraction quality. B2 must use only the 53 cached HTML responses and assess text quality separately, with the full 100-row denominator.

**Retained evidence:** `docs/changes/41/experiments/b1/input-sample.json`, `b1-results.json`, `b1-dataset.json`, `b1-run-metadata.json`, `b1-run-log.txt` and `b1-kvs-manifest.json` preserve the exact sample mapping, row-level outcomes, run evidence and cache-key/size inventory. The first run-info snapshot showed provisional usage of `$0.00010043147036764356`; the final run-info refresh reports `$0.0036840330466909542` and is the controlling cost. Cached bodies remain in the Apify run key-value store identified above; no raw body was copied into the dataset or run log.

### B2 — Extract with structured data plus Mozilla Readability (candidate on Hold)

**Eligibility and result:** B2 was eligible after B1 retained 53 HTML bodies. The first B2 candidate is classified **Inconclusive**: no row was processed, no extraction result was emitted, and this run does not measure the 50/100 readable-text target. The candidate remains **On Hold** pending bounded triage; this is not evidence that the extractor met or failed the product threshold.

**Candidate and execution:** Private disposable Actor `JIogcgdHyCqAMHQ1P`, build `l3uVVuyZ0KLYMI15F` / `0.5.1`, run `AJSp7azbT9jHJC1gO`, dataset `BxTe7aJ5krgGojQZb`, key-value store `gtHV2cXpZZon47EIn`. Apify reports run status `SUCCEEDED`, but it ended 4.504 seconds after start with zero dataset writes and only one key-value record. The log reaches SDK system information (`v20.20.2`) but contains no B2 summary or row-processing output. Run network receive was 1,596 bytes, consistent with no retained B1 HTML being read; Apify usage total was `$0.00011279546425077649`.

**Observed facts and unconfirmed hypotheses:** The observed facts are the empty dataset, zero dataset writes, absence of any `B2_TEXT_*` records, short runtime and startup-only log. An early exception before row processing or inability to open the prior run's key-value store are hypotheses only; neither has been confirmed. No correction or second B2 run has been made, and B3 is not eligible because extraction quality has not been measured.

**Retained evidence:** `docs/changes/41/experiments/b2/input-sample.json`, `b2-results.json`, `b2-dataset.json`, `b2-run-metadata.json` and `b2-run-log.txt` preserve the candidate's sample, empty result and run evidence. The exact B1 HTML cache remains identified in the B1 record and was not modified.

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
**Area A:** `Supported` — A4 resolved 100/100 sample rows.

**Area B:** `Unresolved` — B1 passed the access gate; B2 is `Inconclusive / On Hold` because it emitted no experiment output.

**Spike conclusion:** `Pending`; neither downstream capability is unblocked.
**Required next action:** `Owner decision at the Experiment Viability Checkpoint below.`

## Product and Issue context

The product is a single Node.js 20 Actor hosted by Apify. It turns Google News results into structured article rows, attempts to resolve each Google News link to a public publisher URL, and can optionally fetch public publisher pages and provide readable article text. It must keep an original Google News URL, isolate one row's enrichment failure from other rows, and remain lightweight and HTTP-first.

Technical Spike #41 asks whether those two enrichment capabilities can meet their live sample thresholds within that boundary: at least 95 valid non-Google publisher URLs from 100 rows, and at least 50 rows with readable article text from the same 100-row representative sample. The blocked downstream work is publisher URL resolution (#4) and optional full-text extraction (#5). Both remain blocked until this Spike reaches a supported conclusion and they are reassessed.

## Why this Spike exists

Google News redirects, public publisher responses and article HTML vary in the hosted environment; local mocks cannot establish those live outcomes. The approved Technical Investigation Design separates publisher-link resolution from publisher-page access and text extraction so access failures are not mistaken for parser failures. Its Area B sequence requires an access sample first, then extraction only when at least 50 rows yield usable HTML.

## What we have learned so far

- Five known-good controls reached the resolver-ready Google News page state in one normal hosted execution. This supported moving to the 100-row resolution test.
- The 100-row hosted resolution run produced 100/100 valid non-Google publisher URLs, retained each row's original Google News URL, and met the 95/100 target. Area A is supported for this fixed sample and candidate; it does not establish universal or future reachability.
- The publisher-page access run yielded 53/100 rows classed as usable HTML and retained their exact response bytes in Apify storage for the next experiment. Eighteen rows were denied by HTTP status. Twenty-nine returned HTML that matched a challenge/access-denial text heuristic. Because that check scans body text and can match ordinary article wording, those 29 rows are not confirmed access failures.
- The one B2 candidate run used the same 100-row fixture and was intended to parse only the 53 cached HTML bodies. Apify reported `SUCCEEDED`, but its dataset had zero items, it wrote no extraction text, its log ended after SDK system information, and the run lasted 4.504 seconds. This is an inconclusive candidate result, not evidence that the extraction threshold passed or failed.
- An early failure at a fixture/hash/count check, opening the prior run's storage, or another startup stage is possible, but no cause is established. B3, the alternate parser, is not eligible until B2 demonstrates an extraction-quality shortfall on accessible HTML.

Exact execution evidence is retained under `docs/changes/41/experiments/`; the B2 run is `AJSp7azbT9jHJC1gO` on build `l3uVVuyZ0KLYMI15F` / `0.5.1`. Its local run metadata, empty dataset and startup-only log are `b2-run-metadata.json`, `b2-dataset.json` and `b2-run-log.txt` in the B2 experiment folder. The spike remains open and the approved TID remains unchanged.

## What would need to change

The proposal is one diagnostic B2 candidate and one hosted run. It would keep the same Node.js 20 Actor, the currently pinned parser packages, the exact 100-row fixture and 53 cached HTML bodies, the existing request-free extraction method, resource limits, output scoring and original-URL provenance. It would not refetch publisher pages or change the denominator, threshold, parser, dependencies or runtime.

The only proposed code changes are startup-stage markers in the existing `main.mjs` around: reading and validating the fixture/hash/counts; opening the previous run's key-value store; entering and completing the cached-row loop; and writing the output dataset. Add sanitized fatal-error reporting that preserves an actual process failure rather than letting shutdown conceal it. Do not log credentials, body contents or extracted article text.

The purpose of that single run is to distinguish a fixture/hash/count gate from a prior-run storage-access failure or a later row/dataset stage. This diagnostic proposal is **not approved** and no changes or run are authorized by this checkpoint.

## Direction and complexity check

The proposed probe would preserve the approved B2 mechanism, representative data, runtime, dependency set, limits and acceptance criteria. However, the failed candidate provides no evidence identifying which startup stage failed; selecting and instrumenting a diagnostic direction is more than a known typo or other straightforward correction. The technical-spike skill therefore requires an owner checkpoint before that work proceeds.

If an owner explicitly approves this one diagnostic run and it produces normal B2 row evidence, resume the existing TID routing after validation. If the diagnostic only identifies or fails to identify the startup failure without producing valid B2 evidence, stop and return the evidence. Do not choose a deeper diagnostic, rerun a corrected candidate, or start B3 without another review decision. The existing TID approval is not amended by this proposal.

## Recommendation

Keep B2 `Inconclusive / On Hold`, keep the overall Spike conclusion `Pending`, and leave Issues #4 and #5 blocked. Approve only the bounded diagnostic proposal above if the added information is worth one additional private hosted run; otherwise stop this investigation with full-text viability unresolved. Do not open a pull request during this active Spike.

## Decision requested

Choose one:

- **Revise the TID and approve the single diagnostic B2 run described above.** No other diagnostic or corrective run is included.
- **Stop the investigation at the current evidence boundary.** Record publisher resolution as supported for its tested sample and full-text viability as unresolved; keep Issues #4 and #5 blocked for reassessment.

No diagnostic change or hosted run may begin until the owner answers this decision. The proposed diagnostic is not an approval, and no TID artifact has been changed to imply otherwise.
