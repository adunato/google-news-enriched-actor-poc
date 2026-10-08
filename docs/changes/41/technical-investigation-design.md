# Technical Investigation Design: Google News publisher resolution and full-text viability

> Design for Technical Spike [**Prove Google News publisher resolution and full-text viability (#41)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/41).  
> This document defines what must be tested, why each experiment exists, what it measures, and exactly when it should run. It is not an experiment log.

**Artifact ID:** `tid-41-google-news-resolution-full-text`  
**Status:** Original sequence and B2-R3 approved; B2-R3a Inconclusive / Hold; B2-R3b not eligible; B2-R4 executed once and TIMED-OUT / Inconclusive / Hold; R5 completed valid read-only assessment with mechanism unresolved / Hold; R6 original build attempt ABORTED; separately approved additional build succeeded with Node 20.20.2 / Undici 6.24.1 and offline observer gate PASS; its sole conditional run ABORTED after initial privacy/access verification failed; R6 Inconclusive / Hold and approved build/run authority consumed; one additional run-only attempt on exact verified build is DRAFT / NOT APPROVED.
**Owner:** `Project owner`  
**Created:** `2026-10-04`  
**Updated:** `2026-10-07`
**GitHub Spike Issue:** `Prove Google News publisher resolution and full-text viability (#41)`  
**Spike branch:** `spike/41-google-news-resolution-full-text`  
**Blocked downstream Issues:** `Resolve Google News links to publisher URLs with fail-soft status (#4)`; `Add optional best-effort article full-text extraction (#5)`

**Current design decision:** Area B remains Inconclusive / Hold. R3a did not meet its reproduction gate and R3b is ineligible. R4 timed out after 97/100 dataset rows, with finite application-level pending-read observations and no run summary; no root cause or readability conclusion follows. R5 source assessment did not identify which private abort path ran. R6 first build attempt was prematurely aborted by locale-sensitive monitoring. Its separately approved additional build, jTISNSBR4pHb0R70e / 0.10.6, succeeded and passed the exact Node 20.20.2 / Undici 6.24.1 runtime probe and offline observer gate. The single conditional run b66C26fuXBDubmxM2 was aborted because initial run access remained FOLLOW_USER_SETTING after an incorrect isPublic payload; a correct RESTRICTED update was confirmed only after terminal status. It wrote zero dataset rows and yielded no marker evidence. R6 is Inconclusive / Hold; the approved sequence is consumed. Another run-only attempt against the exact verified build is proposed separately and remains unapproved. Issue targets and downstream status are unchanged.

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
| 3 | B2 acceptance sample — vanilla end-to-end flow | Measure the actual >=50/100 full-text product target | **Completed 2026-10-06; B2-M2 Inconclusive / incomplete (platform timeout at 899.778s; 99/100 rows written); B2-M1 Invalid-bound / Inconclusive** | Area B feasible only after a completed run and independent >=50/100 readable-text review | Current Hold; B2-M2's one-run approval is exhausted. No below-50 result or B3 eligibility is established |
| 4 | B2-F1 — bounded publisher HTTP-stage logging | Locate the last observed stage for the row that had no fetch result, without changing HTTP or extraction behavior | **Completed 2026-10-06; failed after 48/100 outputs** | Record same-run evidence; no automatic next experiment | Inconclusive / Hold; prior missing-row condition not reproduced, no retry, source correction or further diagnostics |
| 5 | B2-M3 — bounded memory-stage snapshots | Observe memory at row and processing-stage boundaries after B2-F1 ended with SIGKILL, without changing fetch, parsing, cleanup, or output behavior | **Completed 2026-10-06; valid partial execution, TIMED-OUT at 899.861s after 99/100 rows** | No normal completion; readable-text target was not assessed | Inconclusive / Hold; approval exhausted, no retry or further diagnostic |
| 6 | B2-R1 — local Node 20 abort/read-settlement check | Determine whether a pending response-body read settles after the existing Node 20 `AbortSignal.timeout` fires on a loopback response | **Superseded; never approved or executed** | Superseded by B2-R2; no local test | No R1 execution authority |
| 7 | B2-R2 — hosted body-read settlement observation | Observe actual read/stream settlement after abort on the vanilla hosted path | **Completed 2026-10-07; timed out at 899.854s with 98/100 rows** | Inconclusive / Hold; no acceptance target assessed | Approval exhausted; no retry or further diagnostic; Spike remains open |
| 8 | B2-R3a — actual-helper seam and reproduction gate | Extract the real bounded body reader without behavior change and establish whether a controlled unfinished HTTP body can reproduce the post-abort pending-read condition at that seam | **Executed 2026-10-07 under Node.js 20; controls passed, reproduction gate not met; Inconclusive / Hold** | B2-R3b only if the unchanged helper remains pending through the local watchdog while normal/bound controls pass | Stop / Hold; reproduction gate not met |
| 9 | B2-R3b — bounded pending-read containment and acceptance | Make the existing 10-second HTTP abort capable of releasing a pending body read, prove bounded cleanup/continuation locally, then run one normal frozen 100-row hosted acceptance if all local and build gates pass | **Not eligible — R3a reproduction gate not met** | Completed 100-row run routes to independent readability scoring and the existing Area B/B3 rules | R3a stop rule applies; no containment, build, hosted run or further diagnostic under this amendment |
| 10 | B3 — one alternative generic Node-native extractor | Determine whether a measured extraction-quality shortfall is specific to the primary parser | **Not eligible from current evidence** | Area B feasible only after the target is supported | Stop / return extraction or architecture limitation |
| 11 | B2-R4 — hosted body-read diagnosis | Determine whether the post-abort body-read symptom recurs on a verified R2-lineage Node 20 hosted candidate, and where row progress stops | **Owner approved and executed once 2026-10-07; run TIMED-OUT at 899.757 seconds; Inconclusive / Hold; authority exhausted** | Three rows showed pending reads at finite snapshots; two had timer-delay flags; no final summary; no root cause or product conclusion | Inconclusive / Hold; no retry or deeper probe without a new approved TID |
| 12 | B2-R5 — exact-runtime abort/body-settlement source assessment | Assess whether exact Node 20.20.2 / Undici 6.24.1 source supports the locked-stream cancel-rejection hypothesis, without attributing it as R4's cause | **Owner approved and validly completed 2026-10-07 17:45:07 UTC; mechanism unresolved; Inconclusive / Hold** | Read-only source trace only; no direct public passive discriminator found for the internal transition | Keep Area B Inconclusive / Hold; no hosted replay or further probe authorized |
| 13 | B2-R6 — dependent abort-signal bridge observation | Determine whether the Actor signal propagates to the dependent signal for the fetch attempt whose HTML body read is pending | **First build attempt ABORTED; separately approved additional build SUCCEEDED with Node 20.20.2 / Undici 6.24.1 and offline observer gate PASS; sole conditional run ABORTED after initial access verification failed; Inconclusive / Hold; approved sequence consumed** | No publisher diagnostic evidence; one further run-only attempt on the exact verified build is DRAFT / NOT APPROVED / NOT EXECUTED and requires same-ID RESTRICTED readback before any publisher request | Observe only the source-to-dependent signal bridge; the executed run did not pass the access gate and establishes no runtime/body-read result or root cause |

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

The current vanilla Area B question and conditional route were approved and have been executed through B2-R4. The original 256-MiB 100-row acceptance run ended after partial processing and did not establish a completed acceptance result or its termination cause. The older B2-D1, B2-S1 and B2-P1 cache/permission diagnostics are superseded and their individual authorizations are exhausted; they do not govern the current B2 candidate or change the extraction acceptance target. B2-M1 was invalid-bound because the run used 256 MiB; its 512-MiB hypothesis was not tested. B2-M2 timed out after 99 rows at 899.778 seconds. B2-F1 failed after 48 rows; its prior missing-row condition was not reproduced, and its 49 dataset-observed requests are not a run-wide total. B2-M3 timed out after 99 rows at 899.861 seconds. B2-R1 was never approved or executed and was superseded by B2-R2. B2-R2 was approved and executed once: its exact build/resource gates passed, but the run timed out at 899.854 seconds after 98/100 rows, with no run summary. It is Inconclusive / Hold; body-read/stream settlement remains unobserved for the two missing rows, and neither the 50/100 target nor a below-target result is established. B2-R3 was approved on 2026-10-07; R3a then ran once under Node.js 20 and is Inconclusive / Hold because its reproduction gate was not met. R3b is not eligible. The owner approved B2-R4 on 2026-10-07; its one approved build succeeded and its one hosted run timed out after 899.757 seconds. R4 is Inconclusive / Hold; three rows had pending reads at finite snapshots, two crossed timer-delay flags, and no final summary was emitted. This does not establish persistence to termination, global completeness, cause or product outcome. The R4 authority is exhausted; Area B remains On Hold.

## 8. Review and approval

**Decision:** `Approve` the original bounded experiment sequence and its conditional transitions. The owner separately approved the 2026-10-06 Area B mainstream-flow reset and the current B2 smoke → conditional 100-row acceptance route within the bounds above. On 2026-10-07, the owner separately approved the B2-R2 instrumentation-only build and one conditional frozen-100 run, subject to local integrity and exact-build gates; that approval is exhausted. The owner also approved the B2-R3 conditional sequence on 2026-10-07; R3a ran once and reached Inconclusive / Hold, so R3b is ineligible. The owner approved the complete B2-R4 diagnostic TID on 2026-10-07; its one monitored build and one conditional run were executed once, and the run is Inconclusive / Hold. That R4 execution authority is exhausted.

**Rationale:** The design directly covers the two blocked product capabilities, separates access from extraction, defines all bounded experiments and conditional routing, and preserves the approved lightweight architecture.

**Execution follow-up (updated 2026-10-07):** B2-M1, M2, F1, and M3 approvals are exhausted as recorded in their amendments and evidence. M3 timed out at 899.861 seconds after 99 rows; its missing-row cause remains unknown. B2-R1 was never approved or executed. B2-R2 was approved, built, exact-build verified, and run once. It timed out at 899.854 seconds after 98/100 rows; no run summary was emitted. The two missing rows, q3-us-02 and q4-gb-02, each reached a post-abort snapshot with a body read still in flight and reader.closed pending; neither had later settlement or row-output markers. q3-us-01 did not acquire a reader, so its pending readerClosedState is only an initialization placeholder. The run is Inconclusive / Hold; the 50/100 target is unassessed, no below-target result or B3 eligibility is established, and R2 approval is exhausted. The owner approved B2-R3 on 2026-10-07. R3a controls passed under Node.js 20, but the unfinished-response helper had rejected by the approximately two-second watchdog observation; classify R3a Inconclusive / Hold, with R3b ineligible. The owner approved R4 on 2026-10-07; its single approved build and conditional run were executed. The run timed out after 899.757 seconds with 97/100 rows and is Inconclusive / Hold; the R4 build/run authority is exhausted. The original product threshold and B3 condition are unchanged.

The original approval authorises only the bounded experiment sequence and its conditional transitions. B2-D1, B2-S1 and B2-P1 were separately approved under superseded diagnostic designs and are complete/exhausted. The current Area B reset replaces those cache-replay routes with ordinary same-run publisher fetch, in-memory extraction and default-dataset output. No prior-run KVS access, permissions work, alternate credentials, special harness or B2-D1 diagnostic instrumentation is part of the current route. B2-M2's separately approved single build/run has also been consumed; its incomplete timeout does not authorize a retry or establish B3 eligibility.

**Owner approval:** Original bounded sequence approved — 2026-10-04. B2-D1 approved — 2026-10-05 and exhausted. B2-S1 and B2-P1 approved — 2026-10-06 and exhausted. The current vanilla Area B reset and B2 smoke → conditional 100-row acceptance route were approved — 2026-10-06 under the bounds recorded in Area B. B2-M1, M2, F1, and M3 were separately approved and exercised once; all are exhausted and their outcomes remain Inconclusive / Hold as recorded below. B2-R1 was never approved or executed. The owner explicitly approved B2-R2 on 2026-10-07 for exactly one instrumentation-only candidate build and one conditional frozen-100 run after local and exact-build gates. That run has completed as Inconclusive / Hold and exhausted the approval. The owner then approved the B2-R3 conditional sequence on 2026-10-07; R3a ran once and reached Inconclusive / Hold, so R3b is not eligible. On 2026-10-07, the owner explicitly approved the complete B2-R4 TID by replying “approved. go ahead.” The approval authorizes the specified preparation, one monitored build attempt, and only if all gates pass one private hosted run with the run-only API cap. Candidate preparation and independent semantics review preceded one approved build and one conditional run. The run TIMED-OUT and is Inconclusive / Hold; the R4 build/run approval is exhausted. Detailed evidence is recorded in the Spike execution section.

## Amendment B2-M1 — one higher-memory acceptance run (approved 2026-10-06)

**Approval record:** This was prepared first as an unapproved proposal. On 2026-10-06, the user explicitly replied “ok” to the request to approve exactly the single run specified here. Approval covered one same-build, same-input hosted run requesting 512 MiB only. The one-run approval has been exercised; it authorizes no rebuild, retry, source correction, second run or diagnostic expansion. The observed actual memory was 256 MiB, so the 512-MiB hypothesis was not tested.

### Issue and investigation context

Issue #41 asks whether the approved Node.js 20 Apify Actor can resolve at least 95/100 representative Google News rows to publisher URLs and produce readable article text for at least 50/100 rows. A4 supports the publisher-resolution target on the fixed sample. The Area B vanilla smoke gate passed independent review. The B2-M1 run used build `s7Np4qeIg5sXxAdti` and the frozen 100-row input (`100` unique row IDs, `95` unique publisher URLs, five repeated URL occurrences retained). Although 512 MiB was requested, run metadata and the startup log both record actual memory as 256 MiB. The run ended `FAILED` with exit code 1 after partial processing: 9 dataset rows were written from 10 publisher GETs (9 eligible HTML responses and one HTTP 403); 13 rows started and 87 did not. The run lasted 7.660 seconds and reported `$0.0002176187299274736` usage. The parameter mismatch cause is undetermined. This is invalid-bound / Inconclusive; the 512-MiB hypothesis was not tested, and the run neither establishes the 50/100 result nor makes B3 eligible. Area B and the overall Spike remain on Hold/Pending.

### Question and hypothesis

Would running the unchanged vanilla 100-row acceptance candidate with 512 MiB allow the normal fetch → in-memory extraction → default-dataset flow to complete and produce reviewable acceptance evidence? The memory-limit hypothesis is plausible but unconfirmed. This experiment changes only the run memory allocation; it does not add diagnostics or alter the tested application flow.

### Approved bounded method (run completed; actual-bound mismatch recorded below)

The owner approved and the operator made exactly **one** hosted call of the existing private Actor `JIogcgdHyCqAMHQ1P` using build `s7Np4qeIg5sXxAdti` / version `0.8.1` / tag `issue41-b2-vanilla`. The sanitized invocation requested `--memory 512 --timeout 900` against the unchanged frozen acceptance fixture with SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01` (100 original row occurrences, 100 unique row IDs, 95 unique publisher URLs). No build, source, dependency, input, actor identity, or runtime change was made.

The requested run setting changed only memory from 256 MiB to **512 MiB**. The request retained the 900-second Actor timeout, concurrency 4, 10-second per-row HTTP chain timeout, 2 MiB body maximum, five redirects after the initial request (maximum six GETs per row), existing Node.js 20 runtime and pinned parser packages. The actual run metadata and startup log both report 256 MiB and 900 seconds. No Google News fetches, prior-run cache/KVS access, new build, new credentials, permission changes, browser, proxy, other runtime, or diagnostic instrumentation were used.

### Evidence and routing

Retain the exact build/run IDs, frozen input hash, actual configured resources, platform status/exit code, duration, final usage, observed peak memory, total and row-level fetch outcomes/HTTP statuses/request counts, extraction outcomes/methods/word counts/text hashes, dataset completeness, and sanitized stage log. Keep complete article text and HTML out of Git; retain reviewable article text only in the private/ignored hosted dataset. Independently assess text quality against the full 100-row denominator; nonempty output, word count, or a success flag alone does not establish readability.

- If the run completes and at least 50 rows contain coherent readable article text on independent review, Area B is supported for this sample.
- If it completes but fewer than 50 rows are fetchable as eligible HTML, classify the observed access evidence and stop; do not call the result a final product-feasibility conclusion solely from this run.
- B3 is eligible only if a completed run provides at least 50 accessible HTML rows and independent evidence shows extraction quality is the remaining blocker, under the existing TID B3 condition.
- The B2-M1 run is classified **Invalid-bound / Inconclusive** because actual memory was 256 MiB rather than the requested 512 MiB. The approved 512-MiB hypothesis was not tested; do not treat this result as evidence for or against that hypothesis, and do not infer why the memory setting differed. Preserve the failure evidence and stop. No second run, rebuild, source correction, memory increase, diagnostic expansion, or B3 follows this amendment.

At 512 MiB for the full 900-second allocation, compute is modeled at 0.125 CU / approximately `$0.025` using the previously cited `$0.20/CU` standard rate. This is a compute-only estimate, not a guaranteed total or enforced spend cap; actual account rates, bandwidth, storage, build/API usage and run duration may change total charges. Record actual platform usage.

**Execution result (2026-10-06):** The sanitized CLI invocation requested `--memory 512 --timeout 900`; CLI version was `apify-cli/1.10.0 (d227b1f)`, and its help describes `--memory` as the amount of memory allocated in megabytes. The command exited `1`, but run `68bftskIZe5eABnuO` / dataset `gvwkEaUKCsnDPCONo` exists and used exact build `s7Np4qeIg5sXxAdti` with the approved input hash. Run metadata and the `run_start` stage log both report actual 256 MiB; timeout was 900 seconds. Read-only exact-build metadata confirms the deployed definition sets default memory to 256 MiB and min/max memory to 256 MiB; see `experiments/b2-vanilla/build-definition-b2-m1.json`. This confirms the exact build's 256-MiB maximum, but not which component handled the CLI request or why the observed setting was selected. The run status was `FAILED`, exit code `1`, duration `7.660` seconds, observed peak memory `215339008` bytes, and reported final usage `$0.0002176187299274736`. The hosted log ends with `npm error signal SIGKILL`; this is an observed log marker, not a confirmed cause. The dataset has 9 rows; stage evidence records 13 row starts, 10 publisher GETs (9 eligible HTTP 200 and one HTTP 403), 10 extraction outcomes (9 successes and one ineligible-fetch skip), 9 writes, and 87 input rows without a row start. No CLI stderr/warning text was retained. See `experiments/b2-vanilla/results-b2-m1.json`, `run-metadata-b2-m1.json`, and ignored `private/b2-m1-run-log.txt`. The component-level handling of the requested memory setting and the termination cause remain unestablished; no further runtime action was taken.

**Execution boundary:** B2-M1's one-run approval is exercised and exhausted. Its result is **Invalid-bound / Inconclusive**: the approved 512-MiB hypothesis was not tested. Preserve the evidence and stop; any further action requires a separate owner decision. The overall Spike remains Pending and Area B remains on Hold until the original full-text question is resolved.

## Amendment B2-M2 — configuration-only 512-MiB candidate (approved 2026-10-06)

**Approval record:** The proposal was pending until the user replied “Okay, go ahead” on 2026-10-06 after receiving the bounded configuration-only change and exact-build verification gate. Approval covers one candidate build and, only if build metadata passes, one 100-row hosted run. It does not authorize a retry, second build, source/dependency/input change, or alternate troubleshooting direction.

### Issue context and evidence boundary

Issue #41 asks whether one ordinary Node.js 20 Actor run can resolve publisher pages and produce independently readable article text for at least 50 of the frozen 100 rows. The vanilla smoke passed, but the 100-row acceptance run was incomplete. B2-M1 requested 512 MiB on the unchanged build, while same-run evidence reported 256 MiB. Read-only metadata for exact build `s7Np4qeIg5sXxAdti` confirms its deployed `actorDefinition` sets `defaultRunOptions.memoryMbytes=256`, `minMemoryMbytes=256`, and `maxMemoryMbytes=256`; the recorded 512-MiB hypothesis therefore was not tested. The underlying CLI/platform request-handling behavior remains unknown. The actual deployed definition is preserved in `experiments/b2-vanilla/build-definition-b2-m1.json`. Area B remains on Hold; neither a below-50 result nor B3 eligibility is established.

### Question

Would the unchanged normal fetch → in-memory extraction → default-dataset flow complete if one new build explicitly permits and defaults to 512 MiB, followed by one run explicitly requesting 512 MiB?

### Bounded proposed method

With the owner approval now recorded, make a **configuration-only** change to the isolated Actor definition `experiments/b2-vanilla/actor/.actor/actor.json`: set `defaultRunOptions.memoryMbytes`, `minMemoryMbytes`, and `maxMemoryMbytes` to 512; keep `defaultRunOptions.timeoutSecs` at 900. Set candidate identity to Actor definition version `0.9` and tag `issue41-b2-m2-512`. Do not change `main.mjs`, helpers, `package.json`, `package-lock.json`, runtime, parser behavior, input, or any fixture/hash. Record a pre-build digest check showing the entrypoint, helpers, dependency files, and frozen input remain identical. Build exactly one candidate; no rebuild or other configuration change is in scope.

Before making any publisher request, obtain read-only metadata for that exact new build and verify its actor ID and actor definition report default/min/max memory all 512 MiB and timeout 900 seconds. If any field is missing or mismatches, stop without calling the Actor. If verified, perform exactly one run of that build with the frozen `input-acceptance.json` (SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`; 100 unique row IDs, 95 distinct publisher URLs, five duplicate URL occurrences retained), explicitly requesting memory 512 MiB and timeout 900 seconds. Verify run metadata reports the intended build, input and actual 512-MiB/900-second resources before classifying evidence. If actual run memory is not 512 MiB, classify invalid-bound / Inconclusive and stop; do not retry.

Keep concurrency four, 10-second per-row HTTP-chain timeout, 2 MiB response-body limit, five redirects after the initial request (maximum six GETs per row), ordinary publisher HTTP, same-response extraction and default dataset. Make no Google News requests, do not use prior-run cache/KVS, and do not add diagnostics, dependencies, credentials, permissions, browser/proxy mechanisms or another runtime. Retain sanitized run/build/input/resource/status/exit/duration/usage/peak-memory/fetch/extraction/dataset evidence. Full article text remains private/ignored and is independently reviewed against all 100 rows.

### Scoring and stop conditions

- A completed normal run must exit successfully and account for all 100 original rows before acceptance scoring. At least 50 independently reviewed coherent article texts supports the tested target; counts and nonempty text alone do not prove readability.
- If fewer than 50 rows yield eligible HTML, classify the observed access evidence and stop; do not infer a final product-feasibility result solely from this run.
- B3 is eligible only after a valid completed run provides at least 50 eligible HTML responses and independent evidence establishes extraction quality as the remaining blocker.
- Any build verification mismatch, failed/incomplete run, or actual-memory mismatch is Inconclusive and stops this amendment. No retry, rebuild, resource ladder, code/dependency change, diagnostic extension or B3 follows.

At 512 MiB for the full 900-second allocation, compute models to 0.125 CU / approximately `$0.025` at the previously cited `$0.20/CU` standard rate. This is compute-only, not a guaranteed total or spending cap; actual account rates, transfer, build, storage and API charges may differ. Record actual hosted usage.

**Approval boundary:** B2-M2 was approved for exactly one configuration-only Actor definition change, one candidate build, and one hosted run only after the build-definition gate passed. The build gate and one conditional run have both completed; the run timed out after 99 rows. The owner did not approve retries or additional experiments. This approval is exhausted. All prior evidence and the consumed B2-M1 approval remain unchanged. The Spike stays open with Area B on Hold and conclusion Pending; see the B2-M2 result in `technical-spike.md` and `experiments/b2-vanilla/run-metadata-b2-m2.json`.

**Candidate build and pre-request gate (historical, 2026-10-06):** The single approved candidate build succeeded as `RAwgvVrKuREgjFr2D` / `0.9.1`, tag `issue41-b2-m2-512`. Read-only metadata for that exact build verifies Actor `JIogcgdHyCqAMHQ1P`, Actor definition version `0.9`, default/min/max memory `512` MiB and timeout `900` seconds. See `experiments/b2-vanilla/build-definition-b2-m2.json`. The gate was confirmed and the conditional run was executed; it timed out at 899.778 seconds with 99 dataset rows. See `experiments/b2-vanilla/run-metadata-b2-m2.json` and the current execution record in `technical-spike.md`.

## Amendment B2-F1 — bounded publisher HTTP-stage logging (approved 2026-10-06)

**Approval:** The user replied “ok go ahead” on 2026-10-06 to the self-contained bounded checkpoint. This authorizes exactly one logging-only source candidate build and, only after exact-build verification, one 100-row run. It does not authorize further diagnosis, retries, source fixes, or a change to the original acceptance target.

**Current status:** The one approved build and conditional run have been executed and are exhausted. The factual outcome is recorded in the execution result below and in `technical-spike.md`; no further action follows automatically from this amendment.

**Issue context and question:** Issue #41 asks whether the ordinary Node.js 20 Actor can provide readable article text for at least 50 of the fixed 100 representative rows. The latest approved B2-M2 run passed its exact 512-MiB/900-second build and run-resource gates but timed out at 899.778 seconds after 99 rows were written. The pending row `q2-gb-10` has only a `row_start` marker and no fetch result; the run-wide HTTP request count is unknown. The proposed question is whether bounded markers around the existing HTTP request lifecycle can show where row progress stopped without changing request, abort, cleanup, extraction, or output behavior.

**Approved experiment scope:** Change only `experiments/b2-vanilla/actor/main.mjs` to add nonthrowing markers for `request_start`, `await_fetch`, `response`, `redirect`, `body_read`, `cancel`, `abort_fired`, `catch`, and `cleanup`. Record row ID, stage, elapsed time, request and redirect counts, HTTP status, normalized MIME, body-byte count, error class, and error code when available. An abort observer may be attached once and removed only if doing so preserves existing behavior. Logging or cleanup failures must not mask the original result/error. Never log URLs, redirect locations, raw headers, credentials, tokens, response bodies, extracted text, or raw error messages.

All other source, dependencies, parser, actor configuration, runtime, and frozen input remain unchanged. Use the same Actor `JIogcgdHyCqAMHQ1P`, the exact acceptance fixture SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01` (100 unique row IDs, 95 distinct publisher URLs, five repeated URL occurrences), 512-MiB memory, and 900-second timeout. Preserve concurrency four, 10-second HTTP-chain timeout, 2 MiB response-body cap, five redirects after the initial request, and the existing design maximum of 600 publisher GETs. Before any publisher request, verify that only the approved logging change differs and that the exact build embeds the correct Actor identity and 512-MiB default/min/max with a 900-second timeout. A build mismatch stops without a run.

If approved and the build gate passes, execute exactly one frozen 100-row run. Distinguish request totals observed on the 99 dataset rows from the missing row and the run-wide total; do not infer an unobserved request count. A failed/incomplete run remains `Inconclusive / Hold`, with no retry, corrective source work, or further diagnostic direction. Only a normal completed 100-row run proceeds to independent review of every counted article; at least 50 coherent readable texts supports the tested target. B3 remains conditional on at least 50 eligible HTML rows and independent evidence that extraction quality is the remaining blocker. No Google News requests, prior-run cache, browser, proxy, grants, new credentials, dependencies, runtime, or product changes are included.

The 900-second 512-MiB compute estimate is 0.125 CU / approximately `$0.025` at the previously referenced `$0.20/CU` standard rate. This is compute-only, not a guaranteed total or spending cap; record actual hosted usage. The approved build/run remain subject to the local candidate and exact-build metadata gates; no additional owner approval is required within this single bounded route.

**Execution result (2026-10-06):** The single build succeeded as `atE5VAJGFJrkEIxcc` / `0.10.1`, version `0.10`, tag `issue41-b2-f1`. Exact build metadata confirms Actor `JIogcgdHyCqAMHQ1P`, embedded min/default/max memory `512` MiB, timeout `900` seconds, and `main.mjs` SHA-256 `1c8902808cfd11833d83ca6d3b3147cade68c4c5cfe14a9fc3fa72c67ddc57f7`. The one run `JN325UzL4IFpdnTMR` used the frozen input and actual `512` MiB / `900` seconds, then failed with exit code 1 after 34.444 seconds. It wrote 48/100 rows: 36 eligible HTML and extraction successes, 12 HTTP-denied; those rows sum to 49 publisher requests. The stage log separately contains 53 `request_start` and 51 `response` markers, but no complete run summary, so the run-wide on-wire request count is unknown. The retained stage log shows `q2-gb-10` completing response, body read, cleanup, extraction and dataset write. The last observed concurrent events were `q3-gb-10` response 200 and body-read start, and `q3-us-02` request start / await-fetch; there is no body-read completion for `q3-gb-10` or run summary. The platform log records `SIGKILL`, but that alone does not establish OOM or instrumentation causality. This is a valid partial execution with an Inconclusive result; it does not establish the 50/100 target, an access-limited conclusion, or B3 eligibility. The F1 diagnostic objective is Inconclusive because the prior missing-row condition was not reproduced; no further diagnostic direction is authorized. See `experiments/b2-vanilla/build-definition-b2-f1.json`, `run-metadata-b2-f1.json`, and `results-b2-f1.json`; ignored same-run full dataset and sanitized stage log are under `experiments/b2-vanilla/private/`.

## Amendment B2-M3 — bounded stage memory snapshots (approved 2026-10-06)

**Approval and execution:** The user explicitly replied “Okay, go ahead” on 2026-10-06 to the self-contained B2-M3 checkpoint, authorizing exactly one memory-observability build and conditional run subject to local diff/hash and exact-build gates. The initial CLI request for version `0.11` was rejected before build creation because the Actor was at its version limit; it created no build and consumed no publisher requests. The same approved build then succeeded as `SMDOTSyU2SjIeivha` / `0.10.2` under existing version `0.10` and unique tag `issue41-b2-m3`, preserving the F1 build/tag mapping. Exact source and 512-MiB / 900-second metadata passed. The one approved run used that exact build and frozen input, then timed out at 899.861 seconds with 99/100 rows. Its valid partial result is Inconclusive / Hold, and the approval is exhausted. No version, build, or tag deletion, source correction, retry, memory increase, or further diagnostic direction is authorized.

**Issue context and question:** Issue #41's 50/100 readable-text acceptance result remains unresolved. B2-M2 ended at 99/100 rows with no completion summary. B2-F1 completed only 48/100 rows and logged `SIGKILL`; its peak reported memory was 510,668,800 bytes under a 512-MiB allocation. The prior missing row completed in F1, so that specific stall was not reproduced. Memory pressure is a hypothesis, not an established cause. The bounded question is whether nonthrowing memory snapshots at existing row and processing boundaries reveal a useful memory trend while the ordinary same-run fetch → extraction → row-output flow runs.

**Single approved experiment:** Create one isolated candidate build and run the same frozen 100-row input once on Actor `JIogcgdHyCqAMHQ1P`, with 512 MiB and 900 seconds, after local and internal readiness gates pass. Change only the isolated `experiments/b2-vanilla/actor/main.mjs` to add nonthrowing snapshots from native `process.memoryUsage()` at row start/end and immediately before/after fetch, JSDOM construction, structured-data extraction, Readability extraction, and DOM close. Preserve the existing B2-F1 HTTP-stage markers. Do not change transport, redirects, abort/cancel handling, body limits, parsing, output, packages or package lock, Actor settings, schema, helper, fixture, dependency/runtime versions, or concurrency.

Keep all existing bounds: concurrency four, 10-second HTTP-chain timeout, 2 MiB response-body cap, at most five redirects after the initial request, and a maximum of 600 planned publisher GETs over the 100-row fixture (100 unique row IDs, 95 URLs, five repeated occurrences). The 512-MiB memory and 900-second timeout must pass both pre-run exact-build metadata verification and actual run metadata verification. Before building, verify the source diff contains only the specified observation points and that the Actor, dependencies, helper, schema, fixture, hashes, and HTTP behaviour/bounds are unchanged. Before any publisher request, verify the exact build has the expected Actor and embedded 512-MiB default/min/max and 900-second timeout; mismatch stops without a run.

Log only row ID, stage, elapsed time, and numeric `rss`, `heapUsed`, `external`, and `arrayBuffers` values. Logging must be nonthrowing and must not change any existing request, parser, abort, cleanup, or dataset behavior. Never log URLs, headers, response bodies, extracted text, credentials, tokens, or raw errors. Retain exact build/run metadata, memory snapshots, sanitized normal stage log, dataset outcomes, and actual duration/usage/cost. Keep full article text only in the private/ignored same-run dataset.

**Evidence limits and routing:** Stage-boundary snapshots cannot observe memory while an awaited network operation is hung and cannot by themselves prove OOM causality. Four concurrent workers also limit attribution of process-wide memory to any single row. The experiment may therefore remain Inconclusive even if the run terminates again. Execute exactly one build and one run after internal readiness review, then stop. A failed or incomplete run remains Inconclusive / Hold and authorizes no fix, retry, memory increase, or further diagnostic. Only a normal 100-row completion proceeds to independent review of every counted text; at least 50 coherent readable texts supports the target. B3 remains conditional on at least 50 eligible HTML rows and independent evidence that extraction quality is the blocker. No Google News requests, prior-run cache, browser, proxy, grants, new credentials, dependencies, runtime, or product changes are included.

At 512 MiB for 900 seconds, the compute estimate is 0.125 CU / approximately `$0.025` at the previously cited `$0.20/CU` standard rate. This is compute-only, not a guaranteed total or spending cap; account rates and transfer, build, storage, and API charges may differ. The candidate source and focused local checks are unchanged. After the initial version `0.11` request was rejected before build creation, the approved build succeeded as `SMDOTSyU2SjIeivha` / `0.10.2` under version `0.10` and tag `issue41-b2-m3`. Exact metadata confirms the source SHA and min/default/max 512 MiB / timeout 900 seconds, while preserving the F1 tag mapping. The one approved run then timed out at 899.861 seconds with 99/100 dataset rows. The 99 retained rows show 62 eligible HTML, 16 HTTP-denied, one request error, and 20 timeout; extraction statuses are 61 success candidates, one no-readable-text candidate, and 37 not attempted. These are not independently validated readable articles, and no >=50/100 target claim follows. Missing row `q3-us-01` logged request start, await-fetch, HTTP 200 `text/html`, body-read start, then `abort_fired` about 15.5 seconds after row start. No body-read completion, cancellation, catch/error, cleanup, fetch result, extraction, or row-write marker followed. Its memory snapshots ended at `fetch_after` (rss 248,152,064; heapUsed 152,317,104; external 8,525,163; arrayBuffers 4,914,400). Platform peak memory was 368,906,240 bytes; this does not establish OOM or another termination cause. Actual reported usage was `$0.025723639751517115` (0.12498069444444444 compute units). The run is a valid partial execution with an Inconclusive result; Area B remains Hold, no B3 eligibility is established, and the one-run approval is exhausted. Exact metadata, results, and sanitized marker evidence are in `experiments/b2-vanilla/build-definition-b2-m3.json`, `run-metadata-b2-m3.json`, `results-b2-m3.json`, `memory-snapshots-b2-m3.json`, and `sanitized-stage-evidence-b2-m3.json`; the private dataset remains ignored.

## Proposed amendment B2-R1 — local Node 20 abort/read-settlement check (superseded; not approved)

**Status:** This proposal was never approved or executed. On 2026-10-07 it was superseded by the more direct hosted-path B2-R2 proposal below. Do not create or run the R1 test.

**Issue context and question:** The 50/100 readable-text target for Issue #41 remains unresolved. B2-M3 timed out after 99 rows. Its missing row `q3-us-01` received HTTP 200 `text/html`, entered body reading, then logged `abort_fired`; no body-read completion, rejection, cancellation, cleanup, row result, or run summary was retained. That observation does not identify the cause. The narrow local question is whether the existing Node 20 fetch/Undici implementation settles a pending response-body read after `AbortSignal.timeout()` fires. A result would test this runtime primitive only, not establish B2-M3's cause or the Actor's full-text feasibility.

**Proposed single local check:** Use only already-installed Node `v20.19.0`, built-in `node:test` and `node:http`, and that Node runtime's bundled Undici. Record the exact `process.version` and `process.versions.undici` first; if Node 20 or the bundled implementation is unavailable, stop without installing or downloading anything. Start one loopback HTTP server and make one local fetch. The server returns HTTP 200 and one fixed non-article chunk, then leaves the next stream read pending. The client uses the Actor's `AbortSignal.timeout(1_000)`, consumes the first chunk, then observes whether the next `reader.read()` settles or rejects within 2,000 ms after abort. Keep setup at or below 1 second, bound all cleanup to at most 15 seconds and to the time remaining before a 19-second deadline, and enforce a 20-second outer test timeout. Use no article text and log no body content.

**Evidence and stop rules:** Retain exact local Node/Undici versions, the configured and observed abort timing, whether the pending read settled, its settlement/rejection latency and error class/code where available, and cleanup outcome. If setup, abort, observation, or cleanup exceeds its bound, mark the check Inconclusive and stop. Whether the read settles or remains pending, stop after this one local check and return for a separate owner decision. Do not infer that the result proves or disproves an M3 cause. No publisher or Google News requests, internet access, Apify API, Actor entrypoint change, hosted build/run, new dependency, installation, credential, permission, source fix, or automatic follow-up experiment is included. This proposal does not change the exhausted M3 approval, Area B Hold, or B3 eligibility.

## Amendment B2-R2 — observe the hosted body-read settlement path (approved 2026-10-07)

**Approval:** On 2026-10-07, the owner explicitly approved exactly one instrumentation-only candidate build and one conditional hosted run as specified below. The approval does not authorize a source fix, retry, resource change, additional experiment, or B3. B2-R1 remains superseded, never approved or executed.

**Question:** In the ordinary hosted fetch → extraction → row-output flow, after a request aborts, does the actual response-body read or stream settle, or does later handling prevent a row outcome? The primary focus is the prior missing row `q3-us-01`; the frozen 100-row run preserves the representative execution context, while other-row counts are supporting context only. The question is limited to locating the observed boundary; it does not assume that M3's missing row had a particular cause.

**Approved single hosted observation (executed once):** Make one instrumentation-only candidate and one run of the frozen 100-row sample on Actor `JIogcgdHyCqAMHQ1P`, using existing version `0.10` with a unique next patch/tag. Preserve every prior version, build, and tag mapping; delete none. Keep the existing actor/helper, dependencies, schema, and fixture unchanged. Keep memory at 512 MiB, timeout at 900 seconds, concurrency at four, the 10-second HTTP-chain limit, 2 MiB response-body cap, five redirects after the initial request, and the 600-GET planned maximum. Before building, verify a source-only observational diff and a protected-file hash manifest. Before any publisher request, verify the exact candidate build identity, source hash, and embedded 512-MiB / 900-second settings, then pin the run to that exact build; any mismatch stops without a run. Use the actual `reader`/stream in the existing hosted code path. At reader acquisition, attach fulfillment and rejection observers to `reader.closed`, and handle the observer promise so it cannot create an unhandled rejection. If property access or observer attachment fails, leave the closed state absent and include only the sanitized setup error in the existing `body_reader_acquired` marker; do not emit `reader_closed_settled` or infer stream settlement. Track the existing read index, whether a read is in flight, and current processing phase without changing the awaited read. Record signal creation and firing times, read/stream settlement, cleanup, extraction/result, and dataset-write stages. Do not change request, abort, cancellation, body-read, cleanup, parser, or output semantics; do not wait for, cancel, or release the stream differently to obtain evidence.

Use at most 24 added markers per row, plus at most four worker-join markers and one run-summary marker, for a total cap of 2,405 added markers. Reserve one slot each for these 16 decisive event types: `signal_created`, `body_reader_acquired`, `body_read_entered`, `body_read_completed`, `abort_fired`, `reader_closed_settled`, `post_abort_snapshot`, `post_abort_inflight_read_settled`, first `post_abort_cancel_enter`, first `post_abort_cancel_settled`, `cleanup_enter`, `cleanup_settled`, `catch`, `fetch_result`, `row_write`, and `row_terminal`. Deduplicate within each reserved type; optional events cannot displace these slots. The remaining eight per-row slots take the first eight redirect/response/pre-abort-cancel transitions in occurrence order; suppress later optional lines. Continue numeric state and counters in memory and include their current values in reserved events; emit no per-read/chunk lines and do not affect underlying operations. A single unref'ed, nonthrowing snapshot per row may observe state for up to two seconds after abort and must be cancelled if the row finishes first. If `q3-us-01` finishes before that snapshot, cancel the timer and record non-reproduction without inferring a fix. Capture the exact Node and Undici versions in the existing `run_start` event. Logs may contain only row ID, stage, elapsed time, signal-creation and abort-fire times, read index/in-flight/current phase, `reader.closed` state (`pending`, `fulfilled`, or `rejected`), and sanitized error class/code. Do not log URLs, headers, body or article text, tokens, raw errors, or other secrets.

**Interpretation and stop rules:** If `reader.closed` and the read both remain pending through observation, report no observed stream/read settlement and leave cause unknown. If `reader.closed` settles while a read remains in flight, report that the stream state changed while read progress remains unresolved; a rejection caused by later `releaseLock()` is not proof of a stream abort error. If the read settles but no row output follows, use later cancel/cleanup/catch/fetch-result/write/worker-join markers to identify only the observed boundary. If no post-abort snapshot is recorded while the row is active, timer/event-loop progress is uncertain; absence is not proof. Signal creation-to-abort time is supporting context for Q2, not the primary R2 question. A matching abort/body-read stall on another row is a separate-row recurrence; report that row independently and do not claim that q3-us-01's historical cause was reproduced. These observations may be incomplete or timing-sensitive, and instrumentation can perturb timing. A non-reproduction does not prove a fix or explain M3. Stop after this one run; any failed or incomplete run remains Inconclusive / Hold and authorizes no fix, retry, new resource direction, or follow-up diagnostic. Only a normal 100-row completion proceeds to independent review of all counted text against the existing 50/100 target. B3 remains conditional on its original criteria; this proposal does not make it eligible automatically.

At 512 MiB for 900 seconds, compute is estimated at 0.125 CU / approximately `$0.025` using the previously cited `$0.20/CU` standard rate. This is compute-only, not a guaranteed total or spending cap; actual account, transfer, build, storage, and API charges may differ. The completed R2 run reported `$0.025715634668674735` total usage; actual usage is evidence, not a cap. Build `GvJKHPRZBtQdnQhwS` / `0.10.3` passed exact candidate and Actor/resource verification. The single run is complete and its approval exhausted; Area B remains on Hold.

**B2-R2 execution result (2026-10-07):** Build `GvJKHPRZBtQdnQhwS` / `0.10.3` passed exact candidate and embedded resource checks. Run `kRbP0jJtLZtWuKxOh` used the frozen input (100 IDs, 95 unique publisher URLs, five repeated occurrences), actual 512 MiB / 900 seconds, and timed out at 899.854 seconds (`exitCode: null` in platform metadata). The CLI wait process exited 1; this is separate from the platform run status. The default dataset contains 98 unique rows; missing IDs are `q3-us-02` and `q4-gb-02`. The 98 rows contain 76 eligible HTML, 16 HTTP-denied, five timeouts, and one request error; extraction statuses are 75 success candidates, one no-readable-text candidate, and 22 not attempted. These are operational outcomes, not independent article-readability judgments. Their publisher request counts sum to 99 dataset-observed requests; the run-wide total is unknown. Platform peak memory was 511,270,912 bytes and actual total usage was `$0.025715634668674735`; neither establishes memory causality. The final log contains 1,049 R2 row markers, two worker-join markers, and no run summary. q3-us-02 and q4-gb-02 each reached an abort and a two-second post-abort snapshot while the body read remained in flight (`readerClosedState: pending`), with no later marker or row result. They are separate-row observations; they do not reproduce q3-us-01's historical cause. q3-us-01 did not acquire a reader; its pending state is only an initialization placeholder. The snapshot overwrites `currentPhase` with `post_abort_observation`, so it does not preserve the underlying phase at that instant. The evidence is in `experiments/b2-vanilla/run-metadata-b2-r2.json`, `results-b2-r2.json`, and `sanitized-stage-evidence-b2-r2.json`; the raw log and dataset remain in ignored `experiments/b2-vanilla/private/`. Classify B2-R2 as valid partial execution, Inconclusive / Hold. It establishes neither completion of the 100-row acceptance nor a below-50 result; B3 is not eligible and the approval is exhausted.

## Proposed B2-R3 — bounded pending-read containment (executable amendment; awaiting owner approval)

**Status and authority:** B2-R2 is complete and its one-run approval is exhausted. The design-only authority granted for B2-R3 has now been used to complete this amendment. The amendment is ready for owner review but remains **unapproved**. Until approval is received, it authorizes no source/test change, local execution, Actor build, hosted run, or publisher request.

### Question

Can the real bounded publisher-body reader be made fail-soft when the existing HTTP timeout fires while one `ReadableStreamDefaultReader.read()` remains pending, so that the affected row becomes a normal timeout outcome and the Actor continues to later rows without changing the approved HTTP-first architecture?

This is a containment question. It does **not** attempt to prove why the two B2-R2 publisher responses stalled.

### Why this is a meaningful production seam

The current hosted candidate calls `readBoundedBody(response, logStage, r2Trace)` directly inside the ordinary publisher fetch path. The helper is non-exported only because it lives in `main.mjs`, whose top-level import starts the Actor. Its body-stream logic has no Actor dependency and can be moved, together with the existing response-body cancellation helper and 2 MiB body bound, into one side-effect-free module without changing the product mechanism.

The current Node 20/Web Streams contract provides a specific containment primitive: releasing a `ReadableStreamDefaultReader` while a `read()` request is pending causes that pending read promise to reject, and reader cancellation is the standard signal that the consumer is no longer interested in the stream. The candidate therefore does not add a second runtime, watchdog service, proxy, retry layer, or publisher-specific mechanism. It makes the existing row timeout observable at the exact helper that was seen waiting after abort.

### B2-R3a — actual-helper seam and reproduction gate

**Objective**

Prove that the test exercises the real helper and can distinguish the observed failure mode before any containment behavior is added.

**Source change**

Make one behavior-neutral extraction only:

- move `cancelResponseBody()`, `readBoundedBody()`, and the existing 2 MiB body-limit constant from `experiments/b2-vanilla/actor/main.mjs` to a new side-effect-free `experiments/b2-vanilla/actor/body-stream.mjs`;
- export the two helpers and import them from `main.mjs`;
- do not change their operational logic, arguments, timeout behavior, fetch behavior, output, logging callbacks, dependencies, Actor configuration, or input.

Add `body-stream.test.mjs` using Node's built-in `node:test`; add no dependency.

**Local controls**

Run tests serially with `node --test --test-concurrency=1 body-stream.test.mjs`.

The controls must establish that the extracted unchanged helper:

1. returns the exact bytes from a normally completed finite HTML response;
2. preserves the declared-length body-limit failure;
3. preserves the streamed body-limit failure; and
4. is the helper under test rather than a copied implementation.

**Reproduction fixture**

Use a loopback HTTP server only. It returns HTTP 200 / HTML headers, writes a small body prefix, and deliberately leaves the response body unfinished. Fetch it with an `AbortSignal.timeout(250)`, obtain the real fetch `Response`, then call the extracted unchanged helper. A separate 2-second outer **test-only** watchdog records whether the helper has settled; after that observation it destroys the loopback connection so the test process cannot hang.

The 250 ms / 2 s values accelerate a deterministic local test only; they are not product limits and are not evidence about hosted publisher latency.

**R3a reproduction gate**

R3a is Supported only if:

- all normal/body-bound controls pass; and
- after the fetch signal has aborted, the unchanged actual helper is still unsettled when the 2-second watchdog observes it.

If the helper settles before that watchdog, the local fixture does not reproduce the relevant pending-read behavior. Stop B2-R3 as **Inconclusive / Hold**. Do not implement the candidate merely because the hosted run once stalled.

Retain only concise sanitized test evidence: Node version, test names, abort/watchdog timings, settlement state, and pass/fail. No publisher requests occur in R3a.

### B2-R3b — containment candidate and acceptance

**Run when**

Only if B2-R3a passes its reproduction gate and the owner has approved this complete amendment.

**Candidate source change**

Starting from the behavior-neutral R3a seam:

1. pass the already-existing per-row HTTP `AbortSignal` into `readBoundedBody()`;
2. for each pending `reader.read()`, race the read outcome against that existing signal's abort event;
3. if the read wins, keep the current behavior;
4. if the abort wins while a read is pending:
   - release the reader lock so the pending read is forced to settle;
   - consume the late read outcome so it cannot become an unhandled rejection;
   - after the stream is unlocked, request best-effort body cancellation and attach rejection handling, but **do not await cancellation on the row's critical path**;
   - throw the signal's timeout reason (or an equivalent `TimeoutError` only if the runtime supplies no reason), so the existing `fetchPublisher()` classification remains `timeout`;
5. never return accumulated partial bytes after the timeout wins;
6. preserve normal success when the body finishes before the timeout wins.

No second timer is added to production code. The existing `ROW_HTTP_TIMEOUT_MS = 10_000` remains the only publisher HTTP-chain deadline. Redirect count, body-size cap, concurrency, parser, dataset output, provenance fields, and all acceptance thresholds remain unchanged.

**Race and cleanup requirements**

The implementation must:

- remove its abort listener on normal completion;
- tolerate a signal that is already aborted when body reading begins;
- avoid double release/cancel effects;
- handle synchronous or asynchronous cancellation failure without replacing the row's timeout classification;
- leave no unhandled rejection from the original read, `reader.closed`, or best-effort cancellation;
- not treat a partial body as successful HTML;
- not block the worker while waiting for cleanup after the row has timed out.

### B2-R3b local proof

Use the same actual `body-stream.mjs` helper and the same serial Node test command.

The candidate must pass:

1. all R3a normal/body-bound controls unchanged;
2. the same unfinished loopback response: the helper must settle as a timeout before the 2-second watchdog, and a subsequent healthy loopback response must be read successfully;
3. a separately labelled **artificial worst-case stream** whose next `read()` remains pending and whose underlying cancellation promise is deliberately left pending: the helper must still return control as a timeout before the watchdog because row completion must not depend on cleanup settlement;
4. no observed `unhandledRejection` during either containment test after allowing late read/cancel settlement opportunity;
5. no duplicate helper completion.

The artificial stream proves only containment behavior. It is not evidence that hosted publishers or Undici produce that exact fault.

If any local candidate test fails, classify B2-R3b **Rejected / Hold** and stop. Do not build or run the Actor.

### Hosted candidate gate and one acceptance run

Only after every local gate passes:

- change the isolated Actor build tag to `issue41-b2-r3` under existing Actor definition version `0.10`;
- keep Node 20, all dependencies, 512 MiB memory, 900-second Actor timeout, concurrency four, the 10-second HTTP-chain timeout, 2 MiB body cap, redirect limit, parser behavior and frozen input unchanged;
- make no Google News requests, prior-run cache/KVS reads, proxy/browser/unblocking calls, permission changes, credentials, retries, alternate runtime, or external service calls beyond the ordinary publisher HTTP requests already represented by B2;
- create exactly **one** candidate build.

Before any publisher request, verify the exact build contains only the approved helper extraction/containment, focused test file, import/signature wiring and build-tag change; verify the frozen input SHA-256 remains `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`; and verify the build definition still reports 512 MiB default/min/max memory and 900-second timeout. Any mismatch stops without a hosted run.

If the build gate passes, execute exactly **one** frozen 100-row hosted acceptance run using that exact build and the existing normal fetch → in-memory extraction → default-dataset flow.

### Hosted evidence and scoring

A valid completed R3 run requires:

- platform run success and normal run summary;
- exactly 100 dataset rows with 100 unique frozen row IDs and no duplicates;
- one row outcome for every input row;
- original Google News URL and resolved publisher URL preserved on every row;
- any contained pending-read event represented as that row's ordinary timeout/fetch-failure outcome rather than a missing row or run-level stall;
- no dataset-write failure or run-level processing failure.

If the run completes, independently review every `fullTextStatus=success` candidate for coherent readable article text before scoring the existing >=50/100 target.

Routing remains unchanged:

- **>=50/100 independently readable texts:** Area B is Supported for the tested sample; combine with supported Area A for the Spike conclusion.
- **Completed run, >=50 eligible HTML but <50 readable texts:** B3 becomes eligible under its existing extraction-quality condition.
- **Completed run with <50 eligible HTML:** record the access result and return to TID/owner review; do not invoke B3 automatically.
- **Any incomplete/failed hosted run:** B2-R3 is Inconclusive / Hold. No retry, new timeout, resource increase, deeper stream diagnostic, publisher-specific fix, or alternate runtime follows this amendment.

The previous R2 run used about $0.0257 total platform usage at the same 512-MiB / 900-second ceiling. R3 authorizes one comparable hosted run only; actual usage remains evidence, not a guaranteed cap.

### Approval boundary

Approval of this amendment authorizes the complete conditional B2-R3a → B2-R3b sequence above: the behavior-neutral helper extraction and local reproduction test; the containment candidate and local proof only if R3a reproduces; then one candidate build and one hosted 100-row run only if every local/build gate passes.

Approval does **not** authorize a retry, another containment mechanism, a second hosted build/run, new diagnostics, resource changes, dependency changes, browser/proxy infrastructure, publisher-specific handling, or investigation of the root cause of the B2-R2 stalls.

**Approval recorded:** The owner approved this amendment on 2026-10-07. R3a was executed once; its reproduction gate was not met. The approved sequence stops at Inconclusive / Hold. R3b and the hosted candidate are not eligible under this amendment. Area B remains **On Hold**.

## B2-R4 — hosted body-read diagnosis

**Status:** **OWNER APPROVED 2026-10-07 — EXECUTED ONCE — RUN TIMED-OUT — INCONCLUSIVE / HOLD — BUILD/RUN AUTHORITY EXHAUSTED.** B2-R3a remains Inconclusive / Hold and B2-R3b remains ineligible. This was a distinct, diagnostic-only route. The owner approved the complete bounded design and its stated cost/build risk by replying “approved. go ahead.” The separate historical-R2 candidate passed independent semantics review. Its approved source hash and provenance are recorded in the manifests. The single approved build and run completed; the run result and limitations follow. No retry, second build/run, or additional publisher requests occurred.

### Objective and baseline

Determine whether a hosted Node.js 20 Actor, using the historical B2-R2 source and fixed sample, still leaves an eligible publisher response-body read pending after the row timeout signal fires, and identify the last observed processing stage. This tests whether the R2 symptom recurs and where progress stops. It does not test or fix a containment mechanism, prove why a read stalls, or establish either Issue #41 product acceptance target.

The relevant product targets remain at least **95/100** valid non-Google publisher URLs and **50/100** independently reviewed readable articles. Area A supports 100/100 for its fixed sample. Full-text quality remains unassessed: B2-R2's 75 extraction-success statuses are candidates, not independent readability judgments. The earlier 0.8.1 / 256 MiB run ended in SIGKILL after 10 outputs with unknown phase and cause. That event is distinct from B2-R2's two rows observed with a pending body read after abort; neither event proves extraction hung or establishes a shared cause. R3a's Node 20 loopback fixture did not reproduce a pending read, so R3b is not eligible.

The verified B2-R2 comparator is source commit `2694b1162c90bf93a4e36db4fa3cb0d4e0800a7e`, `main.mjs` SHA-256 `b87e8635caf895181a406c4a103aaa57ab81193ce3a3f4477728ab568bffc47c`, build `GvJKHPRZBtQdnQhwS` / `0.10.3` / tag `issue41-b2-r2`, run `kRbP0jJtLZtWuKxOh`, and final image digest `8130c570d3b64cf5ef197ac69c6db66d3810d3173e9069510ffe95a3785af5da`. It used Node `20.20.2` / bundled Undici `6.24.1`, 512 MiB, a 900-second run limit, concurrency four, a 10-second row HTTP-chain timeout, a 2 MiB body cap, up to five redirects after the initial request, and a planned maximum of 600 GETs. The frozen input SHA-256 is `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01` with 100 rows, 95 unique publisher URLs, and repeated occurrences retained without deduplication. The run timed out at 899.854 seconds with 98 rows. For two missing rows, a 2-second snapshot found both `readInFlight` and `reader.closed` pending; neither had a terminal marker. The snapshot overwrote the phase field, so the prior phase is unknown. The exact input can be replayed, but publisher response bodies are live and mutable; R4 cannot claim same-response or same-row causality.

### Artifact and ownership boundary

Following the owner's approval recorded on 2026-10-07, prepare a separate `docs/changes/41/experiments/r4-hosted-body-read/` candidate by copying the historical R2 Actor source/build files from the verified R2 commit. Record a manifest of source/build-file hashes and each successor delta. Preserve the current `experiments/b2-vanilla/actor/` tree, including the R3a `main.mjs`, `body-stream.mjs`, test, and records. Do not reset current files to R2 or include the R3a helper extraction in the R4 candidate. Append R4 execution evidence to `technical-spike.md`; retain prior records and the false-R3a audit trail unchanged.

### Ordered experiment and gates

1. **Verify lineage before creating the candidate.** Recheck R2 source, input, row identifiers/count, lock/configuration, and hosted build/run/image provenance against the hashes and IDs above and retained records. Stop for a TID revision if any item differs or cannot be verified.
2. **Review diagnostic semantics.** Permit only bounded event recording and a build-time runtime probe. Event recording is log-only; preserve the normal dataset schema and article output. Preserve the R2 fetch/read/cancel control flow, signal timing, concurrency, body cap, redirect behaviour, extraction, per-row failure handling, output schema, and Google News URL fallback. Add no read/cancel operation, promise race, retry, or service. A semantic change stops the proposal before build.
3. **Build exactly once after all approval gates pass.** Create one diagnostic successor build from the copied R2 source. In its final image stage, run a Node command that records `process.version` and `process.versions.undici` without making a publisher request. Retain the build log, source/package hashes, build ID, and final image digest. A failed build has no unchanged retry.
4. **Verify before any publisher request.** Require Node `20.20.2`, Undici `6.24.1`, R2 source/config/input lineage, and the new final image digest; bind the only run to that exact build. The Dockerfile's `apify/actor-node:20` tag is mutable and cannot establish the runtime versions. Any mismatch or unverified runtime stops before the hosted Actor run and returns to TID review.
5. **Run once only if every gate passes.** Use the exact frozen 100-row input and R2 settings: 512 MiB, 900 seconds, concurrency four, 10-second row HTTP-chain timeout, 2 MiB body cap, up to five redirects after the initial request, and no more than 600 planned GETs. Use one private hosted run only. No Google News request, browser, proxy, KVS/cache access, paid service, extra sample, production deployment, retry, or alternate runtime is in scope.
6. **Sanitize, analyze, and record.** Retain allowlisted event evidence plus build/run IDs, status, duration, image provenance, dataset row counts, GET counts, and actual billed amounts. Validate marker completeness and all configured limits before interpreting a stage. Keep body/article text, URLs, hostnames, raw headers, tokens, and raw errors out of Git. Update the Spike record only after evidence validation. Do not infer Issue #41 readability from extraction status.

### Diagnostic event contract

Use the existing R2 marker path as the starting point. Every R4 marker is limited to opaque row ID, request-attempt ordinal, per-row sequence number, monotonic milliseconds from run start, event name, the actual underlying phase, and bounded state. State may include response status and media-type class, redirect count, cumulative body bytes, and allowlisted error class/code. Never record URLs, hostnames, raw headers/bodies/article text, tokens, or raw errors.

Proposed sparse events are: signal creation and abort delivery; request and response; reader acquisition; body-read entry and settlement; existing cancellation entry and settlement; `reader.closed` settlement; cleanup; fetch result; extraction entry/exit; dataset write; row terminal; and one bounded final aggregate. Keep the actual `currentPhase` separate from a snapshot event. A snapshot records the last real phase; whether the signal is aborted; whether read, `reader.closed`, cancellation, or cleanup is pending; cumulative bytes; last-event age; and scheduled versus actual timer delay. Take snapshots at 2 and 30 seconds after abort only while work remains pending, at most two per row. Timers are unref'ed and cleared when the row reaches terminal state; they are not awaited and cannot extend the 10-second HTTP timeout or 900-second run limit. If a required 30-second observation is prevented by run termination, classify the evidence Inconclusive / Hold. Do not poll or log per chunk. Preserve underlying control flow: add no application await/race, extra read/cancel, forced log flush, or failure-path change.

**Approved marker and log envelope:** Count all retained R2 and new diagnostic records. Allow at most six GET attempts per row, with one start and one end event per attempt (12 events); at most 16 sparse lifecycle events; and at most two post-abort snapshots. Keep chunk activity only in bounded in-memory read index, in-flight flag, cumulative bytes, last-settled time, and actual phase; emit no per-chunk markers. This gives 30 planned events per row. Reserve 10 additional slots per row, including one terminal and one overflow marker, for a maximum of 40 per row or 4,000 across 100 rows, plus four worker joins, one summary, and one global overflow marker: **4,006 total markers**. Limit each UTF-8 marker record including newline to **768 bytes**, yielding a maximum of 3,076,608 marker bytes; use the approved **4 MiB marker-byte ceiling**. Maintain attempted/emitted/dropped counts and byte totals in memory; lifecycle duplicates intentionally suppressed by the one-per-row event contract are counted separately as deduplicated, not as attempted or dropped markers. When an event or byte cap would be crossed, emit the once-only reserved row overflow marker with its reason and counters, then suppress optional detail. Preserve reserved terminal capacity, and include the terminal record itself in its final per-row attempted/emitted/byte totals. If required markers, sequence continuity, final counts, overflow state, or summary are missing, report only the last observed event and classify Inconclusive / Hold. A missing later marker does not prove the operation remained pending until run end. Source-side 4 MiB bounds marker output only; platform-wide log truncation/retention is not established and must be checked from the actual log response.

### Cost, runtime, and decision gates

**Approved build guard:** Make exactly one diagnostic build attempt. Record build ID, creation time, status transitions, source hash, image digest, build log, and reported charge. Poll status every 10 seconds. If still nonterminal 120 seconds after creation, check once more and issue one abort; after the abort response, observe status for at most 120 more seconds. If the build is still unresolved, record its ID and last status and stop; do not start an Actor run. A build failure, abort, guard timeout, missing runtime proof, or other verification mismatch also means no Actor run and no unchanged retry. The 120-second observation window is an operational bound, not a platform termination guarantee. A build may settle or accrue charges after observation ends, and abort is best-effort. The R2 build lasted 13.446 seconds, used 0.01494 CU, and reported `$0.002988`; this is historical evidence, not a hard build cap. The [build-create API](https://docs.apify.com/api/v2/actors-builds-post) has no documented memory/duration cap; [build abort](https://docs.apify.com/api/v2/actor-build-abort-post) does not guarantee a completion time. Owner approval accepts one monitored build attempt with best-effort abort and no hard build-dollar ceiling.

**Approved run charge bound:** If all gates pass, submit exactly one private Actor run through the [run API](https://docs.apify.com/api/v2/actors-runs-post) with `maxTotalChargeUsd=0.10`. This hard charge limit applies to this run only, not the separate build. Record the submitted API limit, run ID/status, actual charge and duration, exact build/image identity, logs, and dataset. The CLI does not expose this run parameter; the approved executor must use the API directly. The R2 run reported `$0.025715634668674735`; this is historical, not a cap. [Public compute rates](https://apify.com/pricing) vary by plan; [Apify's compute-unit explanation](https://help.apify.com/en/articles/3490384-what-is-a-compute-unit) describes CU billing. Do not perform account-plan or personal-data lookup. The owner approved the 0.10 run cap as a R4-specific bound. A combined build-plus-run ceiling is not promised. Platform-wide log truncation/retention remains a separate evidence risk; the proposed marker byte bound does not claim to control platform logs.

The following are **owner-approved R4-specific diagnostic thresholds**, not established standards or product acceptance criteria:

- A representativeness gate of at least **70 eligible HTML body-read attempts**, compared with B2-R2's 76. Ninety percent of 76 is 68.4, so 69 is the minimum whole-number threshold; the proposal uses 70 as a one-row stricter margin, allowing at most six fewer eligible rows (about 7.9% below R2) as an operational screen for a materially different live response mix. Since R2 is one live run, this is not a measured variance bound or statistical guarantee; publisher HTML is not frozen.
- Diagnostic timer-delay flags above **2 seconds** for the 2-second snapshot or above **5 seconds** for the 30-second snapshot. These trigger a timer-scheduling observation only; they do not prove its cause.
- At most **40 marker records per row**, **4,006 total records**, **768 UTF-8 bytes per marker record including newline**, and **4 MiB total marker bytes** under the approved accounting above. These values are new diagnostic bounds, not established product standards.

### Interpretation and stop routes

- Any baseline, source, input, runtime, resource, spend, semantic, or evidence-cap gate mismatch: stop before the next publisher request/build/run as applicable; classify Inconclusive / Hold and return for TID review.
- If fewer than **70 eligible HTML body-read attempts** occur, the live response mix is not representative under this approved gate; classify the run Inconclusive / Hold and do not claim reproduction or a product outcome.
- If the abort is not delivered when expected, or the 2-second snapshot timer is delayed by more than **2 seconds** or the 30-second snapshot timer by more than **5 seconds**, report only the observed timeout/scheduling evidence and route to scheduling analysis; do not label it a body-reader stall.
- If abort is delivered and both `read` and `reader.closed` remain pending at 2 and 30 seconds while timers and other rows progress and no terminal row output appears, classify the symptom as reproduced and localize the last observed progress boundary to the body-read/abort-settlement interval. Pending at 30 seconds is not root cause and is not an Issue pass.
- If the read settles but cancellation or cleanup remains pending, localize only to that observed stage. Do not infer a mechanism unless the marker sequence directly establishes it.
- If fetch returns but extraction or dataset write does not finish, localize only to the post-body stage; do not attribute it to the body read.
- If read rejection and a row terminal result occur in time, the symptom is absent in this run; cause and resolution remain Inconclusive. No retry.
- If live response mix drifts, evidence is missing/capped, a 30-second snapshot is blocked by run end, or runtime/input differs, classify Inconclusive / Hold.
- If a stage is localized but the reason for non-settlement remains unknown, record the exact gap and stop. A mechanism-specific next experiment requires a new bounded TID and owner approval; no autonomous deeper probe, fix, or rerun.

### Approval boundary and owner choices

The approved R4 sequence allows one diagnostic candidate build and, only if every gate passes, one private 100-row hosted run. It cannot pass the 95/100 publisher-resolution or 50/100 readability product targets and makes no product acceptance claim. No retry, second build/run, source fix, containment implementation, resource increase, diagnostic expansion, browser/proxy/KVS/paid service, or root-cause claim is authorized.

The owner explicitly accepted the **$0.10 hard cap on the single run only**, the separately monitored single build attempt with best-effort abort and no hard build-dollar cap, the 4,006-marker / 4-MiB marker bound, the 70-eligible-HTML representativeness threshold, and the timer-delay flags by approving this TID on 2026-10-07. These are proposal-specific gates, not existing product standards. Platform-wide log truncation cannot be bounded by the source marker cap; missing markers, loss, or an unverified final record routes to Inconclusive / Hold. The precise build guard, run cap, marker arithmetic, evidence-loss routing, runtime verification, and stage-only interpretation rules remain the execution authority; no separate execution plan or per-experiment approval is required inside that approved sequence.

### Owner checkpoint — R4 hosted diagnostic approval recorded (self-contained)

## Product and Issue context

The Actor is meant to turn Google News links into usable publisher links and optionally return readable article text, while keeping a failure on one publisher page from stopping the rest of the run. The publisher-link capability met its fixed-sample target, but the full-text capability still has no complete, independently reviewed 100-row result. Issue #41 tracks that uncertainty; the publisher-link and optional full-text Issues, #4 and #5, remain blocked until the Spike reaches a supported conclusion.

## Why this Spike exists

The latest relevant hosted run completed only 98 of 100 rows. On two separate rows, the request timeout fired while the body read and stream-closed observation were still pending at a two-second snapshot, and no final row result was observed. An earlier 256 MiB run ended with SIGKILL after 10 rows, but its phase and cause are unknown and it is a distinct event. A local Node 20 reproduction did not remain pending through its watchdog, so the approved containment experiment cannot proceed. The full-text target remains unassessed.

## What we have learned so far

The historical 100-row input and the exact hosted build/run lineage can be checked and reused. The input can be replayed, but publisher responses are live; this investigation cannot promise identical HTML or claim a same-row cause. The 75 extraction-success statuses in the partial hosted run are not readability judgments. R4 would observe the ordinary fetch/read/row path and help locate where progress stops; it would not fix the behavior or pass the product target.

## What would need to change

The approved preparation used a separate diagnostic candidate copied from the verified historical R2 Actor files, leaving the current R3a files untouched. It adds only the specified bounded event recording and final-image Node/Undici runtime probe. The approved sequence allows exactly one build attempt: poll every 10 seconds, check again at 120 seconds, then issue one abort if still nonterminal and observe up to 120 seconds more. If still unresolved, record the build and last status and do not start a run. Build abort is best effort; this creates no hard build-cost guarantee. If the build/runtime/provenance gates pass, the sequence allows exactly one private API run with `maxTotalChargeUsd=0.10`, the fixed 100-row input, 512 MiB, 900 seconds and the original concurrency, timeout, body, redirect, and GET bounds. It captures the designated stage markers and snapshots at 2 and 30 seconds after abort, without changing stream handling. Stop after this one run. The result is diagnostic or Inconclusive / Hold, never a product acceptance result or a fix. The one approved run has now timed out; its outcome is summarized below.

The approved R4-only bounds are at most 40 marker records per row, 4,006 total including worker/summary/global-overflow records, 768 UTF-8 bytes per marker record, and 4 MiB total marker bytes. The arithmetic reserves overflow and terminal slots; platform-wide log truncation is not guaranteed by this source-side cap, so missing sequence/summary/evidence is Hold. The representativeness minimum is 70 eligible HTML body-read attempts versus 76 in R2. Timer-delay flags are >2 seconds for the 2-second observation and >5 seconds for the 30-second observation. The owner accepted these thresholds and cost/build policy on 2026-10-07. At approval time no R4 build or run had occurred; the later execution outcome is recorded below.

## Direction and complexity check

R4 stays within the existing HTTP-first Actor and uses the historical sample and product path. It adds diagnostic logging and a runtime probe, but no new runtime, publisher mechanism, proxy, browser, paid service, retry, or product fix. Instrumentation can alter timing, publisher responses can differ from the earlier run, and platform log truncation is not yet verified. The approved cost policy caps the run only; the single build has a monitored best-effort abort but no hard dollar cap.

## Recommendation

Keep Area B on Hold after the completed R4 diagnostic. The owner accepted the run-only `$0.10` cap, monitored build policy with best-effort abort, and evidence/representativeness thresholds. This route produced stage-level observations but did not establish a root cause or product outcome; further diagnosis requires a new bounded TID.

## Decision requested

**Approval recorded 2026-10-07:** The owner replied “approved. go ahead” to this complete checkpoint and approved the defined bounded R4 sequence, including the run-only `maxTotalChargeUsd=0.10`, one monitored build attempt with best-effort abort/no hard build dollar cap, marker/log limits, 70-row representativeness gate, and timer-delay thresholds. Approval authorizes preparation, one build attempt, and only if all stated gates pass one private 100-row hosted run. It does not authorize a source fix, retry, second build/run, publisher-specific handling, new mechanism, deeper diagnostic, or product acceptance claim. After this approval checkpoint, the one authorized build and conditional run were executed; the run timed out and is Inconclusive / Hold, as recorded below.

## B2-R4 execution result — 2026-10-07

The one approved build succeeded as `4fIEXQuafIexpToxV`, version `0.10.4`, in 11.876 seconds, reporting `$0.002625111111111111`; its final-image probe confirmed Node `20.20.2` / Undici `6.24.1`. The one private run, `XoTyJgwLo1x2KMa7g`, used the verified image digest `79cbddf7be1066a84ff2c156fe8a023f67d6ffb9d0c0668d5b977077174dd805`, the frozen input and approved R2 limits (512 MiB, 900 seconds, concurrency 4, 10-second row HTTP-chain timeout, 2 MiB body cap, at most five redirects after the first request, 600 planned GETs), and `maxTotalChargeUsd=0.10`. It ended `TIMED-OUT` after 899.757 seconds, with 97/100 dataset rows; reported run charge was `$0.025707807603895665` and compute use `0.12496625` CU.

The sanitized dataset and marker audit report three rows with body reads and `reader.closed` pending at both recorded post-abort snapshots. Two rows crossed the approved timer-delay flags, so the scheduling-analysis route applies. There is no run summary, the three rows lack terminal counters, and global marker completeness is unknown. This is a finite observation only: it does not establish persistence until termination or a root cause. The run's 79 `body_read_entered` attempts exceed the 70-attempt operational screen; the separate 75 eligible-HTML outcomes and 74 extraction-success statuses are different denominators and do not establish readable-text acceptance. Classify R4 **Inconclusive / Hold** and exhaust the one-build/one-run authority. The detailed execution record is in `technical-spike.md`, `experiments/r4-hosted-body-read/results-r4-operator-evidence.json`, and the 1,402-record `experiments/r4-hosted-body-read/markers-r4-sanitized.jsonl`. The operator-export JSONL was 602,412 bytes (SHA-256 `9bcbee84dbc24673bf76d97d7eff3f5e3d0889e74865698f4038e9e83b89719d`); the retained LF-normalized file is 601,010 bytes (SHA-256 `7151b0f7b9619d7149856c23b31909df830be724f8cb8dd19eed3fc7090cbc76`), with the 1,402 JSON records unchanged. The R5 source assessment completed validly at 17:45:07 UTC; its mechanism remains unresolved / Inconclusive / Hold, with no authorized hosted follow-up.

## B2-R5 owner checkpoint — exact-runtime abort/body-settlement source assessment

**Approval and time accounting:** The proposal was initially DRAFT. The owner approved this single 30-minute read-only source assessment on 2026-10-07; it began at **16:58:39 UTC**, was interrupted, and resumed at **17:36:42 UTC**. Since active time before interruption was unknown, 15 minutes were conservatively charged; the resumed window was capped at 15 minutes. The interruption gap was excluded. Assessment ended at **17:45:07 UTC**, after 8 minutes 25 seconds in the resumed window and 23 minutes 25 seconds conservatively charged overall, below the 30-minute maximum. The original 17:28:39 UTC wall-clock stop elapsed while work was halted. This was the same assessment, not a reset. The bounded assessment completed validly; its mechanism remains unresolved and the Spike remains Inconclusive / Hold. Evidence is in `experiments/r5-runtime-abort-assessment/evidence-r5-source-trace.md`. No hosted run, build, source edit, local reproduction, publisher request, or fix was authorized or performed.

### Product and Issue context

Issue #41 asks whether at least 95/100 representative Google News links resolve to publisher URLs and at least 50/100 retained rows contain independently readable article text. URL resolution reached 100/100; the full-text target remains unproven. Keep the original 0.8.1 / 256 MiB SIGKILL after 10 rows (cause unknown) distinct from the later timeouts. R3a was Inconclusive / Hold and R3b remains ineligible. R4 is Inconclusive / Hold and its authority is exhausted: build `4fIEXQuafIexpToxV` succeeded with Node `20.20.2` / Undici `6.24.1`; run `XoTyJgwLo1x2KMa7g` timed out after 899.757 seconds with 97 rows and no run summary. It recorded 79 `body_read_entered` attempts, 76 settled and three pending in finite snapshots; the separate counts are 75 eligible-HTML fetch outcomes and 74 extraction-success statuses, neither of which is a readability judgment. All six snapshots showed stable read-index/byte counts and no cancellation or cleanup pending. `q4-gb-02` snapshots were delayed 5.001/1.100 seconds; `q4-gb-07` snapshots were delayed 5.602/7.238 seconds; `q5-gb-10` snapshots were delayed 0.200/0 seconds. Reader settlement at run end is unknown. The evidence is in `experiments/r4-hosted-body-read/results-r4-operator-evidence.json` and `markers-r4-sanitized.jsonl`.

### Question and bounded activity

The completed assessment read the exact Node `v20.20.2` and bundled Undici `6.24.1` sources, plus narrowly relevant Web Streams source/docs. It traced (1) what `controller.abort(reason)` does to an already-resolved response body; (2) whether `Response.body` and the stream addressed by `abortFetch` are the same stream locked by the Actor's reader; (3) how `abortFetch` handles `cancel(error)` rejection, including `ERR_INVALID_STATE` catch behavior under that lock; and (4) what these paths imply for `reader.read()` and `reader.closed` settlement. Source expectations, R4 observations and inference are separated in the evidence note. The exact missing transition is the internal controller/listener/stream state and the ordering of application promise reactions; no public passive signal exposes it.

Preliminary source facts make the question traceable: `Response.body` returns the inner body's stream; `abortFetch` addresses that same response-body stream; the Node Web Streams reader locks its stream and exposes distinct read/closed promises; and the Undici abort path calls `cancel(error)` and catches errors including `ERR_INVALID_STATE`. This is a candidate source-level explanation only. R4 has no internal cancel/error marker and does not show that this path ran or what it returned. Do not state it as R4's observed cause.

### Falsification and stop routes

The locked-cancel hypothesis is unsupported if exact source shows that the abort path targets a different stream, independently errors/closes the locked body and settles the pending read, or does not swallow the locked-cancel rejection. If source supports only a possible swallowed cancel rejection, record a source-supported hypothesis, not an observed runtime mechanism. If a documented passive public observable directly distinguishes internal cancel rejection from downstream reader settlement, stop and propose a separate hosted TID for owner approval. If no such observable is verified, or source semantics/identity remain ambiguous at 30 minutes, state the precise gap and keep Issue #41 Inconclusive / Hold. Source tracing alone cannot establish root cause.

No broad standards audit, version substitution, local/synthetic reproduction, experiment network/API/Actor operation, package install, code edit, build, hosted run, publisher request, fix, deploy or paid replay is included. Passive read-only retrieval of the exact-version source files and directly relevant documentation listed above is within scope. Hosted cost/resource use for this assessment is $0. Protect the R2/R3a/R4 sources, tests, hosted artifacts, Actor and historical record. Any future hosted experiment requires its own bounded TID and explicit owner approval.

### Primary source references

- [Node v20.20.2 Undici fetch implementation](https://raw.githubusercontent.com/nodejs/node/v20.20.2/deps/undici/src/lib/web/fetch/index.js) (`actualFetch`, signal abort handling, `abortFetch`, terminated listener and `onAborted`).
- [Node v20.20.2 Fetch Response implementation](https://raw.githubusercontent.com/nodejs/node/v20.20.2/deps/undici/src/lib/web/fetch/response.js) (body getter and inner response-body state).
- [Node v20.20.2 Web Streams implementation](https://raw.githubusercontent.com/nodejs/node/v20.20.2/lib/internal/webstreams/readablestream.js) (locked-stream cancellation, stream error and reader settlement).
- [Undici v6.24.1 DiagnosticsChannel documentation](https://raw.githubusercontent.com/nodejs/undici/v6.24.1/docs/docs/api/DiagnosticsChannel.md) (public request-level diagnostics; no internal stream/reader transition).
- [Node v20.20.2 global fetch documentation](https://nodejs.org/download/release/v20.20.2/docs/api/globals.html#fetch) (global fetch implementation and bundled Undici version identification).

### Owner decision

The owner approved this single 30-minute read-only source assessment and its stop routes on 2026-10-07. It began at 16:58:39 UTC and resumed at 17:36:42 UTC; 15 minutes were conservatively charged before interruption, and 8 minutes 25 seconds elapsed in the resumed window. The interruption gap is excluded. The assessment ended at 17:45:07 UTC after 23 minutes 25 seconds were charged against the 30-minute maximum. It completed validly with the precise internal-state/observer-ordering gap documented in `experiments/r5-runtime-abort-assessment/evidence-r5-source-trace.md`. It establishes no root cause and authorizes no hosted follow-up; Area B remains Inconclusive / Hold.

## B2-R6 — conditional dependent abort-signal bridge observation

**Status:** Original R6 sequence approved and executed; first build attempt ABORTED before final image. Separately approved additional build succeeded and exact-runtime/offline observer gates passed. Sole conditional run was ABORTED after initial access verification failed; zero dataset rows and zero markers, no publisher diagnostic evidence. R6 Inconclusive / Hold; original R6 build/run authority consumed. Proposed additional run-only attempt on the exact verified build is DRAFT / OWNER APPROVAL REQUIRED / NOT EXECUTED.

**Operational outcome:** The first verified 11-file upload led to build FkSA4NwJQrud5GPAe / 0.10.5, which was ABORTED after 0.812 seconds by locale-sensitive monitor parsing before final image/runtime/offline results. The separately approved additional build jTISNSBR4pHb0R70e / 0.10.6 succeeded in 11.162 seconds at reported charge $0.002480444444444445, with image digest fa0cfbe0c74d6f9caa50fe75bff78de5b6a40a8c14510cae617c6b56ea6457ff. Final-image output verified Node v20.20.2 / bundled Undici 6.24.1; the offline observer gate passed (1,100 measured calls; max two getter reads; gross overhead screen passed). The one conditional run b66C26fuXBDubmxM2 used this image and approved 512 MiB / 900-second / $0.10 run-only settings. Initial run access update sent isPublic=false and returned HTTP 200, but same-ID readback remained FOLLOW_USER_SETTING; the gate failed and the run was ABORTED after 1.1 seconds. A corrected generalAccess=RESTRICTED update and same-ID readback were confirmed only after terminal status and do not retroactively pass the gate. The run wrote zero dataset rows, had zero marker records, and yielded no publisher diagnostic evidence; reported usage was $0.00008055555555555556. Stored input canonical JSON preserved all 100 ordered IDs and URL fields with 95 unique publisher URLs; byte counts (client 96,589; stored 84,364; reported inputBodyLen 84,264) differ and remain unexplained. Classify R6 Inconclusive / Hold, as an operator access-gate failure rather than runtime/source evidence. Evidence: experiments/r6-dependent-signal/r6-build-evidence-0.10.6.json and r6-run-evidence-b66C26fuXBDubmxM2.json.

### Objective and why this experiment is proposed

Determine whether the Actor's existing abort signal propagates to the dependent signal created by the fetch attempt associated with an HTML body read that remains pending after abort. R4 observed application-level body-read and `reader.closed` flags but did not observe the dependent signal used inside Undici. R5 traced exact-version source behavior but could not observe the private transition. The proposed observation covers only the source-to-dependent signal bridge. It does not observe Undici's later `terminated` event, `onAborted`, `controller.error`, or settlement of the Actor's reader promises, and cannot establish a root cause by itself.

R4 remains the comparison baseline: candidate source was prepared from historical R2 source commit `2694b1162c90bf93a4e36db4fa3cb0d4e0800a7e`; local preparation commit `d967c8480c8e1d4ce39d37049975a3215fbee2f9`; last published preparation commit `8add2cbe50f83dc158a92e6ca6f303698fffa860`; `main.mjs` SHA-256 `f8996636fafa6dc4d662b5d7bfcf4c61e134e29d48363b7081689eba91c064a1`; frozen input SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01` (96,589 bytes, 100 rows, 100 unique row IDs, 95 unique publisher URLs); direct version-upload payload SHA-256 `7bab564029d9d5dcc0518adfa08cce490ce5ec74d81ddf3c9dd6001abeee4f9c`. R4 build `4fIEXQuafIexpToxV`, version `0.10.4`, succeeded; final image digest `79cbddf7be1066a84ff2c156fe8a023f67d6ffb9d0c0668d5b977077174dd805`; its stdout runtime probe reported Node `20.20.2` / bundled Undici `6.24.1`. R4 run `XoTyJgwLo1x2KMa7g` used that image and input, was private, and timed out after 899.757 seconds with 97 rows. It recorded 79 `body_read_entered` attempts, 76 settled and three pending in finite snapshots; the separate 75 eligible-HTML fetch outcomes and 74 extraction-success statuses are not readability judgments. Evidence is `experiments/r4-hosted-body-read/results-r4-operator-evidence.json` and `experiments/r4-hosted-body-read/markers-r4-sanitized.jsonl`. The R4 run had no final summary; conclusions remain limited to last observed events.

Exact-version source supports testing this narrow bridge: the Request constructor creates a dependent signal and its public `Request.prototype.signal` getter returns it; Node exposes the same shared Request implementation to global fetch, which constructs Request synchronously before returning the fetch Promise. Internal redirects reuse a Request, while the Actor's manual redirects invoke fetch again. These facts make capture during the existing synchronous fetch call a candidate correlation point, but R4 did not wrap or validate this getter. They do not prove the getter call sequence, identity, or timing in an R6 candidate; those are gates to verify, not assumptions to report as observations. Pinned source references are listed below.

### Proposed observer and invariants

After owner approval only, copy the exact R4 candidate into `docs/changes/41/experiments/r6-dependent-signal/actor/` and make only the approved diagnostic change. Target the existing private Actor ID `JIogcgdHyCqAMHQ1P`, Actor version `0.10`, with the distinct build tag `issue41-b2-r6`. Preserve the R4 candidate, source history, Actor name, global default run options, visibility, pricing, and R2-R5 artifacts. Do not substitute current repository HEAD for the R4 candidate. Before any build, verify and record full source, lock/config, input, and upload-file hashes against the R4 evidence.

Install a descriptor-preserving wrapper around the exact shared `Request.prototype.signal` getter in the experimental Actor. Call the original getter with the same receiver; return the identical object or propagate the identical thrown value; preserve the descriptor's setter, enumerability, and configurability. During each existing synchronous global `fetch(...)` call only, push a reentrant `{rowId, attemptOrdinal}` capture frame, call the original fetch, and restore the prior frame in `finally` before the existing code awaits the original Promise. Outside a capture frame, forward only. Do not add AsyncLocalStorage, an asynchronous wrapper, a listener, an extra signal getter read, an extra fetch/read/cancel/await, a race, or a timer.

Within the synchronous frame, count getter invocations and deduplicate the returned dependent signal by object identity. Exact source has two `Request.signal` getter access sites before the fetch Promise returns: an already-aborted check and abort-listener registration. Branches may not both execute for every call, so two is a maximum, not a fixed expected count. The offline preflight must record the per-frame read-count distribution and maximum and verify no frame exceeds two. Runtime counts are 0, 1, or 2; a valid eligible capture has at least one getter read, exactly one unique dependent signal, and that object differs from the Actor's source signal. Zero reads or a missing/non-unique eligible capture is `Unknown` / Hold. If a frame observes a third or later getter read, saturate its count at `3+`, set capture status to `Unknown` with an overflow indication, preserve exact forwarding, and route to Hold; if a hosted run is already active, the operator may best-effort abort that same run. The wrapper must always invoke the original getter with the same receiver and return its identical value or propagate its identical throw, including after the counter saturates. Never omit or silently cap the over-limit condition. Retain only a `WeakRef` after the synchronous call; keep at most 600 weak references and release row references at row terminal. If dereferencing has cleared, record `Unknown`, never `false`. Capture status, getter-read count, unique-signal count, weak-reference availability, the actual Actor source signal's `.aborted`, and the dereferenced dependent signal's `.aborted` (when available) only in existing request-end, 2-second/30-second post-abort snapshot, and terminal-summary records. Do not log signal identity, reason, URL, headers, content, or other request data. Do not add a record or timer for this observer; preserve existing R4 row and run marker limits.

The wrapper changes a shared Request prototype for the Actor process lifetime even though collection is restricted to a short synchronous stack frame. Restore the original property descriptor at normal terminal completion and in best-effort final cleanup. If the prototype differs from the expected shared object, capture leaks outside a frame, getter forwarding changes identity/throw behavior, or cleanup cannot restore the descriptor, the observer is invalid and the run must stop/route to Hold.

### Ordered gates and bounded sequence

1. **Owner approval and lineage:** The owner approved this complete proposal on 2026-10-07 by replying “ok go ahead.” Candidate preparation may proceed by copying the exact R4 source candidate and frozen `input-acceptance.json` to a new R6 directory, verifying the full R4 source/input/config lineage and hashes, and recording only the getter-wrapper delta. Preserve the R4 and R2 source trees.
2. **Offline observer and overhead gate:** Use exact Node `20.20.2` / bundled Undici `6.24.1`; local Node `20.19.0` does not satisfy this gate. If an existing local runtime with both exact versions is verified, run the offline check there after approval and before building. Otherwise run it in the final Docker build stage as part of the single monitored build attempt, before any publisher request. Use only `data:` fetches, so the check makes no publisher or external network request. Confirm the data URL invokes the same synchronous global Request getter; record the per-frame getter-read distribution and maximum, verify no frame exceeds two reads, and verify eligible captures deduplicate to one dependent signal. Otherwise stop and do not claim the observer is validated. For baseline and instrumented variants, perform 100 warmups each, then 10 alternating pairs of 100 calls per variant, reversing variant order each pair. Measure monotonic time over the whole synchronous original fetch call, from entry until its original Promise is returned; drain all promises outside timed sections. Compare paired per-call deltas and record p95, p99, mean, sum, and maximum. Proposed gross-overhead screen: paired p95 added time at most 1 ms/call and p99 at most 5 ms/call. These percentile thresholds do not bound the maximum, the tail of a real 600-call run, or perturbation of the 10-second request timeout and are not production guarantees. If all six calls in a row hypothetically incurred the p99 threshold, their arithmetic sum would be 30 ms; this is only an illustration, not a bound on a row tail or live run. A 600-call mean illustration at 1 ms/call is 0.6 seconds; report measured mean, sum, and maximum rather than presenting illustrations as bounds. Stop at five minutes or if the `data:` path does not exercise the same getter. The five-minute limit applies only if the check can finish within the remaining single-build guard; at the 120-second build deadline the build guard wins, the operator issues the one best-effort abort, and no run follows. This gate is diagnostic plumbing/overhead validation, not a reproduction.
3. **Evidence-cap gate:** Serialize worst-case enriched records as UTF-8 including newline. Prove every record remains at most 768 bytes, all records remain within 4 MiB total and the 4,006-record cap, and the existing 40-record-per-row budget remains sufficient with reserved overflow/terminal capacity. If not, stop and return to TID review; do not drop required fields, raise caps, or add records silently.
4. **One monitored build:** After source, local-runtime-if-available, and evidence-cap gates pass, allow exactly one build attempt for Actor `JIogcgdHyCqAMHQ1P`, version `0.10`, tag `issue41-b2-r6`. If the exact-runtime offline check could not run locally, execute it in this build's final Docker stage; the check is part of this one build, not a second build. Poll every 10 seconds. If still nonterminal at 120 seconds, check once more, issue one best-effort abort, and observe up to 120 seconds more. No retry; an unresolved, failed, or offline-check-failing build stops before any publisher request. The five-minute microbenchmark cap does not extend or reset this single 120-second outer build guard. If the build guard expires while the microbenchmark is still running, abort the build best-effort and do not start a run; do not start another build. Verify source/config/input identity, final image digest, and actual Node/Undici runtime before a hosted run. The build has no hard dollar cap; its cost is separate from the run cap, and build abort is best effort.
5. **One conditional private run:** Only if all prior gates pass, allow one private API run with the exact R4 100-row input; 512 MiB; 900 seconds; concurrency 4; 10-second row HTTP-chain timeout; 2 MiB body cap; at most five redirects after the first request; at most six GET attempts per row and 600 planned GETs; and `maxTotalChargeUsd=0.10`. The run cap applies only to the run, not the build. Do not change Actor name/defaults/visibility/pricing, deploy to production, make an unchanged retry, or send extra publisher requests.
6. **Audit and record:** Verify candidate/build/image/run/input lineage, runtime, marker sequence and caps, getter capture counts and identity requirements, WeakRef availability, actual source/dependent abort states, eligible HTML count, dataset, run status, and separate build/run charges. Record only direct observations. A missing run summary limits the conclusion to last observed events.

### Interpretation and stop routes

- A correctly paired pending body-read attempt with source signal `aborted=true` and dependent signal `aborted=false` at both existing snapshots supports an observed source-to-dependent bridge gap through the later observation only. It does not explain why, prove what Undici did next, or establish root cause.
- Source `false` then dependent `true` at the later sample supports only delayed propagation between those samples.
- Both signals `true` at a sample show that the bridge had propagated by that sample. They do not establish Undici's internal `terminated` or `controller.error` path, reader promise settlement, or a product outcome.
- Cleared WeakRef, missing or multiple unique signals, dependent/source identity collision, wrong attempt association, scope leakage, capture mismatch, delayed/missing snapshot, evidence overflow, runtime/source/input mismatch, fewer than 70 eligible HTML body-read attempts, or no pending row makes the evidence Inconclusive / Hold. Do not infer negative propagation from missing capture.
- A run timeout, absent summary, or missing terminal counters restricts claims to last observed events. The >=70 eligible HTML attempt threshold is the R4 operational screen, not a guarantee of identical live publisher responses. The 95/100 resolution and 50/100 independently readable article targets remain unassessed by this diagnostic.
- If the observer is globally unusable, incurs material overhead, changes getter semantics, cannot stay within the evidence budget, or fails its stop gates, stop; if a hosted run is already active, the operator may best-effort abort that same run and record the route. No retry, second build, changed row path, internal-event hook, or deeper probe is authorized by this draft.

### Owner approval and execution authority

Issue #41 asks for at least 95/100 resolved Google News URLs and at least 50/100 independently readable articles; URL resolution reached 100/100, while readable full text remains unproven. The original 0.8.1 / 256 MiB SIGKILL after 10 rows remains distinct. R3a is Inconclusive / Hold and R3b is ineligible. R4 timed out at 899.757 seconds with 97 rows and no run summary; three rows had pending app-observed body-read flags at finite snapshots. R5 exact-runtime source assessment did not identify which private abort path ran. R6 observes only the source-to-dependent-signal bridge. Its first build attempt was ABORTED before a final image/runtime/offline result. The separately approved additional build jTISNSBR4pHb0R70e / 0.10.6 succeeded and passed the exact runtime probe and offline observer gate. The sole conditional run b66C26fuXBDubmxM2 was ABORTED after initial run access remained FOLLOW_USER_SETTING; a later RESTRICTED update was confirmed only after terminal status. It produced zero dataset items and no marker evidence. R6 remains Inconclusive / Hold; the approved build/run sequence is consumed.

The original R6 approval covered candidate preparation, one monitored build, and one conditional run only if all gates passed. The first build attempt was prematurely aborted. A separate owner-approved additional attempt then built and passed the exact runtime/offline gates, but its sole run was aborted when the required initial access check failed. No publisher diagnostic requests were evidenced. The current proposed next step is limited to one further run-only attempt against the exact verified 0.10.6 build, with no new build, upload, source edit, or input change. It remains unapproved and cannot run until explicit owner approval and the same-ID RESTRICTED readback gate.


**R6 execution record:** The approved additional build jTISNSBR4pHb0R70e / 0.10.6 succeeded in 11.162 seconds at reported cost $0.002480444444444445; image digest fa0cfbe0c74d6f9caa50fe75bff78de5b6a40a8c14510cae617c6b56ea6457ff. Its final-image probe reported Node v20.20.2 / Undici 6.24.1. The offline data-URL observer gate passed: 1,100 measured calls, maximum two getter reads, gross p95/p99 overhead screen passed. The one conditional run b66C26fuXBDubmxM2 used this image, 512 MiB / 900 seconds and a $0.10 run-only cap. Initial access update sent isPublic=false and returned HTTP 200, but same-run GET still reported FOLLOW_USER_SETTING, so the initial privacy gate failed and the run was aborted after 1.1 seconds. After terminal status, a corrected generalAccess=RESTRICTED update and same-ID readback succeeded; this does not retroactively pass the initial gate. The run produced zero dataset items, zero markers, no publisher diagnostic evidence, and reported total usage $0.00008055555555555556. The canonical input semantics matched all 100 ordered IDs and URL fields with 95 unique publisher URLs; client-vs-stored byte counts differed (96,589 vs 84,364; server inputBodyLen 84,264) and remain unexplained. Result is operational Inconclusive / Hold, not an Actor-source/runtime finding. Evidence: experiments/r6-dependent-signal/r6-build-evidence-0.10.6.json and r6-run-evidence-b66C26fuXBDubmxM2.json. The corrected run-access payload/readback helper and offline check are experiments/r6-dependent-signal/r6-run-access-gate.psm1 and r6-run-access-gate-check.ps1; the check passed without network/API/run calls.

### R6 further run-only checkpoint — DRAFT / OWNER APPROVAL REQUIRED / NOT EXECUTED

The previous R6 approval is consumed. A possible next step is one additional private run using only the already verified build jTISNSBR4pHb0R70e / 0.10.6 and the exact frozen R4 input; no new build, upload, source edit, or input change is proposed. Before a run POST, send the documented run-access payload generalAccess=RESTRICTED, then GET that same run ID and continue only if the returned data.generalAccess is exactly RESTRICTED. Any request error, missing field, wrong run ID, or other access value means Hold and no publisher request. If this preflight passes, one run may use the approved 512 MiB / 900 second settings, concurrency 4, existing 10-second HTTP-chain timeout, 2 MiB body cap, at most five redirects after the first request, at most six GET attempts per row / 600 planned GETs, and maxTotalChargeUsd=0.10. This is only a proposal; the prior run-access failure produced no experiment result and the existing approved authority does not cover this extra run. Owner approval is required before execution. Issue #41 remains open; Issues #4 and #5 remain blocked.
Primary evidence: `experiments/r5-runtime-abort-assessment/evidence-r5-source-trace.md`, `experiments/r4-hosted-body-read/results-r4-operator-evidence.json`, and `experiments/r4-hosted-body-read/markers-r4-sanitized.jsonl`. Exact Node v20.20.2 source references: [Request implementation](https://raw.githubusercontent.com/nodejs/node/v20.20.2/deps/undici/src/lib/web/fetch/request.js) (constructor/dependent signal lines 359–405; public signal getter 671–679), [Node Request exposure](https://raw.githubusercontent.com/nodejs/node/v20.20.2/lib/internal/bootstrap/web/exposed-window-or-worker.js) (70–74), [fetch implementation](https://raw.githubusercontent.com/nodejs/node/v20.20.2/deps/undici/src/lib/web/fetch/index.js) (synchronous Request construction and signal access 122–149, 169–187; internal redirect reuse 1109–1236), and [Web Streams implementation](https://raw.githubusercontent.com/nodejs/node/v20.20.2/lib/internal/webstreams/readablestream.js) (locked stream behavior 2719–2733). The R4 Actor's manual fetch path is `experiments/r4-hosted-body-read/main.mjs:607–635`. The exact R4 source, build, run, image, input, and runtime identities above are the comparison baseline; they are not R6 execution evidence.
