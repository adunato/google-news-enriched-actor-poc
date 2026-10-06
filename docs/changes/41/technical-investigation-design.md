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

Establish whether the lightweight hosted Actor can fetch public publisher pages and extract readable article text for at least **50/100** rows in the representative mixed-publisher sample.

### Existing evidence and why this area is needed

- Publisher-page HTTP access in the hosted runtime is partial rather than universal.
- There is not yet current representative hosted evidence proving the **50/100** readable-text target through the approved production path.
- Access and extraction must be measured separately so an inaccessible page is not misclassified as a parser failure.

### Success criteria for this investigation area

At least **50/100 retained rows** in the defined representative sample must produce non-empty readable article text with a consistent success status and word count.

Failures must remain row-local and distinguish publisher-access failures from extraction failures.

### Experiment sequence

<!-- prettier-ignore -->
| Order | ID | Experiment | Purpose | Run when | Next if successful | Next if unsuccessful |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | B1 | Measure current publisher-page access | Establish whether enough usable publisher HTML exists to make the 50/100 target possible | **Always first after Area A** | B2 if at least 50 rows provide usable HTML | Stop / return publisher-access boundary |
| 2 | B2 | Extract with structured data plus Mozilla Readability | Test the primary lightweight extraction path on accessible HTML | **Only if B1 shows at least 50 usable HTML rows** | Area B feasible | B3 only if extraction quality, rather than access, is the remaining blocker; if the candidate emits no usable experiment evidence, apply the single-run B2-D1 amendment below |
| 3 | B3 | Test one alternative generic Node-native extractor | Check whether the remaining shortfall is specific to the primary parser | **Only if B2 misses because of extraction quality on accessible HTML** | Area B feasible | Stop / return extraction or architecture limitation |

The table is the controlling procedural view for this area. Detailed experiment sections below explain each experiment; they do not change the sequence or trigger rules above.

### Experiment B1 — Measure current publisher-page access

**Objective**  
Measure how many representative publisher pages are actually available to the hosted Actor before evaluating any parser.

**Why this experiment exists**  
The full-text target cannot be met if fewer than 50 representative rows provide usable publisher HTML. Access must therefore be measured before parser quality.

**Test**  
Using the defined representative publisher-URL sample, perform bounded ordinary HTTP fetches in the normal Apify Actor runtime.

Do not run article extraction yet. Classify each row by access outcome.

**Measures**

- successful HTML fetches out of 100;
- HTTP denial/error/timeout/robots or other access classes;
- content type and whether the body is eligible article HTML;
- request/runtime bounds.

**Execution rule**  
**Always run before B2.**

**Decision / next step**

- If fewer than 50 rows provide usable article HTML, stop Area B and return the publisher-access boundary.
- If at least 50 rows provide usable article HTML, proceed to **B2**.

### Experiment B2 — Extract with structured data plus Mozilla Readability

**Objective**  
Determine whether a simple Node-native extraction path can meet the product target on publisher HTML that is actually accessible.

**Why this experiment exists**  
The useful question is how a lightweight generic extraction path performs on representative hosted HTML, not whether it can parse synthetic content.

**Test**  
For rows successfully fetched in B1:

1. use useful structured article data already present in the HTML when available;
2. otherwise run Mozilla Readability on the already-fetched HTML;
3. apply explicit bounded input/runtime guards;
4. score the output for non-empty readable article text and consistent word count/status.

The extractor must not perform its own hidden network retrieval.

**Measures**

- readable-text successes out of the full 100-row sample;
- readable-text successes out of successfully fetched eligible HTML;
- structured-data successes versus Readability successes;
- extraction failures by class;
- extraction time and material runtime/cost.

**Execution rule**  
Run **only if B1 shows at least 50 rows with usable article HTML**.

**Decision / next step**

- If at least **50/100** rows produce readable text, Investigation Area B is feasible.
- If the target is missed mainly because publisher pages could not be fetched, stop. Do not change extractor.
- If enough HTML was fetched to make 50/100 possible but extraction quality is the demonstrated remaining blocker, proceed to **B3**.

### Experiment B3 — Test one alternative generic Node-native extractor

