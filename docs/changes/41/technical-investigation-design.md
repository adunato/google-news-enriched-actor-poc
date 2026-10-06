# Technical Investigation Design: Google News publisher resolution and full-text viability

> Design for Technical Spike [**Prove Google News publisher resolution and full-text viability (#41)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/41).  
> This document defines what must be tested, why each experiment exists, what it measures, and exactly when it should run. It is not an experiment log.

**Artifact ID:** `tid-41-google-news-resolution-full-text`  
**Status:** `Approved`  
**Owner:** `Project owner`  
**Created:** `2026-10-04`  
**Updated:** `2026-10-06`
**GitHub Spike Issue:** `Prove Google News publisher resolution and full-text viability (#41)`  
**Spike branch:** `spike/41-google-news-resolution-full-text`  
**Blocked downstream Issues:** `Resolve Google News links to publisher URLs with fail-soft status (#4)`; `Add optional best-effort article full-text extraction (#5)`

**Current design decision:** Area B was reset on **2026-10-06** to a vanilla single-run publisher fetch → extraction → row-output flow. The prior cross-run cached-HTML/KVS diagnostic route is superseded.

## 1. What this investigation is trying to achieve

Two product capabilities depend on live external behaviour.

### Resolve Google News links to publisher URLs

The publisher-resolution feature must convert Google News article links into valid non-Google publisher URLs for at least **95 of the defined 100 representative rows**, while preserving the original Google News URL and keeping failures isolated to individual rows.

The repository already contains a publisher-resolution mechanism. The unresolved question is whether the normal hosted HTTP path can reach and use that mechanism reliably enough in production-like conditions.

### Retrieve readable publisher article text

The full-text feature must return readable article text for at least **50 of the defined 100 representative retained rows**.

The unresolved questions are whether enough publisher pages are accessible to the hosted Actor and, for pages that are accessible, whether a simple generic Node-based extraction path can produce readable text often enough.

These are separate investigation areas because failure to reach a publisher page is not the same problem as failure to extract readable text from HTML that was successfully fetched.

---

## 2. Investigation Area A — Reach and prove the Google News publisher resolver

### Objective

Establish the ordinary hosted HTTP/session behaviour required for the Apify Actor to reach the existing Google News publisher-resolution mechanism, then verify the complete publisher-URL capability against the **95/100** live acceptance target.

### Existing evidence and why this area is needed

- The repository contains an existing Google News resolution mechanism capable of producing non-Google publisher destinations.
- Hosted Google News requests can be redirected to a consent endpoint before the resolver is reached.
- It is not yet established whether that behaviour is immediate, changes across repeated requests in one hosted execution/session, or can be handled with ordinary HTTP/session behaviour.

### Success criteria for this investigation area

This area succeeds only when the production-like hosted flow:

1. reaches the existing resolver using the approved lightweight HTTP-first architecture;
2. preserves the original Google News URL and keeps failures row-local; and
3. resolves at least **95/100** rows in the defined live representative sample to valid non-Google publisher URLs.

If reaching the resolver requires browser automation, proxy/unblocking infrastructure, a second runtime/service, or another excluded architecture change, stop and return that boundary rather than silently adopting it.

### Experiment sequence

<!-- prettier-ignore -->
| Order | ID | Experiment | Purpose | Run when | Next if successful | Next if unsuccessful |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 | Reproduce and characterise hosted Google News access | Establish the current baseline and test whether access changes across repeated requests from one hosted execution/session | **Always first** | A4 | A2 |
| 2 | A2 | Test minimal ordinary session/consent handling | Determine whether normal redirects, cookies and session state are sufficient to reach the existing resolver | **Only if A1 does not provide a stable path to the resolver** | A4 | A3 only if evidence points to local request/session construction; otherwise stop |
| 3 | A3 | Compare request construction with an independent implementation | Determine whether the remaining failure is caused by our own request/session construction | **Only if A2 fails and evidence indicates a likely local implementation problem** | A4 | Stop / return boundary decision |
| 4 | A4 | Run the publisher-URL acceptance sample | Prove the actual 95/100 product capability | **Only after A1, A2 or A3 establishes a stable path to the resolver** | Area A feasible | Failed acceptance; diagnose before any new run |

The table is the controlling procedural view for this area. Detailed experiment sections below explain each experiment; they do not change the sequence or trigger rules above.

### Experiment A1 — Reproduce and characterise hosted Google News access

**Objective**  
Establish exactly what happens when the hosted Actor accesses known Google News article URLs, and test whether behaviour changes as multiple requests are made from the same hosted execution/session.

**Why this experiment exists**  
The current uncertainty is at the access layer before publisher resolution. Before changing the resolver or adding session logic, establish whether consent/interstitial behaviour is immediate, appears only after repeated requests, changes with session state, or is not currently reproducible.

**Test**  
Use a small fixed set of known-good Google News article controls in one normal Apify Node 20 Actor run.

Execute a bounded ordered sequence:

1. request one known-good article immediately after startup;
2. request several additional known-good articles sequentially from the same hosted execution/session;
3. repeat one of the earlier article requests near the end of the sequence.

For every attempt, record request number, HTTP status, redirect destination, ordinary cookie/session state, and whether the response reaches the page state needed for publisher resolution. Where the runtime exposes it safely and reliably, also record whether outbound network identity remains the same across the sequence.

**Measures**

- request number and sequence position;
- HTTP status and redirect destination;
- session/cookie state;
- first request number, if any, at which a consent redirect appears;
- whether behaviour changes between initial and later/repeated requests;
- whether the Google News page state required by the existing resolver is reached;
- whether resolver execution becomes possible;
- total request count and elapsed time.

**Execution rule**  
**Always run first.**

**Decision / next step**

- If the normal path consistently reaches the existing resolver, skip A2 and A3 and proceed directly to **A4**.
- If consent/interstitial behaviour is reproduced or access is unstable, proceed to **A2**.
- If the result reveals a materially different access boundary, stop and revise the TID rather than inventing a new experiment.

### Experiment A2 — Test minimal ordinary session/consent handling

**Objective**  
Determine whether standard HTTP behaviour — redirects, cookies and ordinary session state — is sufficient to pass the access boundary and reach the existing resolver.

**Why this experiment exists**  
If A1 shows that ordinary stateless requests do not provide a stable route, the next bounded question is whether normal session handling is sufficient without changing architecture.

**Test**  
Using the same small control set, enable only ordinary HTTP/session behaviour supported by the existing runtime: standard redirect handling, cookie persistence and session continuity.

Do not introduce browser automation, proxy/unblocking services, custom egress/security machinery, alternate runtimes or a different resolver.

**Measures**

- whether the consent/interstitial boundary is passed;
- whether the resolver input page state is reached;
- whether cookies/session state materially change the result;
- request count, redirects and elapsed time.

**Execution rule**  
Run **only if A1 does not provide a stable path to the resolver**.

**Decision / next step**

- If ordinary session handling establishes a stable resolver path, proceed to **A4**.
- If it fails and evidence specifically indicates a likely defect in our request/session construction, proceed to **A3**.
- Otherwise stop Area A and return the demonstrated access boundary.

### Experiment A3 — Compare request construction with an independent implementation

**Objective**  
Determine whether the remaining failure is caused by our own request/session construction rather than the external access boundary.

**Why this experiment exists**  
A3 only has value if A2 produces evidence that the problem is likely local to how requests are constructed or sessions are maintained.

**Test**  
Compare the current request/session construction with one credible maintained independent implementation of the same ordinary HTTP access pattern.

Identify only material differences relevant to the observed failure and test one evidence-backed corrective change.

Do not perform broad library shopping and do not change the underlying publisher-resolution mechanism.

**Measures**

- material request/session differences;
- effect of the one corrective change;
- whether controls then reach the existing resolver;
- request count and elapsed time.

**Execution rule**  
Run **only if A2 fails and evidence indicates a likely local request/session-construction problem**.

**Decision / next step**

- If the corrective change establishes a stable resolver path, proceed to **A4**.
- If it does not, stop Area A. Any further change of mechanism requires a new design decision.

### Experiment A4 — Run the publisher-URL acceptance sample

**Objective**  
Verify the actual product capability: at least **95 of the defined 100 representative Google News rows** must resolve to valid non-Google publisher URLs.

**Why this experiment exists**  
Small controls can establish that the resolver is reachable, but they cannot prove the product acceptance target.

**Test**  
Run the existing publisher-resolution flow against the defined 100-row GB/US representative sample using the access/session behaviour established by A1, A2 or A3.

Preserve the original Google News URL and classify every failed row explicitly.

**Measures**

- valid non-Google publisher URLs out of 100;
- failure count and failure classes;
- row isolation/fail-soft behaviour;
- runtime and material request/cost observations.

**Execution rule**  
Run **only after a small-control experiment has established a stable production-like path to the resolver**.

**Decision / next step**

- **95/100 or better:** Investigation Area A is feasible.
- **Below 95/100:** this is a failed acceptance result. Do not rerun unchanged. Diagnose the observed failure and return to TID review if a new experiment is required.

---

## 3. Investigation Area B — Retrieve readable publisher article text

### Objective

Establish whether the normal lightweight hosted Actor flow can fetch public publisher pages and extract readable article text for at least **50/100** rows in the representative mixed-publisher sample.

### Current evidence

- Area A is supported: A4 resolved 100/100 rows in the frozen representative sample to valid non-Google publisher URLs.
- B1 previously fetched 53/100 rows as usable publisher HTML, so the sample has already shown enough live publisher access to make the 50/100 target plausible.
- The first B2 candidate and its later B2-D1/B2-S1/B2-P1 diagnostics did **not** produce extraction-quality evidence.
- The HTTP 403 observed during B2-S1 occurred while a later Actor run tried to inspect a prior run's B1 key-value store. That cross-run storage access was introduced only to isolate the experiment stages; it is **not part of the intended application flow** and is not evidence that the normal fetch/extract product flow fails.

### Design correction approved 2026-10-06

The active Area B route is reset to mirror the production architecture as directly as possible.

The application is one hosted Actor. When full text is requested and a resolved publisher URL is available, that Actor should:

1. fetch the publisher URL over ordinary bounded HTTP;
2. pass the returned HTML directly to structured-data extraction / Mozilla Readability in the **same run**;
3. record the fetch and extraction outcomes separately for that row; and
4. write the enriched row to the normal dataset.

Do **not** use prior-run cached HTML, cross-run KVS access, permission/grant investigation, alternate account identity, Console access, custom storage harnesses or equivalent diagnostic infrastructure for the active B2 route.

The earlier cache-based B2-D1/B2-S1/B2-P1 path is retained only as historical evidence in `technical-spike.md`. It is superseded and must not be continued.

### Success criteria for this investigation area

At least **50/100** rows in the defined representative sample must produce non-empty readable article text with a consistent success status and word count.

Failures must remain row-local. For every row, evidence must distinguish:

- publisher fetch failure;
- successful HTML fetch followed by extraction failure;
- successful extraction;
- output/write failure if one occurs.

This separation is achieved through normal per-row evidence in one Actor run; it does not require separate hosted runs.

### Active experiment sequence

<!-- prettier-ignore -->
| Order | Experiment | Purpose | Run when | Next if successful | Next if unsuccessful |
| --- | --- | --- | --- | --- | --- |
| 1 | B1 — publisher-page access baseline | Historical live evidence that the sample can expose enough usable publisher HTML | **Completed** | Supports B2 | Historical only; do not reopen its cache |
| 2 | B2 smoke test — vanilla end-to-end flow | Prove that the normal hosted fetch → extract → row-write path executes and identify the actual failing business stage if it does not | **Completed 2026-10-06; gate passed independent review** | B2 acceptance sample (completed) | Diagnose only the observed normal-flow stage; stop if continuing requires special harnessing |
| 3 | B2 acceptance sample — vanilla end-to-end flow | Measure the actual >=50/100 full-text product target | **Completed 2026-10-06; Inconclusive / incomplete partial run** | Area B feasible only after a completed run and independent >=50/100 readable-text review | Current Hold; proposed B2-M1 requires separate explicit owner approval |
| 4 | B3 — one alternative generic Node-native extractor | Determine whether a measured extraction-quality shortfall is specific to the primary parser | **Not eligible from current partial evidence** | Area B feasible | Stop / return extraction or architecture limitation |

### B2 smoke test — vanilla hosted end-to-end flow

**Question**

Can the normal hosted Actor perform the same operation the product is expected to perform: fetch a resolved publisher URL, extract readable text from that response, and write a row?

**Test**

Use a very small deterministic set of publisher URLs from the existing representative sample that B1 previously classified as usable HTML. Use only the publisher URLs and row provenance from retained repository evidence; **do not read the old B1 HTML bodies or B1 KVS at runtime**.

The smoke sample is the first three B1-eligible rows in the retained sample order: `q1-gb-01`, `q1-gb-02` and `q1-gb-05`. The acceptance sample is the complete frozen 100-row A4 sample, with every original occurrence retained and no deduplication. Both runs use the same ordinary fetch/extraction/output implementation and Node.js 20 Actor identity.

For each smoke-test row, in one normal Actor execution:

1. start row processing;
2. perform the ordinary bounded publisher HTTP fetch;
3. if eligible HTML is returned, immediately run the existing structured-data / Mozilla Readability extraction path on that in-memory response;
4. emit the row-level fetch status, extraction status, word count when applicable and any safe failure class;
5. write the row to the normal dataset.

**Common bounds:** Run four rows concurrently. Each row's complete HTTP redirect/fetch/body-read chain has a 10-second timeout, a 2 MiB response-body maximum and at most five redirects after its initial request (six HTTP GETs maximum per row). The three-row smoke therefore makes at most 18 publisher GETs; the 100-row acceptance run makes at most 600. Allocate 256 MiB and explicitly set a 900-second Actor timeout for each hosted run. Do not request Google News or other sources during B2. Each run records actual platform usage. A full 900-second allocation models about 0.0625 compute units (about $0.0125 at the Free/Starter $0.20/CU standard rate shown in [Apify pricing](https://apify.com/pricing)), but this is not an all-in cap or guaranteed charge because account rates, bandwidth, build, storage and API costs may vary.

Use ordinary stage logging only: row start, fetch result, extraction result and row-write result. Do not introduce a diagnostic subsystem.

**Smoke-test success**

The smoke test succeeds when the Actor processes the complete small sample without a run-level infrastructure failure, emits a row outcome for every input, and demonstrates that successfully fetched HTML can reach the extraction stage and normal row output.

Individual publisher fetch or extraction failures are valid row evidence and do not make the Actor execution itself a failure.

**If the smoke test fails**

Diagnose the failure only at the normal business-flow stage actually observed:

- before row processing → Actor entrypoint/configuration;
- during ordinary publisher HTTP fetch → publisher-fetch path;
- after fetch succeeds but during parsing/extraction → extraction path;
- after extraction but before row output → normal dataset/output path.

A simple mechanical defect in that normal path may be corrected and the smoke test repeated. If progress requires cross-run storage access, permission/grant investigation, special credentials, custom network/storage harnessing, another runtime or another diagnostic mechanism that the product itself would not use, stop and return to the owner rather than building that machinery.

### B2 acceptance sample — vanilla hosted end-to-end flow

**Objective**

Measure the actual product capability using the production-like flow rather than replaying cached HTML.

**Test**

Run the same fetch → extract → row-write path against the defined 100-row representative sample.

For each row with a resolved publisher URL:

1. perform the bounded ordinary HTTP publisher fetch;
2. classify the fetch outcome;
3. when eligible HTML is returned, immediately attempt structured article data and then Mozilla Readability on that response;
4. classify extraction independently from fetch;
5. emit the normal row result, preserving the original Google News URL and resolved publisher URL.

Do not persist or reopen publisher HTML between Actor runs merely to separate the measurements.

**Measures**

- successful readable-text rows out of the full 100-row sample;
- successful publisher HTML fetches out of 100;
- readable-text successes out of successfully fetched eligible HTML;
- structured-data successes versus Readability successes;
- fetch and extraction failure classes;
- row-output completeness;
- runtime and material cost.

**Decision / next step**

- **>=50/100 readable rows:** Investigation Area B is feasible.
- **<50/100 mainly because publisher pages cannot be fetched:** return the publisher-access limitation; do not change extractor.
- **Enough HTML is fetched to make 50/100 possible but extraction quality is the demonstrated blocker:** B3 becomes eligible.
- **Run-level failure in the normal flow:** diagnose only the observed business stage under the smoke-test rule above.

### B3 — Test one alternative generic Node-native extractor

B3 remains unchanged in purpose: it is eligible only after valid B2 acceptance evidence demonstrates that extraction quality on successfully fetched HTML, rather than publisher access or run infrastructure, is the remaining blocker.

Use one credible generic Node-native extractor with a materially different parsing approach against the same normal fetch/extract flow. Do not add publisher-specific rules, another runtime/service or special hosted infrastructure.

If the supported path reaches at least **50/100**, Area B is feasible. Otherwise stop and return the demonstrated extraction or architecture limitation.

### Superseded diagnostic route

The cache-replay B2 candidate and the B2-D1, B2-S1 and B2-P1 investigations are historical only. They established that the experimental cross-run storage mechanism itself encountered execution/access friction, including one HTTP 403 `insufficient-permissions` response. They did **not** measure text-extraction quality and they do not establish a product-flow access limitation.

No further work on that cross-run cache/permission route is authorized by this TID.

## 4. Constraints that apply to every experiment

- one TypeScript/Node.js 20 Apify Actor;
- normal Apify runtime/SDK path;
- HTTP-first access;
- bounded requests, redirects, timeouts, response sizes and concurrency;
- row-level fail-soft behaviour;
- original Google News URL retained as provenance/fallback;
- no browser automation/rendering;
- no residential proxies or managed unblocking;
- no paid extraction/news APIs;
- no paywall bypass or private/authenticated content access;
- no publisher-specific heavy extraction infrastructure;
- no second runtime/service unless explicitly approved;
- no custom network-security harness introduced merely to make an experiment run;
- no silent weakening of the **95/100** publisher-URL or **50/100** readable-full-text targets.

A straightforward mechanical correction inside an approved experiment is allowed when it does not change what is being tested or what the evidence would mean.

If troubleshooting becomes a different technical investigation, introduces new machinery, or changes the experiment's purpose, stop and revise/review the TID before continuing.

---

## 5. Evidence and decision rules

Each experiment must make it possible to answer:

1. What were we trying to establish?
2. Why was this experiment necessary?
3. What happened, using understandable measures?
4. What does that result mechanically cause us to do next?

Reuse valid repository evidence where it remains directly applicable, but current hosted behaviour must be measured where the product claim depends on it.

Synthetic/local tests may prove mechanics but cannot replace required representative live/in-environment evidence.

A failed required acceptance run remains a failed result for that code/configuration. Do not rerun it unchanged merely to seek a different outcome.

---

## 6. Investigation completion

The Spike concludes **Feasible** only when both product capabilities are supported within the approved architecture:

- publisher URL resolution achieves at least **95/100** valid non-Google publisher URLs on the defined live sample;
- full-text extraction achieves at least **50/100** readable-text successes on the defined representative sample.

If either target cannot be met without crossing an approved Product/Architecture boundary, the Spike must identify the exact blocking constraint and the decision required to continue.

After the final Spike evidence is integrated, Issues #4 and #5 must be reassessed before downstream design or implementation resumes.

## 7. Open design questions

The current vanilla Area B question and conditional route were approved and have been executed. The 100-row acceptance run ended after partial processing and did not establish a completed acceptance result or its termination cause. The older B2-D1, B2-S1 and B2-P1 cache/permission diagnostics are superseded and their individual authorizations are exhausted; they do not govern the current B2 candidate or change the extraction acceptance target. A proposed single memory-only follow-up, B2-M1, is recorded below and is **not approved**.

## 8. Review and approval

**Decision:** `Approve` the original bounded experiment sequence and its conditional transitions. The owner separately approved the 2026-10-06 Area B mainstream-flow reset and the current B2 smoke → conditional 100-row acceptance route within the bounds above.

**Rationale:** The design directly covers the two blocked product capabilities, separates access from extraction, defines all bounded experiments and conditional routing, and preserves the approved lightweight architecture.

**Required follow-up before execution:** None for the original Area B route; its smoke and acceptance steps have been run. B2-M1 below is a separate, proposed amendment and has no execution authority unless the owner explicitly approves it.

The original approval authorises only the bounded experiment sequence and its conditional transitions. B2-D1, B2-S1 and B2-P1 were separately approved under superseded diagnostic designs and are complete/exhausted. The current Area B reset replaces those cache-replay routes with ordinary same-run publisher fetch, in-memory extraction and default-dataset output. No prior-run KVS access, permissions work, alternate credentials, special harness or B2-D1 diagnostic instrumentation is part of the current route.

**Owner approval:** Original bounded sequence approved — 2026-10-04. B2-D1 approved — 2026-10-05 and exhausted. B2-S1 and B2-P1 approved — 2026-10-06 and exhausted. The current vanilla Area B reset and B2 smoke → conditional 100-row acceptance route were approved — 2026-10-06 under the bounds recorded in Area B.

## Proposed amendment B2-M1 — one higher-memory acceptance run (2026-10-06; NOT APPROVED)

**Status:** Preparation only. This amendment is proposed and awaits explicit owner approval. It changes no existing approval or experiment evidence and authorizes no hosted action while pending.

### Issue and investigation context

Issue #41 asks whether the approved Node.js 20 Apify Actor can resolve at least 95/100 representative Google News rows to publisher URLs and produce readable article text for at least 50/100 rows. A4 supports the publisher-resolution target on the fixed sample. The Area B vanilla smoke gate passed independent review. The one approved 100-row vanilla acceptance run used build `s7Np4qeIg5sXxAdti` and the frozen 100-row input (`100` unique row IDs, `95` unique publisher URLs, five repeated URL occurrences retained), but ended `FAILED` after partial processing: 10 dataset rows and 11 fetch requests were logged before `SIGKILL`. The failure cause is undetermined; proximity to 256 MiB is observed evidence, not a confirmed out-of-memory diagnosis. The run did not establish a complete 50/100 result and does not make B3 eligible. Area B and the overall Spike remain on Hold/Pending.

### Question and hypothesis

Would running the unchanged vanilla 100-row acceptance candidate with 512 MiB allow the normal fetch → in-memory extraction → default-dataset flow to complete and produce reviewable acceptance evidence? The memory-limit hypothesis is plausible but unconfirmed. This experiment changes only the run memory allocation; it does not add diagnostics or alter the tested application flow.

### Proposed bounded method

If and only if the owner explicitly approves B2-M1, perform exactly **one** hosted run of the existing private Actor `JIogcgdHyCqAMHQ1P` using the already-built exact build `s7Np4qeIg5sXxAdti` / version `0.8.1` / tag `issue41-b2-vanilla`. Do not rebuild or change source, dependencies, input, actor identity, or runtime. Use the existing frozen acceptance fixture with SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`; it contains all 100 original row occurrences, 100 unique row IDs, and 95 unique publisher URLs.

Change only configured memory from 256 MiB to **512 MiB**. Keep the 900-second Actor timeout, concurrency 4, 10-second per-row HTTP chain timeout, 2 MiB body maximum, five redirects after the initial request (maximum six GETs per row), existing Node.js 20 runtime and pinned parser packages. The run uses ordinary publisher HTTP, same-response extraction and the default dataset; no Google News fetches, prior-run cache/KVS access, new build, new credentials, permission changes, browser, proxy, other runtime, or diagnostic instrumentation.

### Evidence and routing

Retain the exact build/run IDs, frozen input hash, actual configured resources, platform status/exit code, duration, final usage, observed peak memory, total and row-level fetch outcomes/HTTP statuses/request counts, extraction outcomes/methods/word counts/text hashes, dataset completeness, and sanitized stage log. Keep complete article text and HTML out of Git; retain reviewable article text only in the private/ignored hosted dataset. Independently assess text quality against the full 100-row denominator; nonempty output, word count, or a success flag alone does not establish readability.

- If the run completes and at least 50 rows contain coherent readable article text on independent review, Area B is supported for this sample.
- If it completes but fewer than 50 rows are fetchable as eligible HTML, classify the observed access evidence and stop; do not call the result a final product-feasibility conclusion solely from this run.
- B3 is eligible only if a completed run provides at least 50 accessible HTML rows and independent evidence shows extraction quality is the remaining blocker, under the existing TID B3 condition.
- If the run fails or is incomplete, classify B2-M1 as Inconclusive, preserve the failure evidence, and stop. No second run, rebuild, source correction, memory increase, diagnostic expansion, or B3 follows this amendment.

At 512 MiB for the full 900-second allocation, compute is modeled at 0.125 CU / approximately `$0.025` using the previously cited `$0.20/CU` standard rate. This is a compute-only estimate, not a guaranteed total or enforced spend cap; actual account rates, bandwidth, storage, build/API usage and run duration may change total charges. Record actual platform usage.

**Approval request:** The owner may approve or decline exactly the single B2-M1 run described above. Until explicit approval is recorded, the Spike remains on Hold/Pending and no build, run, or other execution is authorized by this proposal.
