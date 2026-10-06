# Technical Spike: Google News publisher resolution and full-text viability

> Living execution/evidence record for Technical Spike [**Prove Google News publisher resolution and full-text viability (#41)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/41). The Issue defines the stable question and the approved TID defines the experiment sequence, routing, evidence criteria and boundaries.

**Artifact ID:** `spike-41-google-news-resolution-full-text`  
**Status:** `Open`  
**Owner:** `Project owner`  
**Created:** `2026-10-04`  
**Updated:** `2026-10-06`
**GitHub Spike Issue:** `Prove Google News publisher resolution and full-text viability (#41)`  
**Technical Investigation Design:** `docs/changes/41/technical-investigation-design.md` / `tid-41-google-news-resolution-full-text` — **Approved; B2-D1 amended 2026-10-05, B2-S1 amended 2026-10-06 for one run, and B2-P1 read-only metadata comparison approved 2026-10-06**
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
- The approved B2-D1 candidate passed fixture hash/count checks but failed at source-store opening before any row processing; the underlying cause remains undetermined.
- B2-S1 used its one owner-approved run; the Actor identity received HTTP 403 `insufficient-permissions` on the source-store metadata request before reading the fixed record.

### Remaining uncertainty

- whether the B2-D1 failure and B2-S1's observed 403 share a cause; the B2-D1 log did not retain a status or API type;
- whether the approved generic extraction path produces readable article text for at least 50 of the full 100 rows;
- how much the B1 challenge-marker heuristic overclassified ordinary article text.

## 3. Current Investigation Position

**Investigation Area:** `B — Retrieve readable publisher article text`

**TID experiment:** `B2 — Extract with structured data plus Mozilla Readability`; additive read-only diagnostic `B2-P1 — ownership/access-grants metadata comparison`
**Route status:** `B2-D1 and B2-S1 Inconclusive; B2-P1 metadata ownership comparison Supported, individual-grant/root-cause question Inconclusive because the conditional Console view was unavailable; full-text work remains On Hold`

A1 completed with a stable resolver-input path in its small control sequence. A4 met the publisher-URL acceptance threshold on all 100 frozen sample rows. B1 then produced 53 rows of eligible cached HTML, meeting the TID's 50-row gate. Area A is supported and B2 was eligible, but its first candidate run emitted no dataset rows or text evidence. The owner approved the single B2-D1 diagnostic amendment on 2026-10-05. Full-text viability remains unresolved.

The B2-D1 amendment authorized one changed private B2 candidate and one hosted run with startup-stage markers and sanitized fatal-error reporting. That run failed during source-store opening before row processing, so no valid B2 extraction evidence exists and that authority is exhausted. The owner then approved exactly one B2-S1 diagnostic build/run. Its first read-only request to inspect the existing B1 store returned HTTP 403 `insufficient-permissions`; it did not attempt the fixed-record read. This is an access denial for the current Actor identity, not evidence that the store or record is missing, not proof that B2-D1 had the same cause, and not extraction-quality evidence. The S1 authorization is exhausted. The owner has since approved B2-P1, a separate, bounded read-only comparison of the S1 run and B1 store metadata. No Actor run, permission change or credential change is authorized; full-text viability remains unresolved.

## 4. Current Experiment Execution

**TID authorisation:** `tid-41-google-news-resolution-full-text — Approved 2026-10-04; B2-D1 amendment approved 2026-10-05; B2-S1 amendment and B2-P1 metadata comparison approved 2026-10-06`

### Experiment definition

**B2-D1** was the one owner-approved diagnostic execution attached to B2. It used the same structured-data/Readability candidate, the exact 53 HTML response bodies retained by B1, and the original 100-row denominator. It failed at source-store opening before row processing, so it provided no extraction evidence. The first candidate and B2-D1 remain on Hold; the authorized diagnostic is exhausted.

Score the 53 accessible-HTML rows against the full 100-row denominator. For every row retain the Issue 18 row ID, original Google News URL and resolved publisher URL; distinguish rows with no HTML from extraction outcomes. Report non-empty readable text, extraction method, a consistent word count and failure class where applicable.

### Operational bounds

Keep the run deliberately small and bounded.

Record the exact fixtures, request count, runtime settings and retained evidence when the experiment is implemented.

Do not add browser automation, proxies/unblocking, custom egress/security machinery or another runtime.

### Permitted straightforward corrections

Only the exact diagnostic instrumentation described by approved TID amendment B2-D1 is authorized in addition to the unchanged B2 mechanism. After the single D1 run, no further corrections or runs are authorized by this amendment.

### Stop conditions

Stop after B2-D1 if valid extraction evidence was not produced. Startup, source-store, cache-integrity, transport or other processing errors do not establish extraction quality even when represented by 100 row outcomes. No second diagnostic, corrective run, unchanged rerun, or B3 run is authorized unless valid B2 extraction evidence demonstrates the TID's extraction-quality condition and subsequent validation supports that route.

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

### B2-D1 — Single approved diagnostic execution

**Authorization:** On 2026-10-05, the project owner approved the TID amendment for exactly one changed B2 build and one private hosted run, identified as B2-D1. The change is limited to sanitized stage markers at the fixture/hash/count checks, B1 key-value-store open, row-loop boundaries and dataset-write boundaries, plus sanitized fatal/Actor-exit error reporting that preserves a failing process exit status. Package and Actor version metadata identify the candidate. Parser behavior, pinned dependencies, Node 20 runtime, 100-row fixture, 53 cached HTML bodies, limits, scoring, output schema and provenance are unchanged.

**Approved run rule:** Execute exactly once on the existing private Actor, using the original memory and timeout settings, without publisher or Google News requests. Verify the fixture hash, 100 row mappings and byte-count/SHA-256 of each cached B1 body. Retain the complete outcome/dataset and private text-key inventory, logs, run metadata and final cost. Reviewable extracted text is required to assess readable-text quality.

**Decision after execution:** Resume the original TID route only if verified cached HTML was meaningfully processed and valid B2 extraction outcomes are available. B3 is eligible only if those outcomes show an extraction-quality shortfall on accessible HTML. A startup, source-store, cache-integrity, transport or other processing error does not establish extraction quality, including when recorded across all 100 rows. If valid B2 evidence is absent or the cause remains unclear, record the observation and stop; no further diagnostic, corrective or unchanged run is authorized.

**Candidate and execution:** Private Actor `JIogcgdHyCqAMHQ1P`, build `T1HPbeieVgcdHvQpy` / `0.6.1` (version `0.6`, tag `issue41-b2-d1`), run `VNatt0T7n2q8sngEa`, dataset `trhUjInuTHJWpRiI3`, and default key-value store `ETqOZJkMiEfKb1gpe`. The build succeeded. The run used Node `v20.20.2` on Linux x64, 256 MiB, and completed in 3.913 seconds. Apify reports `SUCCEEDED` and exit code `0`, despite the logged fatal error described below. Platform usage total was `$0.00010456701434983148`.

**Observed diagnostic evidence:** The fixture read, SHA-256 comparison and count check completed; the hash matched, all 100 row IDs were unique, and 53 rows had cached-HTML keys. The log then recorded `source_store_open_start` followed by a sanitized fatal marker with error class `ApifyApiError`, no error code and no HTTP status. No source-store-open completion, row-loop or dataset-write marker appeared. Platform usage records zero key-value reads and zero dataset writes; the run's default key-value store has only the two-byte `INPUT` record, and the dataset is empty. No `B2_TEXT_*` evidence exists and no row was processed. This identifies the last observed stage only; the underlying cause is undetermined.

**Execution-setting deviation:** The Actor manifest specifies 900 seconds, but this CLI call omitted an explicit timeout override and Apify reports an effective 3,600-second timeout. The run ended after 3.913 seconds, so it did not approach either limit, but the effective setting differs from the approved 900-second bound. This deviation is retained as observed; the run will not be repeated.

**Result and route:** B2-D1 is **Inconclusive / On Hold** and did not measure extraction quality. The platform's success status does not override the fatal marker and absence of processing evidence. The single approved run is exhausted. Do not run B3 or attempt another diagnostic/correction under this amendment.

**Retained evidence:** `docs/changes/41/experiments/b2/b2-d1-results.json`, `b2-d1-dataset.json`, `b2-d1-run-metadata.json`, `b2-d1-run-log.txt` and `b2-d1-kvs-manifest.json`. The record contains no source-cache bodies, extracted text, credentials or signed storage URLs.

### B2-S1 — Approved single-record cached-body access witness

The B2-D1 authorization is exhausted. On 2026-10-06, the owner approved exactly one private build and hosted run for B2-S1, as separately specified in the TID. At approval, no S1 API call, Actor build or hosted run had occurred. The owner acknowledged the modeled approximately `$0.0127` standard-rate charge and its uncertainty. The single S1 authorization is now exercised and exhausted; the overall Spike conclusion remains `Pending` and B2-D1 remains `Inconclusive / On Hold`.

Local S0 reconciliation completed on 2026-10-05: the frozen fixture hash is `8bb9facc14fd7a5755c9337f7d9864ba6fb7958a44d6ae654b8e17ee84f63c8c`; the 100 unique fixture rows match their B1 references, including all 53 eligible HTML cache references, with no mapping or expected body-metadata mismatches. The first eligible row is `q1-gb-01`, key `B1_HTML_q1-gb-01`, expected body length `435577` bytes and SHA-256 `6f8d86bc1f95de5b118a55e4d4d89c39cf38a94c3ca9f5319e135dd357841dd9`. The B1 source run/store IDs are `g7ndwu3G1M4orPt2h` / `C1KYtogOgGpkRyF2H`. The manifest's `51179`-byte storage size is not the raw response-body length.

S1 makes one metadata read for the existing B1 store and, only if it exists, one fixed-record read using `getRecord(key, { buffer: true })`. Treat `record.value` as the returned Buffer; compare `record.value.length` and the SHA-256 computed over `record.value` against the B1 witness, and retain the returned content type when present. The approved bounds are the existing private Actor and Node.js 20 runtime, 256 MiB/900 seconds explicitly set and verified, zero retries, a five-second client timeout per request, no more than two read-only KVS requests/ten seconds, and a 2 MiB body maximum. It does not fetch publishers or Google News, extract text, write dataset rows, create/open another store, add dependencies, or retain/log the body or credentials. Every terminal outcome stops; even a successful witness establishes access to only that one record, not all 53 cached bodies or full-text viability. Further work would require a later reviewed design.

At Apify public Free/Starter rates checked 2026-10-05, the maximum 256 MiB/900-second allocation models `$0.0125` compute; two KVS reads add `$0.00001`, and up to 2 MiB transfer adds about `$0.000098`, for an estimated **$0.0127** standard-rate charge under the stated envelope. This is not a guaranteed total charge or enforced cap: the account tariff is unknown, and metadata transfer, build, retained storage or other account usage may add cost. The owner approved one build/run while acknowledging this estimate and uncertainty; no additional numeric spend ceiling was required by the TID controls. See [Apify pricing](https://apify.com/pricing) and [Actor usage and resources](https://docs.apify.com/actors/running/usage-and-resources).

**Execution result (2026-10-06):** Build `jop1JEffyaJM2tiNR` / `0.7.1` succeeded. The single run `hr2WzjPcLnZgHQYmZ` used that exact build with configured 256 MiB and 900 seconds; it ran on Node.js `v20.20.2` (Linux x64), completed in 3.252 seconds and reported final run usage of `$0.00009530627192060154`. One source-store metadata request took 64 ms and returned HTTP 403, API type `insufficient-permissions`, class `ApifyApiError`. The Actor exited 1 and the platform status was `FAILED`. The fixed-record request was not attempted; there were zero dataset writes and the platform reported zero KVS reads. The platform reported one KVS write for the run's default store; the diagnostic source contains no KVS write call. No body or secret was retained.

**Classification and stop:** B2-S1 is **Inconclusive** for the single-record witness question and **On Hold**. The observed 403 establishes that the current Actor identity could not inspect B1 store metadata. It does not establish that the store or record is absent, that B2-D1 had the same cause, that publisher access failed, or that extraction quality is inadequate. Stop here: no permission change, second source request, corrective run, B2 resume or B3 is authorized. The overall Spike conclusion remains `Pending`.

**Next boundary at S1 completion:** Active experimentation stopped here. A later owner decision separately authorized the bounded read-only metadata comparison recorded below. That later approval does not authorize an Actor build/run, record read, permission or credential change, or extraction work.

**Retained evidence:** `docs/changes/41/experiments/b2-s1/b2-s1-approval.json`, `b2-s1-build-metadata.json`, `b2-s1-run-metadata.json`, `b2-s1-run-log.txt` and `b2-s1-results.json`. The run metadata is a sanitized selection; signed storage URLs, URL-signing keys, user identifiers and unrelated Actor history were excluded.

### B2-P1 — Read-only ownership/access-grants metadata comparison

**Approval and status (2026-10-06):** The owner approved a bounded, read-only comparison of metadata for the failed S1 run and the B1 source store, with a conditional one-view inspection of that store's Console access/share settings only if both metadata GETs succeed but individual grant context remains unknown. This is not a new full-text experiment and does not resume B2. The existing Actor run was `hr2WzjPcLnZgHQYmZ`; its existing Actor was `JIogcgdHyCqAMHQ1P`; the B1 source store is `C1KYtogOgGpkRyF2H`, associated in retained evidence with B1 creator run `g7ndwu3G1M4orPt2h`.

**Question:** Can the existing configured Apify account read the S1 run metadata and B1 store metadata, and do their exposed owner/Actor/run/general-access fields align? This may contextualize the S1 403, but it cannot establish the cause of that denial or whether stored HTML can be read.

**Bounded method:** The isolated helper uses Apify JavaScript client `2.25.0`, pinned through the existing B2-S1 dependency lock. It obtains the already configured CLI account token into memory only; token and raw error messages are never printed, logged or written. It sets zero retries and a five-second client timeout, then calls the run metadata GET once followed by the store metadata GET once only after a valid expected run response. Maximum is two GET requests and ten seconds combined configured request timeouts. Any denied, unavailable, empty, mismatched or unexpected response stops the sequence. Only safe IDs/status, actual exposed permission/general-access fields, elapsed/request outcomes, hashes of user IDs and the equality result are retained. `null` general access is distinguished from an unexposed field; missing access-control metadata is not treated as proof that no individual grant exists. No record/key/body, Actor log, dataset, build/run, source write, other account, credential, login, publisher page or Google News request is in scope.

**Conditional Console step:** I will not open the Console. If and only if both API responses succeed and the relevant individual grant context remains unknown, Main may assign one read-only Explorer attempt through the existing authenticated session, following the store detail page's Actions → Share path. Console navigation may make additional UI requests; the two-GET API cap does not apply to those requests. The view is limited to access/share settings; it must not inspect keys or records, preview bodies, alter grants, invite users, use a new login/account, expand into account inventory, or retain personal grant details. If an API response is denied, unavailable or unexpected, stop and report before any Console action. The path is documented by Apify's [Share storage](https://docs.apify.com/storage/share) and [Grant access rights](https://docs.apify.com/account/collaboration/access-rights) pages.

**Readiness and execution:** The helper and approval record passed the internal readiness gate before live requests. Syntax, pinned-client import/version, SDK method availability, zero-retry/five-second configuration, approval JSON and formatting checks passed; a separate local check confirmed the preconfigured CLI token could be captured in memory without displaying it. The approved two-GET API sequence then completed once. An assigned read-only Explorer found no browser available for the conditional Console view; after the owner availability opportunity, no browser was made available. The Explorer did not open the Console, log in, or issue another API call.

**API result (2026-10-06):** The run metadata GET returned an SDK response object in 526 ms. Its run ID and Actor ID matched the expected S1 run, status was `FAILED`, `generalAccess` was `FOLLOW_USER_SETTING`, and no separate `permissionLevel` field was exposed. The store metadata GET returned an SDK response object in 127 ms. Store ID, Actor ID and B1 creator run ID matched the retained expected values; the store owner ID hash matched the S1 run user ID hash. Store `generalAccess` was also `FOLLOW_USER_SETTING`. These values mean the resources inherit the account-level general visibility setting; the effective account setting was not observed. The run's `generalAccess` is a run-resource sharing field, not the Actor runtime permission level. The SDK did not expose a raw HTTP success status; none is claimed. Individual grants remain unknown. No raw user IDs, email/username, token, signed URL, signing key or unrelated metadata was persisted. The filtered evidence is `experiments/b2-p1/b2-p1-results.json`.

**Current route and boundary:** The matching owner and creator links support the metadata ownership comparison. The account-level `FOLLOW_USER_SETTING` values do not reveal the effective general setting or individual grants, and run `generalAccess` does not expose runtime permission. S1's `LIMITED_PERMISSIONS` evidence comes separately from the retained S1 run log. The conditional Console settings/share trigger was met, but no browser was available after the owner availability opportunity; no Console page was viewed. Classify the metadata ownership comparison as Supported and the individual-grant/root-cause question as Inconclusive. This does not explain the S1 403, prove a record/body is accessible, or measure extraction quality. Stop here: no further API request, Console attempt, access change, build, Actor run, record read, B2 resumption or B3 is authorized. Full-text feasibility remains unresolved and On Hold. See Apify's [General resource access](https://docs.apify.com/account/collaboration/general-resource-access) and [Actor permissions](https://docs.apify.com/actors/development/permissions) documentation.

**Retained evidence:** `experiments/b2-p1/approval.json`, `experiments/b2-p1/readonly-ownership-check.mjs`, and the helper-generated `experiments/b2-p1/b2-p1-results.json` after the single authorized attempt. No account token, raw user ID, email/username, signed URL, HTML or record body belongs in these artifacts.

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

**Area B:** `Unresolved / On Hold` — B1 retained 53 usable HTML responses. B2-D1 stopped before processing cached HTML with an unknown cause. B2-S1 received HTTP 403 `insufficient-permissions` on one source-store metadata request and made no record read; its single-run approval is exhausted. B2-P1 supports matching store/run ownership and creator linkage. Both resources report `FOLLOW_USER_SETTING`, meaning they inherit the account-level general visibility setting; its effective value and individual grants remain unknown. No Console share-settings view occurred because no browser was available after the owner availability opportunity. The metadata comparison does not explain S1's denial or establish body readability or extraction success.

**Spike conclusion:** `Pending`; neither downstream capability is unblocked.
**Required next action:** `No further metadata or Actor action under B2-P1. The conditional Console view was unavailable and this bounded route is complete. Keep full-text viability unresolved and On Hold. Any later access investigation requires a separate owner decision and bounded design; no permission/grant change, credential change, API request, build/run, record read or extraction is authorized.`

**Historical checkpoint note:** The following checkpoint records the 2026-10-05 B2-D1 decision and is retained as history. Its single-run approval was exercised and exhausted. It was superseded by the 2026-10-06 B2-S1 approval/result, then by the later B2-P1 metadata comparison and current boundary. No approval in the historical checkpoint authorizes additional work.

## Historical checkpoint: B2-D1 post-run (superseded)

The checkpoint below preserves the owner context and decision state immediately after B2-D1 on 2026-10-05. Its evidence and approval remain historical; its decision request and next-step language were later superseded by the S1 checkpoint and the current B2-P1 record above.

## Product and Issue context

The product is a single Node.js 20 Actor hosted by Apify. It turns Google News results into structured article rows, attempts to resolve each Google News link to a public publisher URL, and can optionally fetch public publisher pages and provide readable article text. It must keep the original Google News URL, isolate one row's enrichment failure from other rows, and remain lightweight and HTTP-first.

The publisher-link feature (Issue #4) and optional article-text feature (Issue #5) depend on those capabilities. The controlling Spike (Issue #41) asks whether publisher links can resolve for at least 95 of 100 representative rows and readable article text can be produced for at least 50 of those 100 rows. The downstream Issues remain blocked pending a supported Spike conclusion and reassessment.

## Why this Spike exists

Google News redirects, publisher responses and article HTML vary in Apify's hosted environment; local mocks cannot establish those live outcomes. The approved investigation design tests publisher-link resolution separately from publisher-page access and text extraction, so access failures are not mistaken for parser failures. It requires an access sample first and allows extraction only when at least 50 rows yield eligible HTML.

The publisher-resolution target is supported on the fixed sample. The access sample also met the extraction gate, but the first extraction candidate produced no row evidence, leaving the full-text target unanswered.

## What we have learned so far

- Five known-good controls reached the resolver-ready page state in one ordinary hosted execution. The subsequent 100-row run produced 100 valid non-Google publisher URLs, preserving each original Google News URL; this supports the tested sample, not future universal reachability.
- The publisher-page access run retained 53 usable HTML responses out of 100. Eighteen were denied by HTTP status. Twenty-nine matched a text heuristic for challenge pages, but the heuristic can also match ordinary article wording, so those results are not confirmed denials.
- The first text-extraction candidate ended in 4.504 seconds with a platform-reported successful status but zero dataset items, no retained extracted text and startup-only logs. This is inconclusive; it does not show whether extraction can meet the 50/100 target.
- The reason for the empty run is unknown. A failure in fixture checks, opening prior-run storage, row processing or a later stage remains possible. These are hypotheses, not findings. Another parser is not justified unless valid extraction evidence first demonstrates an extraction-quality shortfall on accessible HTML.

## What we propose to do next

The question is whether one instrumented B2 execution can both reveal where the empty run stopped and, if processing proceeds, produce valid row-level extraction evidence. The owner approved one private diagnostic build and run on 2026-10-05. It retains the same Node.js 20 Actor, parser packages, 100-row sample, 53 cached HTML responses, limits, scoring and provenance. It adds only stage markers at the fixture checks, prior-run storage open, row-loop boundaries and dataset-write boundaries, plus sanitized fatal-error reporting that preserves a failing exit status.

The diagnostic will not fetch publisher or Google News pages, change extraction behavior, log credentials or article contents, or alter the acceptance targets. If verified cached HTML is meaningfully processed, the resulting B2 evidence will be validated and routed by the existing investigation rules. If no valid extraction evidence is produced, record the observed failure and stop; the approval allows no second diagnostic or corrective run.

## Direction and complexity check

This continues the same product question and adds no architecture, infrastructure, dependencies, runtime, security mechanism or product scope. The stage markers and sanitized fatal reporting are limited instrumentation around the existing candidate. The owner approved revising the investigation design for exactly this one execution; any further troubleshooting remains outside that approval.

## Recommendation

Use the single approved diagnostic run because it can distinguish whether the previous candidate reached its data-processing stages while preserving the approved extraction test. Keep the full-text conclusion pending unless the run yields valid evidence. If it does not, stop rather than deepen the troubleshooting; use another parser only if valid results demonstrate that extraction quality, rather than access or processing failure, is the remaining blocker.

## Decision requested

**Decision recorded:** The owner approved the bounded B2-D1 amendment on 2026-10-05. This authorizes exactly one changed private candidate build and one hosted run under the limits above. It does not authorize another diagnostic, corrective rerun, different extraction mechanism, or a change to product constraints. The TID amendment is recorded in `technical-investigation-design.md`; the Spike conclusion remains `Pending` until evidence supports otherwise.

**Checkpoint purpose:** This is the fresh owner checkpoint after the single B2-D1 run. The pre-run approval above has been fully exercised; the decision now is whether to stop at the new evidence boundary or direct preparation of a separate investigation.

## Product and Issue context

The product provides structured Google News results and aims to add real publisher links and optional readable article text. It must retain the original Google News URL, isolate row-level failures, and use a lightweight HTTP-first Actor. The publisher-link feature (Issue #4) and optional text feature (Issue #5) are blocked while their live feasibility is assessed by the controlling Spike (Issue #41).

## Why this Spike exists

Hosted redirects, publisher access and article-page structure cannot be reliably represented by local fixtures alone. The Spike separates link resolution, page access and text extraction so that a blocked page is not mistaken for a parser failure. Publisher-link resolution has met its tested 95/100 target, and page access yielded 53 eligible HTML rows, enough to attempt the 50/100 full-text target. The extraction experiment has not yet measured that target.

## What we have learned so far

- A normal hosted resolver flow produced 100 valid non-Google publisher URLs from the 100-row sample, retaining their Google News source URLs. This supports the tested sample, not universal future reachability.
- The publisher-page access sample retained 53 eligible HTML responses. Eighteen rows were denied by HTTP status. Twenty-nine other pages matched a text heuristic that may also match normal article text, so those are not confirmed denials.
- The first extraction candidate produced no dataset rows or text. The owner approved one instrumented run to establish how far the candidate progressed.
- That run passed the frozen-fixture hash and 100-row count checks, then stopped while opening the stored publisher-page results from the earlier run. It recorded a sanitized `ApifyApiError` classification but no error code or HTTP status. It processed no rows, read no key-value records, wrote no dataset items, and retained no extracted text. Apify nevertheless reported the run as successful with exit code zero. The underlying cause and extraction quality remain unknown.
- The Actor's normal entry point was already present and confirmed, so there was no clear invocation typo to correct. The one added diagnostic only recorded stages; it did not identify a supported corrective change.
- The diagnostic call used a 3,600-second effective timeout because the CLI default applied, while the approved bound was 900 seconds. It ended after 3.913 seconds, far below either limit. This deviation is recorded; the run will not be repeated.

## What we propose to do next

No further experiment is proposed from this evidence. The single approved diagnostic failed before cached HTML could be processed, so it does not demonstrate an access shortfall or an extraction-quality shortfall. The approved alternate-parser condition is not met. Continuing would require a newly designed investigation to establish storage access or another execution path, and the existing one-run TID amendment does not authorize that work.

## Direction and complexity check

The original product question remains unchanged, but the approved bounded sequence has reached its stop condition. The completed diagnostic added no architecture, infrastructure, dependencies, runtime, security mechanism or product scope. Any additional instrumentation or storage-access test would be a new troubleshooting direction with unknown cost and information value; no such work is authorized here.

## Recommendation

Stop active experimentation at this evidence boundary, keep the overall Spike conclusion `Pending`, and keep the full-text downstream Issue blocked. Do not run the alternate parser because extraction quality was never measured. Do not revise the TID without a supported next experiment or change product/architecture constraints because no such boundary was demonstrated. A new TID can be considered only if the owner separately requests more investigation with a fresh, bounded question and approval.

## Historical decision requested (superseded)

At the time this checkpoint was written, the decision was whether to remain paused or prepare a separate TID. B2-S1 was later separately approved and executed once. This historical checkpoint does not authorize any additional build, run, correction, parser change or access test.

## Historical post-S1 boundary and owner decision (2026-10-06; superseded by completed B2-P1)

### Issue context

Issue #41 asks whether the hosted Node.js 20 Apify Actor can resolve at least 95 of 100 representative Google News links to publisher URLs and produce readable article text for at least 50 of those 100 rows. The publisher-link feature (#4) and optional full-text feature (#5) remain blocked pending a supported Spike conclusion and reassessment. The product must retain the original Google News URL, isolate row failures, and remain lightweight and HTTP-first.

### Evidence as of S1 completion

- A4 resolved 100/100 rows to valid non-Google publisher URLs in the fixed sample, supporting only the tested sample.
- B1 retained 53 usable HTML responses, enough to attempt the 50/100 extraction target. Its 29 challenge-page exclusions remain a text heuristic, not confirmed denials.
- B2-D1 did not process cached HTML; its underlying cause remains unknown. Its prior-run source-store opening failure does not establish the cause of S1's later denial.
- The one approved B2-S1 run used the existing hosted Actor identity and attempted one metadata request to the B1 source KVS. That request returned HTTP 403 `insufficient-permissions`; the fixed record request was not attempted. No HTML was read and no extraction outcome was produced. The run failed visibly with exit code 1. See `experiments/b2-s1/b2-s1-run-metadata.json`, `b2-s1-run-log.txt`, and `b2-s1-results.json`.

### S1 interpretation and stop condition at that time

The S1 result supports only that this metadata request was denied for the current hosted identity. It does not show that the store or record is missing, that the cached body is unreadable, that publisher access failed, or that extraction quality is insufficient. S1's one-run approval is exhausted. Area B remains inconclusive, the overall Spike conclusion remains `Pending`, and no B3 parser experiment is justified.

### Recommendation and decision requested

Keep the Spike on hold. The owner may authorize preparation only of a separately scoped permission/access investigation design, or keep the Spike on hold without further work. Any future design must define its own bounded question and evidence requirements. This record authorizes no new live probe, permission/access grant, credential change, build, run, extraction work or continuation of B2. Publisher resolution remains supported for the tested sample; full-text viability remains unresolved.