**Objective**  
Determine whether the remaining extraction shortfall is specific to the primary parser rather than a general limitation of the accessible HTML.

**Why this experiment exists**  
An alternative extractor only has information value when B2 has already shown that enough publisher HTML is accessible but the primary extraction path is the limiting factor.

**Test**  
Select one credible generic Node-native extraction algorithm with a materially different parsing approach.

Run it against the **same already-fetched HTML cohort** and score it with the same success rules used in B2.

Do not add publisher-specific rules or another runtime/service.

**Measures**

- readable-text successes out of 100;
- incremental successes over B2;
- regressions versus B2;
- extraction time and material runtime/cost.

**Execution rule**  
Run **only if B2 misses because of extraction quality on accessible HTML**.

**Decision / next step**

- If the supported path reaches at least **50/100**, Investigation Area B is feasible.
- If it remains below 50/100, stop and return the specific limitation. Any heavier mechanism requires a Product/Architecture decision.

### Approved amendment — B2-D1 single diagnostic execution

**Approval and scope**
The project owner approved this amendment on **2026-10-05** after reviewing the Experiment Viability Checkpoint. It authorizes exactly one changed B2 candidate build and one private hosted run, identified as **B2-D1**. It does not authorize a second diagnostic or corrective run, a new extraction approach, or any change to the product acceptance criteria.

**Why this amendment is needed**
The first B2 candidate was reported as successful by the platform but produced zero dataset items, no cached-text evidence, and only startup log output. The cause was not established. This amendment adds bounded startup-stage evidence so the one permitted candidate can distinguish the fixture/hash/count gates, prior-run storage access, row processing, and dataset writing without changing what B2 extracts or how its result is scored.

**Candidate changes permitted**
On the existing B2 probe only, add sanitized stage markers around fixture read/hash/count checks, opening the B1 key-value store, entering/completing the 100-row loop, and beginning/completing the dataset write. Add fatal-error reporting that records the current stage and safe error classification, sets a failing process exit code, and never includes credentials, publisher response bodies, or extracted text. Make only the package/Actor version bookkeeping needed to identify the changed candidate. Do not change the parser, dependencies, runtime, input sample, 53 cached HTML objects, per-row processing, limits, scoring, output schema, or provenance fields.

**Run rule and evidence**
Run B2-D1 exactly once on the existing private Node.js 20 Actor under the original memory and timeout settings, using the byte-identical 100-row B2 fixture and only the 53 exact B1 response bodies in the existing B1 key-value store. No publisher or Google News fetch is permitted. Retain the exact candidate/build/run identity, sanitized logs, full 100-row outcome evidence, dataset and text-key inventory, runtime and final platform cost. Verify the sample hash, all 100 row mappings, and each cached body’s exact byte count and SHA-256 against B1. Retained article text remains private in run storage and must be reviewable for the 50/100 readability assessment.

**Decision after the one run**

If the run produces valid B2 evidence after verified cached HTML was meaningfully processed, classify the B2 result against the existing 50/100 target and resume the original TID route after validation. B3 is eligible only when that valid evidence demonstrates an extraction-quality shortfall on accessible HTML. Startup, source-store, cache-integrity, transport or other processing errors do not establish extraction quality, even if represented by 100 row-level failures; record them and stop. If the run does not produce valid B2 evidence or the cause remains unclear, record the boundary and stop. No further B2 diagnostic, unchanged rerun, corrective rerun, or B3 run is authorized by this amendment.

### Approved amendment — B2-S1 single-record cached-body access witness

**Status and authority**

**Owner-approved 2026-10-06 for exactly one private diagnostic build and hosted run.** This approval is separate from the original bounded B2 sequence and the completed/exhausted B2-D1 amendment. It covers only the resource and request envelope below and acknowledges the modeled standard-rate charge and its uncertainty. No repeat, repair, additional key, extraction, B2 resume or B3 run is authorized by this amendment.

**Question and rationale**

Can the existing private Actor identity read one known, previously retained B1 HTML record through the official Apify JavaScript client, and does the returned byte buffer match the exact B1 body length and SHA-256? B2-D1 stopped while opening the B1 store, before any body was read. This proposal tests one metadata read and, only if the store exists, one fixed-record read. It does not repeat B1's publisher-access experiment.

