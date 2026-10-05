# Technical Investigation Design: Google News publisher resolution and full-text viability

> Design for Technical Spike [**Prove Google News publisher resolution and full-text viability (#41)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/41).  
> This document defines what must be tested, why each experiment exists, what it measures, and exactly when it should run. It is not an experiment log.

**Artifact ID:** `tid-41-google-news-resolution-full-text`  
**Status:** `Approved`  
**Owner:** `Project owner`  
**Created:** `2026-10-04`  
**Updated:** `2026-10-05`
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

No outstanding investigation-design questions.

## 8. Review and approval

**Decision:** `Approve`  
**Rationale:** The design directly covers the two blocked product capabilities, separates access from extraction, defines all bounded experiments and conditional routing, and preserves the approved lightweight architecture.  
**Required follow-up before execution:** `None`

Approval authorises execution of the bounded experiment sequence and conditional transitions defined in this TID. A separate approval is not required for each experiment that remains within the approved design.

**Owner approval:** Original bounded sequence approved — 2026-10-04. Amendment B2-D1 approved — 2026-10-05; exactly one changed private candidate build/run under the limits in the amendment above.
