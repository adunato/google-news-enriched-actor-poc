# Technical Spike: Automated news-site access capability and constraints

**Issue:** [#22](https://github.com/adunato/google-news-enriched-actor-poc/issues/22)

**Status:** Iteration 2 recorded; the Spike remains open.

**Iteration result:** Inconclusive for the original Technical Question.

## Technical Question

What automated web-access approaches can this news POC/product family responsibly rely on to retrieve public publisher pages at useful reliability, and where are the practical technical, cost, operational, policy or legal boundaries that should cause the product to stop, degrade gracefully, or use a different data source?

## Context and scope

The first two iterations tested the lowest-complexity baseline: public direct HTTP access to publisher pages, first locally and then in the target hosted runtime. They did not test session state, browser execution, proxies, managed unblocking, paid APIs, or readable full-text extraction. The Product and Architecture boundaries remain unchanged.

Issue #5 requires at least 50% readable full-text extraction on its representative 100-row sample. This iteration's article marker and headline signals do not measure readable text and cannot satisfy that acceptance criterion.

## Investigation

- Captured a fresh Google News RSS cohort on 2026-09-29: five broad queries (`world news`, `politics`, `business`, `technology`, `climate change`) across GB and US editions, three items per query/edition cell (30 total).
- Obtained candidate publisher destinations with the same Google marker/RPC approach used in prior Issues #14/#18. All 30 rows returned a syntactic candidate. This uses an undocumented Google endpoint as an investigation input; it is not a supported product contract.
- Probed candidates locally with Node.js 24.15.0 on Windows x64. Maximum concurrency was four; request timeout was 10 seconds; redirects were followed manually up to five; inspected HTML was capped at 256 KiB; public DNS answers were checked and pinned to the request; a 250 ms per-host request-start interval was applied.
- Sent an honest `GoogleNewsAccessSpike/0.1` user agent. Retrieved each publisher origin's `robots.txt` first; skipped a page when the matching path was disallowed or the robots signal was unavailable/truncated. A missing robots file was recorded separately.
- Kept input URLs in a temporary local manifest only. The script removes it after completion, including error handling. The retained row evidence contains publisher hostnames, response/status signals, and hashes; it contains no URLs, cookies, page bodies, or plaintext title values.

## Evidence

The completed run covered 30/30 rows and all ten query/edition cells (three rows per cell), with 21 distinct publisher hostnames. The probe window was `2026-09-29T14:45:12.875Z` to `2026-09-29T14:45:47.777Z` UTC.

| Observation                                       | Count |
| ------------------------------------------------- | ----: |
| Candidate publisher destinations                  | 30/30 |
| HTTP 200 HTML                                     | 19/30 |
| HTTP 403                                          |  4/30 |
| HTTP 451                                          |  1/30 |
| Skipped: robots unavailable                       |  4/30 |
| Skipped: robots disallowed                        |  2/30 |
| Robots file not found (page request proceeded)    |  1/30 |
| Article-like HTML marker                          | 19/30 |
| Headline identity heuristic matched               | 19/30 |
| Generic challenge/denial text heuristic signalled |  5/30 |

Robots outcomes are counted per row: 23 allowed, four unavailable, two disallowed, and one not found. The generic challenge/denial heuristic is not proof of a CAPTCHA or a particular access-control system. Article markers and headline matches are shallow page signals; neither establishes readable article text or content identity.

Publisher-stage elapsed time averaged 423.9 ms across rows (including robots-skipped rows, which can be near zero); maximum was 1,191 ms. Local resource cost is not a useful estimate of Apify hosted cost. No Apify run, hosted log, or hosted cost evidence was produced because the installed CLI had account metadata but no token in the environment or stored auth.

Sanitized row evidence is [`local-results.json`](local-results.json), SHA-256 `cb5f44ed758ed8c6d267d541f3ea9b8e0f9d11e1f0b707e7bb01c7fa616d34c5`. The fresh RSS row-array hash is `d56e23c8a266312e7ed5afd82643d18330caf2c52cad5708ff6754e50696e0d1`.

## Findings

- In this small local sample, bounded direct HTTP returned HTTP 200 HTML with an article-like marker for 19/30 rows. The remaining cases included publisher denials and rows skipped because robots access was disallowed or could not be established.
- Access varied across 21 hosts. Some public publisher pages were reachable under this probe's honest user agent; others denied access. This sample does not support a stable population-level success rate.
- Robots signals changed whether a request was made: two rows were disallowed and four were skipped because robots could not be retrieved or parsed safely. Terms of Service were not assessed in this iteration; no legal or contractual permission conclusion follows.
- The five generic challenge/denial signals need classification in a later iteration. No challenge solving, authentication, paywall access, or access-control bypass was attempted.
- The evidence distinguishes an HTTP response, an article-like marker, and a headline match. It does not establish readable full-text extraction, so the Issue #5 50% target remains untested.
- No Product or Architecture boundary change is supported by this iteration.

## Limitations and variability

- Thirty rows are an exploratory reduced sample, not the canonical 100-row capability sample. Three rows per cell provide little protection against query-result and publisher variability.
- Results are local to one network/runtime and one short UTC window. Apify Node 20 behavior, cost, memory, and hosted logs remain unmeasured.
- The candidate URLs were produced by Google's undocumented marker/RPC method. This iteration did not establish that method as a durable or approved resolver dependency.
- `robots.txt` handling was conservative for access: disallowed and unavailable/truncated signals stopped the publisher request. Robots rules are not a legal determination. Publisher Terms of Service and content-rights implications were not reviewed.
- Article-like and challenge/denial detection use bounded HTML prefixes and heuristics. No body was retained, and no article readability extraction was attempted.
- An earlier 100-row attempt with one-second pacing exceeded the practical run window and was stopped before sanitized results were written. Its raw transient input was removed. The completed 30-row sample uses a 250 ms per-host start interval; the interrupted attempt contributes no result counts.

## Conclusion

**Overall Spike result: Inconclusive.** Iterations 1 and 2 show that bounded direct HTTP can retrieve public HTML from a subset of sampled publisher pages, while denials and robots signals require row-level classification and fail-soft behavior. The 100-row hosted sample strengthens the target-runtime access baseline, but neither iteration measured readable full-text extraction. The broader access ladder and policy/legal boundaries remain unresolved; no permission conclusion follows.

## Iteration 2 plan — hosted direct-HTTP baseline

**Current understanding:** Iteration 1 observed mixed outcomes on 30 rows from 21 hosts on local Node 24. Direct HTTP returned 200 HTML for 19 rows; robots denials/unavailability and HTTP denials occurred. This is exploratory access evidence only: no readable-text extraction or permission conclusion was produced. Apify Node 20 runtime and hosted cost remain unknown.

**Investigation backlog (ordered):**

1. Measure the same bounded direct-HTTP access path from the target Apify Node 20 environment on a representative 100-row sample.
2. Classify the resulting access and robots outcomes by the ten query/edition cells and publisher host, without treating HTML markers as readable-text evidence.
3. Use the hosted baseline to select a later, separately approved test of session/state or browser requirements; defer proxies, managed unblocking, and paid data sources until their product and risk boundaries are explicitly reviewed.

**Selected hypothesis:** The 30-row local baseline may not represent the access outcomes from Apify's target network/runtime; a fresh 100-row cohort may expose materially different denial, robots, or transport rates.

**Why this is the next useful test:** It isolates hosted network/runtime effects while holding the access method and request controls constant. It gives later access-ladder tests a representative baseline without escalating to a heavier technique.

**Exact experiment:** Run one private disposable Actor build on Apify Node 20. During that single run, fetch a fresh Google News RSS cohort for five existing broad queries in GB and US editions, taking the first ten feed items from each of the ten cells (100 rows total). Resolve each Google News destination and probe publisher pages using the existing direct HTTP procedure. Keep concurrency at four, request timeout at 10 seconds, manual redirects at no more than five, publisher response prefix at 256 KiB, and 250 ms per-host request-start spacing. Apply the existing public-DNS validation/pinning and robots skip policy. Keep per-row failures isolated. The run must reject an incomplete 100-row cohort and must not retry the experiment automatically.

**Representative environment/data:** Apify Node 20 hosted runtime; current fresh public Google News feeds for `world news`, `politics`, `business`, `technology`, and `climate change`, each in GB/en-GB and US/en-US editions, ten rows per cell. The feed/RPC acquisition runs inside the Actor; no URL-bearing manifest is uploaded as input. The Google marker/RPC destination method remains an undocumented investigation input and is not asserted as a product contract.

**Expected evidence and interpretation:** Record exact Actor/build/run identity; Node/runtime and run settings; start/end time, total and per-cell row counts; candidate resolution outcomes; HTTP/robots/access-class counts; latency summary; dataset item count and sanitized dataset hash; platform usage cost and memory; and sanitized warning/error classes. Retain only publisher hostnames, row/cell identifiers, status/classification signals, and one-way hashes; do not retain URLs, titles, page bodies, cookies, or raw logs. HTML/article markers remain separate from readable-text evidence. Treat any meaningful local-versus-hosted rate change as a sample-specific observation, not a population success guarantee.

**Operational bounds and stop conditions:** The Actor remains private. Start exactly one run with Apify's server-enforced `maxTotalChargeUsd=1`, 256 MiB memory, and a 900-second timeout. If the API does not confirm that cost cap and run settings, do not start. Stop/abort on any cap/configuration mismatch, incomplete or URL-bearing persistence, unexpected paid service/proxy use, or a material access-control signal requiring a new decision. Do not retry a failed/incomplete run in this iteration. Delete the disposable hosted Actor and URL-bearing temporary stores after collecting the run's sanitized dataset and metadata; retain no raw logs or input. Do not claim the 50% readable-text criterion was measured.

**Owner checkpoint:** The user's request to examine Issue #22 and proceed with next steps authorizes this bounded Iteration 2 under the existing Spike scope. This checkpoint is limited to the stated direct-HTTP hosted baseline; any escalation to sessions, browser execution, proxy/network identity changes, managed unblocking, or paid APIs requires a new decision.

## Owner checkpoint — Iteration 1

**Recommended next iteration:** Iteration 2 — run the same bounded direct-HTTP baseline on a fresh stratified 100-row sample in the target Apify Node 20 runtime.

**Why this is next:** Iteration 1 established that direct HTTP sometimes works and exposed several failure classes, but it ran locally on a reduced 30-row sample. Before escalating to sessions, browser execution, proxies or managed unblocking, the Spike needs to know how much of the observed access behaviour changes simply because the workload runs from the intended hosted environment/network. This is the highest-value next discriminator and provides the representative baseline against which later access-ladder techniques should be compared.

**Prerequisite/blocker status:** A usable Apify API token was not available to the Iteration 1 executor.

- This **did not affect Iteration 1's completed local evidence**.
- It **does block the recommended hosted Iteration 2** because the target-runtime run cannot be launched without Apify authentication.
- This is currently an **ordinary execution prerequisite**, not evidence against the access hypothesis and not a Product/Architecture decision.
- Recovery: use the repository/workstation's supported Apify authentication path and verify the executor can launch a private hosted run before Iteration 2. If no usable credential can be obtained through the supported project setup, report that specific credential/setup problem and the exact owner action required; do not reinterpret it as a research result.

**Owner decision requested:** **Approve Iteration 2: 100-row hosted Apify direct-HTTP baseline, once the ordinary Apify-authentication prerequisite is satisfied.**

**If approved:** the executor should resolve/verify the ordinary authentication prerequisite, run only the approved hosted baseline with the existing bounded HTTP/robots/privacy controls, retain hosted outcome and cost evidence, update the access-failure classification, and stop at the next decision-ready checkpoint. It should not yet escalate to browser/proxy/unblocker techniques.

**If redirected/not approved:** the Spike remains unable to distinguish local-network behaviour from the target Apify runtime, so escalation-method comparisons would lack a reliable hosted baseline.

## Iteration 2 evidence and checkpoint

**Experiment:** One private disposable Actor run acquired a fresh 100-row cohort inside the Apify Node 20 runtime. It covered five queries across GB and US, ten rows in each of ten cells, and used the existing bounded direct-HTTP and robots procedure. The candidate resolver remains an undocumented Google marker/RPC investigation input, not a product contract.

**Environment and exact execution:** Apify Actor Node `v20.20.2`; Actor `557mC3yknShbfdUFj`, verified private and `LIMITED_PERMISSIONS`; build `VmbZa987nkwekkELF` / `0.2.1`; run `rs8Ld1Hbq48WKaPHi`; status `SUCCEEDED`, exit code 0. Run settings were 256 MiB, 900 seconds, restart disabled, and Apify server-enforced `maxTotalChargeUsd=1` (`isMaxTotalChargeUsdSetByUser=true`). Start `2026-09-29T16:31:21.109Z`; finish `2026-09-29T16:33:32.651Z`; elapsed `131.389` seconds. Platform usage was `$0.0025387885869575873` / `0.0091242361` compute units. Average memory was `72,294,011` bytes; peak `117,448,704` bytes. Average/peak CPU usage was `4.889` / `103.668`; received/sent network bytes were `34,023,567` / `893,821`.

The default dataset API returned 100 items from dataset `i0SFWOp2bDxXlTSiG`; every one of the ten cells contained ten items. There were 73 distinct publisher hosts. Sanitized downloaded dataset SHA-256: `b52c3db653ab34d0fcf64ff33bf22b494deb616b78b708551d423139c10ca0eb`. No raw URL/title/body fields or URL values were found in the dataset; the run log scan also found no URL values. No URL-bearing run input or manifest was uploaded or persisted. The private disposable Actor was deleted after evidence collection; the succeeded run and sanitized dataset remain available for audit. No raw logs, URLs, titles or page bodies were committed.

| Cell | Rows | HTTP 200 HTML | HTTP 403 | Robots unavailable | Robots disallowed | Robots not found | Article-like | Headline match |
| ---- | ---: | ------------: | ------: | -----------------: | ----------------: | --------------: | -----------: | -------------: |
| q1-gb | 10 | 6 | 1 | 2 | 1 | 1 | 6 | 6 |
| q1-us | 10 | 8 | 1 | 1 | 0 | 0 | 8 | 8 |
| q2-gb | 10 | 7 | 3 | 0 | 0 | 0 | 7 | 7 |
| q2-us | 10 | 6 | 2 | 1 | 1 | 0 | 6 | 5 |
| q3-gb | 10 | 7 | 2 | 1 | 0 | 3 | 5 | 7 |
| q3-us | 10 | 6 | 2 | 0 | 2 | 0 | 6 | 5 |
| q4-gb | 10 | 9 | 0 | 1 | 0 | 0 | 8 | 8 |
| q4-us | 10 | 7 | 0 | 2 | 1 | 1 | 7 | 7 |
| q5-gb | 10 | 7 | 1 | 2 | 0 | 0 | 7 | 7 |
| q5-us | 10 | 9 | 1 | 0 | 0 | 0 | 9 | 9 |

**Aggregate observations:** All 100 rows resolved to a candidate publisher destination. Access outcomes were HTTP 200 HTML `72/100`, HTTP 403 `13/100`, robots unavailable/skipped `10/100`, and robots disallowed/skipped `5/100`. Five robots files were not found and those page requests proceeded. Robots totals were 80 allowed, 10 unavailable, five disallowed, and five not found. Sixty-nine rows had an article-like HTML marker; 70 matched the headline identity heuristic; 68 met the combined strict marker-and-identity signal. A generic challenge/denial heuristic signalled 29 rows; this is not proof of CAPTCHA or a particular access-control system. These signals do not establish readable article text.

**Iteration result:** `Inconclusive` for the selected local-versus-hosted comparison and the original Technical Question. The hosted run supports that direct HTTP retrieves HTML for a subset of this sample, but the local and hosted cohorts differ in size and selection, so their rates are not a controlled comparison. It does not establish population reliability, readable-text success, or access permission. No retry was run. No Product/Architecture boundary change is supported.

**Current understanding:** The target Apify runtime can resolve all 100 selected Google News destinations and retrieve HTTP 200 HTML for 72 sampled rows under the approved direct-HTTP bounds. Denials and robots-unavailable/disallowed outcomes remain material and must fail soft per row. Robots-not-found is distinct from unavailable/disallowed and was treated as a proceed signal in five rows. HTTP status, article-like marker, and headline match remain separate observations. No content was retained to assess readable extraction.

**Recommended next decision:** Option A - authorize bounded candidate-method selection/evaluation within Issue #22's direct-HTTP investigation. This is recommended because Issue #22's broader completion criteria remain open, and Iteration 2 did not measure readable text. No extraction method, algorithm, or dependency is currently approved for Issue #5.

**Why this is next:** The hosted baseline established access and identity signals only. It cannot answer whether a method can produce readable text at Issue #5's required rate. A fresh sample is required because no HTML or article text was retained. Candidate selection can remain a Spike investigation, but any dependency must be explicitly approved before a hosted run uses it.

**Prerequisite/blocker status:** No blocker affected Iteration 2. Option A requires an owner decision on bounded candidate-method selection and explicit dependency approval before any hosted run using a newly selected dependency. This is a scope/dependency decision, not a platform-authentication problem. No extraction method should be described as already approved.

**Owner decision requested:** Choose one path:

- **Option A (recommended):** authorize bounded candidate-method selection/evaluation within #22's direct-HTTP Spike; decide on any proposed dependency before a hosted run.
- **Option B:** if the owner judges #22's access investigation sufficient, stop further access investigation and route readability-method selection to Issue #5's design. Current evidence does not meet Issue #22's broader completion criteria, so this option does not itself support closing #22 or claiming a Feasible/Not feasible conclusion. Keep the Spike open unless its criteria are met or the owner explicitly changes/stops the original required outcome.

**Consequence of Option A:** prepare a bounded candidate evaluation, obtain dependency approval before any hosted run, and return with evidence at the next checkpoint. **Consequence of Option B:** move readability-method selection to Issue #5 design while Issue #22 remains open/inconclusive until its own criteria are met or explicitly revised. No new run is authorized by this checkpoint alone.

## Downstream implications

- Keep Issue #5 blocked pending a supported access strategy and representative readable-text evidence.
- Do not promote this investigation's Google marker/RPC method, browser execution, proxy use, managed unblocking, or paid extraction into the product boundary.
- Proposed next hypothesis for owner review: repeat the direct HTTP baseline on a fresh 100-row stratified sample in the Apify Node 20 runtime, retaining the same request, robots, and privacy bounds; then separately assess readable-text signals and hosted cost. This requires valid Apify authentication and a decision to authorize the next Spike iteration.
- Issue #22 remains open. After the Spike reaches a supported conclusion and is integrated, reassess Issue #5 as specified in that Issue.

## Reproducibility

From `docs/changes/22/`, run `npm ci` and `node probe.mjs --refresh`. The script fetches a new 30-row cohort, records sanitized evidence in `local-results.json`, and removes its temporary URL-bearing input manifest. It uses `probe-network.mjs` for public-address validation, DNS pinning, redirects, timeouts, and bounded response prefixes. No hosted run was performed.

**Learning checkpoint:** None. This iteration produced no reusable cross-project lesson beyond its unresolved technical findings.