**S0 — local reconciliation before any hosted action**

Re-read the retained B1 result, B1 key manifest and frozen B2 fixture locally. Confirm that the B2 source-store ID and source-run ID match B1, the fixture's byte hash matches its pinned value, it contains exactly 100 unique row IDs, its 53 eligible HTML references map one-to-one to the corresponding B1 rows, and their key, expected body length and SHA-256 values match. Select the first eligible row in frozen sample order as the deterministic witness. Any mismatch ends the proposal before a hosted request.

The local preparation completed on 2026-10-05 with no B1/B2 mapping or expected body-metadata mismatch: the B2 fixture hash is `8bb9facc14fd7a5755c9337f7d9864ba6fb7958a44d6ae654b8e17ee84f63c8c`; the B1 source run/store IDs agree (`g7ndwu3G1M4orPt2h` / `C1KYtogOgGpkRyF2H`); all 100 row IDs are unique; and all 53 eligible row references match their B1 results. The deterministic witness is row `q1-gb-01`, key `B1_HTML_q1-gb-01`, expected body length `435577` bytes and SHA-256 `6f8d86bc1f95de5b118a55e4d4d89c39cf38a94c3ca9f5319e135dd357841dd9`. B1's manifest records a smaller storage size (`51179` bytes) for that key; this is not the response-body length and must not be compared as if it were raw body bytes. No live API or Actor call was made for S0.

**S1 — approved single private execution**

The owner approved on 2026-10-06 exactly one build and hosted run of existing private Actor `JIogcgdHyCqAMHQ1P`, using the same Node.js 20 runtime and unchanged pinned packages. Use `Actor.newClient({ maxRetries: 0, timeoutSecs: 5 })`. First call `.keyValueStore(sourceStoreId).get()` once. If metadata confirms the store exists, call `.getRecord(fixedKey, { buffer: true })` exactly once for the S0 witness. Treat `record.value` as the returned Buffer; compare `record.value.length` and the SHA-256 computed over `record.value` to the B1-recorded values, and retain the returned content type when present. Apply a 2 MiB maximum body bound. Configure and verify the actual run metadata at 256 MiB and 900 seconds; the invocation must pass an explicit 900-second timeout rather than rely on the platform default. Use an explicit `Actor.exit({ exitCode })` so a failed observation cannot be reported as a successful run.

The S1 ceiling is at most two read-only KVS API requests, zero retries, five seconds per request and ten seconds total client-request time. Perform no `Actor.openKeyValueStore`, `getOrCreate`, store creation, publisher or Google News fetch, extraction, dataset write, new credential/permission request, package/dependency change or security harness. Do not retain or log the body, credentials, signed URLs, request headers or response contents. Retain only run identity/status, actual resource settings, request counts/timing, sanitized outcome/error class/status, and the fixed row/key plus expected and observed body length/SHA-256 and returned content type when present, needed to judge the witness.

**Cost model and approval requirement**

Using Apify's public Free/Starter rates checked 2026-10-05, the maximum 256 MiB × 900 second allocation is `0.0625 CU`; at `$0.20/CU`, that is `$0.0125` compute. Two key-value reads at `$0.005/1,000` add `$0.00001`. A response transfer of up to 2 MiB at `$0.05/GB` internal transfer is approximately `$0.000098`. The modeled standard-rate charge is approximately **$0.0127** for the stated run and request envelope. Public rates and resource-unit behavior are described at [Apify pricing](https://apify.com/pricing) and [Actor usage and resources](https://docs.apify.com/actors/running/usage-and-resources).

This is an estimate, not a guaranteed total charge or enforced cap. The account's actual tariff is unknown, and metadata transfer, build, storage retention or other account-specific usage may add charges. The owner approved the one-run envelope while acknowledging the modeled approximately `$0.0127` standard-rate charge and these uncertainties; no additional numeric spend ceiling is required by the TID controls.

**Outcomes and stop rule**

