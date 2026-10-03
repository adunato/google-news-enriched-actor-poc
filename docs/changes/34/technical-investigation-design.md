# Technical Investigation Design: Google News access and publisher full-text

> Design for Technical Spike [**Rebaseline Google News access and publisher full-text for the publisher-URL and full-text features (#34)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/34).  
> This document explains **what is being investigated, why each experiment exists, what it measures, and exactly when it should run**. It is not an experiment log.

**Artifact ID:** `tid-34-news-access-full-text`  
**Status:** `Draft — owner review`  
**Owner:** `Project owner`  
**Created:** `2026-10-02`  
**Updated:** `2026-10-03`  
**Spike branch:** `spike/34-news-access-full-text`

## 1. What this investigation is trying to achieve

Two product features are currently blocked by live behaviour that cannot be proven with mocked tests.

### Resolve Google News links to publisher URLs (#4)

The feature [**Resolve Google News links to publisher URLs with fail-soft status (#4)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/4) must convert Google News article links into the real publisher URL for at least **95 of the defined 100 representative rows**.

The publisher-resolution mechanism itself is not the main unknown anymore. The completed investigation [**Establish reliable Google News publisher URL resolution (#14)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/14) showed that the Google News marker/RPC mechanism could produce 100/100 non-Google publisher candidates in both local Node and hosted Apify execution.

The current blocker appeared later. A controlled hosted diagnostic over 79 previously confirmed positive rows received an HTTP 302 from `news.google.com` to `consent.google.com` on every row. The run stopped there, before marker extraction or the RPC resolver could execute.

**Therefore the question for this Spike is not “can we invent a Google News resolver?”** It is:

> Can the normal lightweight hosted HTTP path reach the already-proven resolver reliably enough to run the publisher-URL feature in production-like conditions?

### Add optional best-effort article full-text extraction (#5)

The feature [**Add optional best-effort article full-text extraction (#5)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/5) must return readable article text for at least **50 of the defined 100 representative rows**.

Historical hosted evidence showed that publisher pages are partially accessible: 72/100 representative URLs returned HTTP 200 HTML. However, the previous Extractus-based experiment timed out on all 78 eligible hosted extraction attempts, while Mozilla Readability was only proven on controlled local HTML.

**Therefore the second question is:**

> Given publisher pages that the Actor can actually fetch, can a simple generic Node-based extraction path produce readable text often enough to meet the 50/100 product target?

These are separate investigation areas because failure to reach a publisher page is not the same problem as failure to extract readable content from HTML that was successfully fetched.

---

## 2. Investigation Area A — Reach the existing Google News resolver

### Objective

Establish the minimum ordinary HTTP/session behaviour required for the hosted Apify Actor to reach the already-supported Google News marker/RPC resolver, then verify that the complete publisher-URL feature can still meet its **95/100** live acceptance target.

### Existing evidence and why this area is needed

- The marker/RPC resolver has already produced 100/100 syntactic non-Google publisher candidates in hosted Apify and local execution.
- Later hosted testing did **not** reach that resolver. In the controlled 79-row diagnostic, every first Google News request redirected to `consent.google.com`.
- That means simply testing “Google News over HTTP” without explaining the historical failure would add little value.
- The first experiment below exists specifically to establish the current baseline and determine whether the consent behaviour is immediate, repeat-request/session related, or no longer reproducible.

### Success criteria for this investigation area

This area succeeds only when the production-like hosted flow:

1. reaches the existing marker/RPC resolver using the approved lightweight HTTP-first architecture;
2. retains the original Google News URL and keeps failures isolated to individual rows; and
3. resolves at least **95/100** rows in the defined live representative sample to valid non-Google publisher URLs.

If reaching the resolver requires browser automation, residential proxies, paid unblocking, or another excluded architecture change, this area stops and returns that as a Product/Architecture decision rather than silently adopting it.

### Experiment A1 — Reproduce and characterise the Google News access behaviour

**Objective**  
Establish exactly what happens today when the hosted Actor accesses known Google News article URLs, including whether behaviour differs between a fresh request and repeated requests in the same ordinary session.

**Why this experiment exists**  
Earlier hosted resolver experiments succeeded, while the later 79-row diagnostic redirected every request to Google consent before the resolver could run. We need a controlled baseline before changing anything. This experiment is therefore a **reproduction/baseline experiment**, not an attempt to prove the publisher resolver again.

**Test**  
Use a very small fixed set of previously known-good Google News article controls in the normal Apify Node 20 Actor path. Record the request sequence, HTTP status, redirect destination, ordinary cookie/session state, and whether the response reaches the page state required for marker extraction. Include both a fresh access and a bounded repeat within the same ordinary session so that a first-request/repeat-request difference can be observed rather than assumed.

**Measures**  
- request order and session state;
- HTTP status and redirect destination;
- whether `consent.google.com` is reached;
- whether the Google News marker page is reached;
- whether marker/RPC execution becomes possible;
- request count and elapsed time.

**Execution rule**  
**Always run first.**

**Decision / next step**
- If the normal path consistently reaches marker/RPC, skip A2 and A3 and proceed directly to **A4**.
- If the consent/interstitial behaviour is reproduced or access is unstable, proceed to **A2**.
- If the result differs from both historical states, record the new behaviour and use it to constrain A2; do not broaden the investigation automatically.

### Experiment A2 — Test minimal ordinary session/consent handling

**Objective**  
Determine whether standard HTTP behaviour — redirects, cookies and ordinary session state — is sufficient to pass the consent/access boundary and reach the existing resolver.

**Why this experiment exists**  
The known failure happens before the resolver starts. If A1 reproduces that failure, the next useful question is whether the missing piece is simply normal HTTP session handling rather than a new resolver or heavy anti-bot infrastructure.

**Test**  
Starting from the A1 reproduction, add only the minimum standard HTTP/session handling justified by the observed redirect flow. Keep the same small known-good controls and the normal Apify Actor runtime. Do not introduce a browser, proxy, custom egress firewall, socket interception layer, or a bespoke security harness.

**Measures**  
- proportion of controls that reach the marker page;
- proportion that reach marker/RPC resolution;
- redirect/cookie sequence required;
- repeatability within the same bounded run;
- request count, elapsed time and failure reason.

**Execution rule**  
Run **only if A1 does not already provide a stable path to marker/RPC**.

**Decision / next step**
- If the controls reliably reach marker/RPC, proceed to **A4**.
- If the failure clearly points to our own request construction rather than the external access boundary, proceed to **A3**.
- If ordinary HTTP/session handling cannot reach the resolver and the next step would require excluded heavy access machinery, stop this investigation area and return a Product/Architecture decision.

### Experiment A3 — Compare request construction with an independent implementation of the same mechanism

**Objective**  
Determine whether the remaining failure is caused by our request/session construction rather than by Google blocking the HTTP-only mechanism itself.

**Why this experiment exists**  
This is useful only if A2 suggests that the external mechanism should still be reachable but our implementation may be forming the request or session incorrectly. It is not a general library search and it does not introduce a different resolver family.

**Test**  
Compare the minimum relevant request, redirect, cookie and marker/RPC details against one maintained implementation of the same Google News marker/RPC mechanism. Re-test only the specific difference that can explain the observed A2 failure.

**Measures**  
- concrete request/session difference identified;
- whether applying that difference allows the same controls to reach marker/RPC;
- whether the difference stays inside the current HTTP-first architecture.

**Execution rule**  
Run **only if A2 fails and the evidence specifically indicates a likely local implementation/request-shape problem**. Otherwise skip it.

**Decision / next step**
- If the comparison identifies a bounded corrective change and controls then reach marker/RPC, proceed to **A4**.
- If it does not, stop this area. Do not continue into library shopping or heavier access machinery.

### Experiment A4 — Run the publisher-URL acceptance sample

**Objective**  
Verify the actual product capability after the access problem has been resolved: at least 95 of the defined 100 representative Google News rows must resolve to valid non-Google publisher URLs.

**Why this experiment exists**  
A small control experiment can prove that the resolver is reachable, but it cannot prove the product acceptance target. This is the final capability test for the publisher-URL feature.

**Test**  
Run the existing publisher-resolution flow against the defined 100-row GB/US representative sample using the access/session behaviour established by A1, A2 or A3. Preserve the original Google News URL and classify every failed row explicitly.

**Measures**  
- successful valid non-Google publisher URLs out of 100;
- failure count and failure classes;
- row isolation/fail-soft behaviour;
- runtime and material request/cost observations.

**Execution rule**  
Run **only after a small-control experiment has established a stable production-like path to marker/RPC**.

**Success**  
At least **95/100** valid non-Google publisher URLs.

**Failure**  
A result below 95/100 is a failed acceptance result. Do not repeat it unchanged. Diagnose the observed failure before any further acceptance run.

### Area A execution flow

`A1 baseline -> [if needed] A2 ordinary session handling -> [only for evidence of local request-shape fault] A3 comparison -> A4 100-row acceptance`

A2 and A3 are **conditional**, not mandatory. A4 is mandatory before this investigation area can be concluded feasible.

---

## 3. Investigation Area B — Retrieve readable publisher article text

### Objective

Establish whether the lightweight hosted Actor can fetch public publisher pages and extract readable article text for at least **50/100** rows in the representative mixed-publisher sample.

### Existing evidence and why this area is needed

- Historical hosted testing obtained HTTP 200 HTML from 72/100 representative publisher URLs.
- That means publisher access is partial but potentially sufficient for the 50/100 product target.
- Historical Extractus 9.0.1 testing did not provide useful hosted extraction evidence: all 78 eligible calls reached the configured extraction deadline.
- Mozilla Readability worked on controlled local HTML but has not yet received a clean representative hosted test using the normal Actor path.

The investigation must therefore keep two questions separate:

1. **Can the page be fetched?**
2. **If the HTML is fetched, can readable article text be extracted?**

Changing extraction libraries cannot solve a publisher-access failure.

### Success criteria for this investigation area

At least **50/100 retained rows** in the defined representative sample must produce non-empty readable article text with a consistent success status and word count.

Failures must remain row-local and must distinguish access failures from extraction failures.

### Experiment B1 — Measure current publisher-page access

**Objective**  
Measure how many representative publisher pages are actually available to the hosted Actor before evaluating any parser.

**Why this experiment exists**  
The historical 72/100 result is useful evidence, but the product acceptance conclusion requires a current production-like sample and a clean denominator. Without this step, parser failures and network/access failures become mixed together.

**Test**  
Using the defined representative publisher-URL sample, perform bounded ordinary HTTP fetches in the normal Apify Actor runtime. Do not run article extraction yet. Classify each row by access outcome.

**Measures**  
- successful HTML fetches out of 100;
- HTTP denial/error/timeout/robots or other access classes;
- content type and whether the body is eligible article HTML;
- request/runtime bounds.

**Execution rule**  
**Always run before B2.**

**Decision / next step**
- If fewer than 50 rows provide usable article HTML, the overall 50/100 extraction target cannot be met by changing parsers alone. Stop and return the publisher-access boundary.
- If at least 50 rows provide usable article HTML, proceed to **B2**.

### Experiment B2 — Extract with structured data plus Mozilla Readability

**Objective**  
Determine whether a simple Node-native extraction path can meet the product target on the publisher HTML that is actually accessible.

**Why this experiment exists**  
Readability has already shown local mechanical viability and avoids the previous Extractus wrapper/time-out path. The important unanswered question is how well it performs on representative hosted HTML, not whether it can parse a synthetic page.

**Test**  
For rows successfully fetched in B1:
1. use useful structured article data already present in the HTML when available;
2. otherwise run Mozilla Readability on the already-fetched HTML;
3. apply explicit bounded input/runtime guards;
4. score the output for non-empty readable article text and consistent word count/status.

Do not allow the extraction library to perform its own hidden network retrieval; publisher access remains the B1 responsibility.

**Measures**  
- readable-text successes out of the full 100-row sample;
- readable-text successes out of successfully fetched eligible HTML;
- structured-data successes versus Readability successes;
- extraction failures by class;
- extraction time and material runtime/cost.

**Execution rule**  
Run **only if B1 shows that at least 50 rows provide usable article HTML**.

**Success**  
At least **50/100** retained rows produce readable article text.

**Decision / next step**
- If the 50/100 target is met, this investigation area is feasible.
- If the target is missed mainly because publisher pages could not be fetched, stop. Do not change extractor.
- If enough HTML was fetched to make 50/100 possible but Readability materially fails on accessible article HTML, proceed to **B3**.

### Experiment B3 — Test one alternative generic Node-native extractor

**Objective**  
Determine whether the remaining shortfall is specific to Readability rather than a general limitation of accessible publisher HTML.

**Why this experiment exists**  
An alternative extractor only has information value when B2 has already shown that enough publisher HTML is accessible but the primary parser is the limiting factor.

**Test**  
Select one credible generic Node-native extraction algorithm with a materially different parsing approach, run it against the **same already-fetched HTML cohort**, and score it with the same success rules used in B2. Do not add publisher-specific rules or another runtime/service.

**Measures**  
- readable-text successes out of 100;
- incremental successes over B2;
- regressions versus B2;
- extraction time and material runtime/cost.

**Execution rule**  
Run **only if B2 misses the target because of extraction quality on accessible HTML**.

**Decision / next step**
- If the combined supported path reaches at least 50/100, this area is feasible.
- If it remains below 50/100, stop and return the specific limitation. Any move to browser rendering, a second runtime, paid extraction, publisher-specific infrastructure or similar heavier machinery requires a new Product/Architecture decision.

### Area B execution flow

`B1 publisher access -> [only if >=50 usable HTML rows] B2 structured data + Readability -> [only if parser quality is the remaining blocker] B3 one alternative extractor`

B1 is mandatory. B2 is conditional on there being enough accessible HTML to make the product target possible. B3 is conditional on extraction quality, not access, being the demonstrated blocker.

---

## 4. Constraints that apply to every experiment

The Spike remains inside the approved lightweight POC architecture:

- one TypeScript/Node.js 20 Apify Actor;
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
- no silent weakening of the 95/100 publisher-URL or 50/100 readable-full-text targets.

A straightforward mechanical correction inside an approved experiment is allowed. If troubleshooting turns into a new technical investigation, introduces new machinery, or changes what the experiment is actually testing, stop and revise the design before continuing.

---

## 5. Evidence and decision rules

Each experiment must record enough evidence for a human reviewer to answer four simple questions:

1. **What were we trying to prove or disprove?**
2. **Why was this experiment necessary given what we already knew?**
3. **What actually happened, using understandable measures?**
4. **What does that result mechanically cause us to do next?**

Historical evidence should be reused rather than recreated unless the experiment explicitly needs a current production-like measurement.

Synthetic/local tests may prove mechanics, but they cannot replace the required hosted representative acceptance evidence.

A failed acceptance run remains a failed result for that code/configuration. It must not be rerun unchanged simply to seek a different outcome.

---

## 6. Investigation completion

The Spike can conclude **Feasible** only when the evidence supports both required product capabilities within the approved architecture:

- **Resolve Google News links to publisher URLs with fail-soft status (#4):** at least 95/100 valid non-Google publisher URLs in the defined live sample.
- **Add optional best-effort article full-text extraction (#5):** at least 50/100 retained rows produce readable article text in the defined mixed-publisher sample.

If either target cannot be met without crossing an approved Product/Architecture boundary, the Spike should state exactly which constraint blocks it and what decision would be required to continue.

## 7. Review status

This revision deliberately replaces the previous split between “workstreams”, “candidate approaches”, “investigation strategy” and “evidence criteria”. Those sections repeated the same material from different angles and made individual tests hard to understand.

The reusable unit in this design is an **Investigation Area** only when the problem genuinely contains more than one separable technical question. Each area is self-contained and each experiment carries its own objective, rationale, test, measures, execution rule and next-step rule.

**Owner approval:** Pending.
