# Technical Spike: Automated news-site access capability and constraints

**Issue:** [#22](https://github.com/adunato/google-news-enriched-actor-poc/issues/22)

**Status:** Iteration 2 preparation in progress; the Spike remains open.

**Iteration result:** Inconclusive for the original Technical Question.

## Technical Question

What automated web-access approaches can this news POC/product family responsibly rely on to retrieve public publisher pages at useful reliability, and where are the practical technical, cost, operational, policy or legal boundaries that should cause the product to stop, degrade gracefully, or use a different data source?

## Context and scope

This first iteration tested the lowest-complexity baseline: public direct HTTP access to publisher pages. It did not test session state, browser execution, proxies, managed unblocking, paid APIs, or article-text extraction. The Product and Architecture boundaries remain unchanged.

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

**Result: Inconclusive.** Direct HTTP access is technically possible for a subset of the sampled public pages, while denials and robots signals require row-level classification and fail-soft behavior. The reduced local sample does not establish useful full-text reliability, hosted runtime behavior, or permission to access any publisher content. The broader access ladder and policy/legal boundaries remain unresolved.

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

## Downstream implications

- Keep Issue #5 blocked pending a supported access strategy and representative readable-text evidence.
- Do not promote this investigation's Google marker/RPC method, browser execution, proxy use, managed unblocking, or paid extraction into the product boundary.
- Proposed next hypothesis for owner review: repeat the direct HTTP baseline on a fresh 100-row stratified sample in the Apify Node 20 runtime, retaining the same request, robots, and privacy bounds; then separately assess readable-text signals and hosted cost. This requires valid Apify authentication and a decision to authorize the next Spike iteration.
- Issue #22 remains open. After the Spike reaches a supported conclusion and is integrated, reassess Issue #5 as specified in that Issue.

## Reproducibility

From `docs/changes/22/`, run `npm ci` and `node probe.mjs --refresh`. The script fetches a new 30-row cohort, records sanitized evidence in `local-results.json`, and removes its temporary URL-bearing input manifest. It uses `probe-network.mjs` for public-address validation, DNS pinning, redirects, timeouts, and bounded response prefixes. No hosted run was performed.

**Learning checkpoint:** None. This iteration produced no reusable cross-project lesson beyond its unresolved technical findings.