Classify exactly one terminal outcome: `actor_startup_error`; `store_absent`; `access_denied` (record safe HTTP status if available); `metadata_error`; `record_missing`; `record_error`; `request_budget_stop`; `request_budget_exceeded`; `body_over_limit`; `hash_mismatch`; `diagnostic_error`; or `read_witness` (expected byte length and SHA-256 match; record returned content type when available). Stop after this S1 observation for every outcome. If local S0 fails, make no hosted request. If S1 returns `read_witness`, it proves access only to this one record at that time; it does not prove that all 53 records are accessible, that B2 can resume, that article text is readable, or that the 50/100 target is feasible. If S1 fails, the cause remains bounded to the observed outcome; do not repair, retry, probe another key, process the cache, run B2/B3, or add a further step without a later approved design decision.

**Execution outcome (2026-10-06)**

The single approved build and run completed. The first source-store metadata request returned `access_denied` with HTTP 403 and sanitized API type `insufficient-permissions`; the fixed-record request was not made. Classify B2-S1 **Inconclusive** for the record-witness question and stop. This observed denial is not evidence that the store or record is absent, does not establish whether B2-D1 failed for the same reason, and does not measure extraction quality. The one-run authorization is exhausted; no permission change, retry, B2 resume, B3 or corrective run is authorized. Detailed sanitized evidence is retained under `docs/changes/41/experiments/b2-s1/`.

### Approved amendment — B2-P1 read-only ownership/access-grants comparison

**Approval and scope**

On **2026-10-06**, the owner approved one bounded, read-only metadata comparison following B2-S1, under the Technical Spike method. It does not reopen B2 extraction or authorize an Actor build/run, a key-value record read, a source write, an access/permission change, a new credential, or a new login. The amendment is limited to the existing configured Apify account credential and the two metadata GETs below, followed by a conditional single Console share/settings view only if API metadata is successfully retrieved but does not expose the relevant individual grant context. The Console view will be assigned separately by Main after reviewing the API outcome; this executor must stop before UI access.

**Question**

Can read-only Apify metadata for the failed S1 run and its B1 source key-value store show whether the resource ownership and exposed general-access settings align with the identities involved? This may contextualize the S1 `insufficient-permissions` response. It cannot establish why the prior Actor request was denied, whether a body can be read, or whether extraction works.

**Bounded execution**

Use the existing Apify JavaScript client version `2.25.0`, pinned by the B2-S1 dependency lock, with the normal, previously configured account credential only. Capture that credential from the existing CLI secure account configuration in memory; never print, log, write or otherwise retain it. Configure `maxRetries: 0` and `timeoutSecs: 5`. In order, make at most these two explicit GET requests and stop the sequence on any denied, unavailable, empty, mismatched or unexpected response:

1. `GET /v2/actor-runs/hr2WzjPcLnZgHQYmZ` — retain the expected run ID, returned Actor ID, status, and any permission/general-access field actually exposed. Compare its user ID in memory with the store owner ID; persist only stable SHA-256 identifiers and the equality result, never raw user IDs.
2. Only after a valid matching run response, `GET /v2/key-value-stores/C1KYtogOgGpkRyF2H` — retain the expected store ID, owner-ID hash, Actor ID, originating Actor-run ID, and the observed general-access field, preserving `null` distinctly from an unexposed field.

The two explicit API GETs together have at most ten seconds of configured request timeout. Console navigation can make additional UI requests, so no hard network-request cap is claimed for its conditional step. Record each SDK request outcome and elapsed time without inventing an HTTP success status where the client does not expose one. Filter API responses before persistence: do not retain usernames, email addresses, auth headers/tokens, signing keys, signed/public URLs or other unrelated fields. Do not infer that an absent ACL field means there are no individual grants. If the two metadata responses succeed but the applicable grant context remains unknown, Main may assign one attempt to view this store's access/share settings through the existing authenticated Console session. Follow the documented Store detail page → Actions → Share path; the view may inspect only access/share settings, not key lists, records or body previews. It may not change grants, invite users, retain personal grant details, use another account/login or expand into account inventory. Do not perform that view in this execution. See [Share storage](https://docs.apify.com/storage/share) and [Grant access rights](https://docs.apify.com/account/collaboration/access-rights).

**Stops, evidence and cost**

No retries, other account, login, fallback credential, additional endpoint, resource inventory, KVS record/key request, dataset/log query, build, hosted run, publisher/Google News request, extraction, permission update or credential change is allowed. Any missing field or unsupported context remains `unknown`; every failed API step stops immediately and is recorded as observed. A successful pair means only that this configured account could retrieve those metadata responses at that time. It does not establish record/body access or explain the S1 run-level denial. Record endpoint, request count/timing, response classification/status only where actually exposed, IDs needed for resource correlation, hashed user identities and comparison booleans. These are metadata reads with no Actor compute allocation; exact account/API charges are unknown and are not represented as zero or guaranteed free. Official endpoint references: [Get run](https://docs.apify.com/api/v2/actor-run-get) and [Get store](https://docs.apify.com/api/v2/key-value-store-get).

**Readiness gate and routing**

Before the first live request, record this approval and complete local syntax, dependency and boundary-conformance checks for the isolated helper. The executor must then report exact files/checks and await Main's internal Validator/readiness confirmation. After the authorized GET sequence, stop and report the evidence. Main may assign the single conditional Console settings/share view only if both API responses were available and individual grant context remains unknown. Otherwise stop at the observed outcome. No result resumes B2, permits B3, authorizes a record read, or establishes the cause of D1/S1; any further investigation requires a separate owner decision and design.

**Execution outcome (2026-10-06; API portion)**

After the local readiness gate, both approved metadata GETs returned SDK response objects in the required order (526 ms for the run, 127 ms for the store; no raw HTTP success code was exposed by the client). The run identity and Actor ID matched the expected S1 values and status was `FAILED`; the client did not expose a separate run permission-level field. Run-resource and store `generalAccess` were both `FOLLOW_USER_SETTING`: each inherits the account-level general visibility setting, whose effective value was not observed. The run `generalAccess` field describes run-resource sharing, not the Actor's runtime permission. The store metadata matched the expected store ID, Actor ID and B1 creator run ID. The store owner ID hash matched the S1 run user ID hash; raw user IDs were not retained. No personal account fields, signing keys, URLs or unrelated response fields were retained. The API comparison supports ownership and creator-link alignment for the observed metadata but does not establish which exact token the S1 Actor call used, whether any individual grant exists, or why the S1 runtime request was denied. Individual grant context remains unknown. The actual `LIMITED_PERMISSIONS` evidence is separately recorded in the S1 run log. Main assigned the conditional one-view Console settings/share step to a read-only Explorer, whose preflight reported that no browser was available; after the owner availability opportunity, no browser was made available. No Console page view, login, or additional API request occurred. The conditional view is unavailable, so classify the metadata ownership comparison as Supported and the individual-grant/root-cause question as Inconclusive, then stop. No record read or extraction is authorized. See Apify's [General resource access](https://docs.apify.com/account/collaboration/general-resource-access) and [Actor permissions](https://docs.apify.com/actors/development/permissions) documentation.

---

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

The approved investigation sequence has no outstanding design questions. B2-S1 is a separately approved, one-run diagnostic amendment; it does not authorize further experimentation or change the extraction acceptance target.

## 8. Review and approval

**Decision:** `Approve` the original bounded experiment sequence and the separately recorded B2-D1 and B2-S1 amendments within their stated limits.

**Rationale:** The design directly covers the two blocked product capabilities, separates access from extraction, defines all bounded experiments and conditional routing, and preserves the approved lightweight architecture.

**Required follow-up before execution:** None. The single B2-S1 authorization has been exercised and is exhausted regardless of outcome.

The original approval authorises only the bounded experiment sequence and its conditional transitions. B2-D1 was separately approved for one run on 2026-10-05 and is complete/exhausted. B2-S1 was separately approved on 2026-10-06 for exactly one private build and hosted run under its fixed resource/request envelope, acknowledging the modeled standard-rate charge and uncertainty. That run is complete and the authorization is exhausted; no further diagnostic or corrective run is authorized.

**Owner approval:** Original bounded sequence approved — 2026-10-04. Amendment B2-D1 approved — 2026-10-05; its single changed private candidate build/run is complete and exhausted. Amendment B2-S1 approved — 2026-10-06 for exactly one private build and hosted run under its resource/request envelope and acknowledged modeled cost uncertainty; run `hr2WzjPcLnZgHQYmZ` is complete and the authorization is exhausted.
