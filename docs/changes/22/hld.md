# High-Level Design: bounded Google News resolution and publisher full-text retrieval

> Design baseline for Technical Spike #22. This HLD defines the intended technical shape and experiment order. The Spike issue and PR evidence record execution and findings; they do not replace this design.

**Artifact ID:** `hld-22-news-resolution-full-text`  
**Status:** Proposed / trial baseline  
**Owner:** Project owner  
**Created:** 2026-10-02  
**Technical Spike:** #22  
**Blocked downstream issues:** #4, #5  
**Product Definition:** `docs/product.md`  
**Architecture Definition:** `docs/architecture.md`

## 1. Purpose

Issue #22 exists to remove two concrete blockers:

1. **#4 — Google News publisher-URL resolution:** determine how the existing marker/RPC resolver can operate reliably enough in the Apify runtime when Google presents consent/interstitial behaviour.
2. **#5 — publisher full-text retrieval:** determine whether the HTTP-first Actor can obtain readable article text from enough public publisher pages to meet the POC target.

The Spike is an investigation mechanism. This HLD supplies the missing top-down design so experiments do not define the architecture accidentally.

The HLD is intentionally narrower than the durable product architecture. It does not redesign the Actor or introduce new product capabilities. It defines how the existing architecture should be explored and validated.

## 2. Existing product boundary

The approved product and architecture already define the main constraints:

- one TypeScript/Node.js 20 Apify Actor;
- Google News as the discovery source;
- publisher URL resolution as a separate enrichment stage;
- optional bounded HTTP publisher-page retrieval and readable-text extraction;
- row-level fail-soft behaviour;
- no browser rendering, residential proxies, paid external extraction/news services, paywall bypass or publisher-specific heavy infrastructure within the current POC;
- low-cost, bounded execution suitable for an Apify Store POC.

Those constraints remain authoritative unless the owner explicitly changes them.

## 3. What the Spike has already established

PR #23 and its retained experiment evidence contain useful findings, but they are execution evidence rather than the design.

### Useful evidence

- The existing Google News marker/RPC mechanism from #14 is still the intended resolution mechanism. #4 later failed before that mechanism could run because the hosted request encountered Google consent/interstitial behaviour.
- A representative hosted publisher baseline retrieved HTTP 200 HTML for **72/100** rows. Publisher access is therefore partial but materially available through ordinary HTTP.
- Extractus 9.0.1 produced **78/78 extraction timeouts** on eligible rows in the replacement hosted cohort. That makes it a poor default candidate for this POC even though the package itself remains actively maintained.
- Direct Mozilla Readability has **not yet received a valid representative hosted publisher test**. The Iteration 10 run failed before producing extraction evidence.
- Local fixture work proved that Readability itself can execute in a Node/Apify-compatible environment on controlled HTML.

### Evidence that must not steer the architecture

PR #23 later introduced a custom network-denial / API-origin guard around the Actor in order to prove that a diagnostic fixture could not make unintended calls. That work led to H14/H15/H15-B platform-origin diagnostics.

This is useful historical diagnostic evidence, but it is **not a product requirement and not part of the target architecture**.

The POC does not require a custom egress firewall, SDK-origin allowlist, socket interception layer, or bespoke network-security harness around a normal Apify Actor. Continuing to make Readability or publisher extraction depend on that harness would test the harness rather than the product.

If a local test must prove that no external network is available, use environment-level isolation such as Docker `--network none`. Hosted functional experiments should use the normal Apify Actor/SDK runtime with bounded inputs, explicit request limits and the approved POC constraints.

## 4. Target high-level architecture

```text
Google News RSS/search
        |
        v
normalize Google News records
        |
        v
publisher URL resolution (#4)
  existing marker/signature + RPC mechanism
  over ordinary bounded HTTP/session handling
        |
        +---- failure --> row-level resolution status + keep googleNewsUrl
        |
        v
resolved publisher URL
        |
        v
bounded publisher HTTP fetch (#5)
        |
        +---- access failure --> row-level full-text status
        |
        v
article extraction
  1. structured article data when useful
  2. generic readability extraction
        |
        +---- extraction failure --> row-level full-text status
        |
        v
normalized dataset row
```

The two uncertain boundaries are deliberately separate:

- **Google access/resolution** determines whether a usable publisher URL is available.
- **Publisher access/extraction** determines whether readable article text can be obtained from that URL.

A failure in one must not be diagnosed through machinery belonging to the other.

## 5. Workstream A — Google News publisher URL resolution (#4)

### 5.1 Selected architectural direction

Retain the already-established marker/signature + Google internal RPC resolution mechanism from #14.

Current open-source Google News decoders still use the same broad pattern: obtain per-article data from the Google News page and call the internal `batchexecute` endpoint to obtain the publisher URL. The protocol is undocumented and therefore volatile, but it is the most direct HTTP-first mechanism currently evidenced for opaque post-2024 Google News URLs.

Relevant external evidence:

- GoogleNewsDecoder: https://github.com/dbernheisel/google_news_decoder
- current Python Google News decoder: https://github.com/SSujitX/google-news-url-decoder
- maintained TypeScript implementation/history: https://gist.github.com/huksley/bc3cb046157a99cd9d1517b32f91a99e

The existing #14 implementation should therefore be treated as the resolver core. #22 should investigate the **access/session layer in front of it**, not replace the resolver without evidence.

### 5.2 Access handling order

Test the smallest realistic production path first:

1. ordinary bounded HTTP request using the same runtime and request stack intended for the Actor;
2. normal redirect handling;
3. ordinary public session/cookie state where required to pass a consent/interstitial response;
4. existing marker/signature extraction and RPC call;
5. fail soft if the public HTTP path cannot obtain the required inputs.

Do not jump from a consent response directly to browser automation, proxies, managed unblockers or a new resolver library. Those are architecture/product boundary decisions because they are outside the current POC.

### 5.3 Alternatives and boundary decisions

| Option | Fit with current POC | Decision |
| --- | --- | --- |
| Existing marker/RPC mechanism over ordinary HTTP/session | Strong | **Primary** |
| Alternative library implementing the same mechanism | Useful as reference/validation, but not a different architecture | Reference only unless it materially improves reliability |
| Browser/Playwright resolution | Technically credible; current GNews project uses this for automatic URL resolution | Out of scope unless owner changes the POC |
| Paid search/news API returning publisher URLs | Could avoid Google decoding entirely | Out of scope under current product constraints |
| Offline decoding of opaque current tokens | Current evidence does not support it as a general solution | Do not pursue |

### 5.4 Success condition

After a corrective access/session change, rerun #4's existing representative 100-row live sample. The accepted #4 threshold remains **>=95% valid non-Google publisher URLs** with row-level failure statuses and the original Google News URL preserved.

If ordinary HTTP/session handling cannot get sufficiently reliable access to the marker/RPC flow, stop and surface a Product/Architecture decision instead of creating progressively heavier hidden infrastructure.

## 6. Workstream B — publisher full-text retrieval (#5)

### 6.1 Retrieval boundary

The Actor should fetch the resolved public publisher URL once through the normal bounded HTTP path.

The fetch layer owns:

- timeout;
- response/body-size limit;
- redirect limit;
- content-type checks;
- bounded concurrency/retry policy;
- robots/access-policy behaviour already agreed for the POC;
- row-level failure classification.

The extraction library should normally receive **already-fetched HTML**. It should not independently fetch the URL unless that behaviour is explicitly selected and tested. Keeping fetch and extraction separate makes access failures distinguishable from parser failures.

### 6.2 Extraction candidates

#### Option 1 — structured article data + Mozilla Readability

**Design:** inspect structured article metadata already present in the HTML where useful, then use `@mozilla/readability` against a Node DOM implementation for generic article-body extraction.

**Why it fits:**

- Mozilla Readability is the standalone implementation used by Firefox Reader View.
- It supports `isProbablyReaderable` and `maxElemsToParse`, giving the Actor explicit guards around parsing cost.
- Its documented Node usage uses an external DOM implementation such as jsdom.
- jsdom does not need page scripts or remote resources enabled for this use; Mozilla explicitly notes those behaviours are disabled by default and recommends keeping them disabled.
- This keeps network retrieval under the Actor's own fetch layer rather than inside the parser.

Sources:

- https://github.com/mozilla/readability
- https://schema.org/NewsArticle
- https://schema.org/articleBody

**Decision:** **Primary candidate.**

The first meaningful hosted test should therefore be a normal Actor run using the standard runtime, already-fetched publisher HTML and Readability. It should not depend on the PR #23 custom egress/API-origin harness.

#### Option 2 — Extractus 9.0.1

Extractus is actively maintained and supports extraction from supplied HTML as well as URLs. However, this repository has already observed 78/78 eligible hosted calls reaching the extraction deadline without a scored output.

Source: https://www.npmjs.com/package/@extractus/article-extractor

**Decision:** **Deprioritised for this POC.** Do not spend more iterations diagnosing it unless new evidence gives a specific reason to revisit it.

#### Option 3 — Trafilatura

Trafilatura is a mature purpose-built article/main-text extractor with current documentation and configurable precision/recall behaviour.

Source: https://trafilatura.readthedocs.io/

Its principal drawback here is architectural: it is Python-first, while the approved Actor is TypeScript/Node.js. Introducing Python or a sidecar/subprocess increases packaging and runtime complexity.

**Decision:** **Reserve candidate.** Evaluate only if the primary Node-native approach fails the representative target and there is still a plausible path within the lightweight POC.

#### Option 4 — Postlight Parser / Mercury-style parser

Postlight Parser is an established JavaScript article parser and supports site-specific parsers. However, its public release history is materially older, and publisher-specific extractors would move the POC toward a maintenance model that is explicitly out of scope.

Source: https://github.com/postlight/parser

**Decision:** **Deprioritised.**

### 6.3 Recommended extraction shape

```text
publisher HTML
    |
    +--> structured metadata / articleBody available and usable?
    |        |
    |        +--> yes: candidate text
    |
    +--> otherwise / insufficient:
             DOM parse
               |
               +--> isProbablyReaderable?
                       |
                       +--> yes: Readability.parse()
                       +--> no: unreadable status
```

Structured metadata is a fast path, not a separate product promise. Readability remains the generic fallback.

### 6.4 Success condition

Run the representative mixed-publisher 100-row #5 capability sample using resolved URLs and the normal Apify runtime.

The existing acceptance target remains **>=50% of retained rows with readable non-empty article text**, with explicit status and word count, while failures remain row-local.

If the primary candidate misses the target, first classify why:

- publisher access failure;
- non-HTML/unavailable page;
- parser guard rejection;
- parser returned no useful article;
- runtime/performance failure.

Only extraction failures should motivate another extractor. Access failures should not.

## 7. Experiment sequence

The Spike should now follow this order unless new evidence changes the HLD.

### Step 0 — clean runtime baseline

Before more candidate-specific work, prove that a minimal normal Node 20 Apify Actor using the standard SDK can start, read input and write a small fixed result in the target hosted runtime.

This is a packaging/runtime smoke test, not a network-security experiment.

If this fails, diagnose the minimal Actor/runtime problem directly. Do not reintroduce the H14/H15 origin-security harness.

### Step 1 — #4 access/session experiment

Reproduce the Google consent/interstitial blocker with the smallest production-like resolver path. Record the response class and test the minimum ordinary session/consent handling necessary to reach the existing marker/RPC resolver.

If successful, run the representative #4 sample.

If unsuccessful within the HTTP-first boundary, stop at a Product/Architecture decision.

### Step 2 — #5 Readability viability

Using resolved publisher URLs:

1. bounded HTTP fetch;
2. structured-data fast path;
3. Mozilla Readability fallback;
4. row-level classification.

Start with a small representative hosted cohort only to prove the production path works end to end. Once it does, execute the required 100-row capability sample.

### Step 3 — reserve candidate only if justified

If #5 misses the target primarily because Readability cannot extract usable text from otherwise successfully fetched article HTML, evaluate Trafilatura as the next materially different candidate.

Do not return automatically to Extractus diagnostics.

## 8. What not to build during this Spike

Unless the owner explicitly changes the HLD or product boundary, do not add:

- a custom egress firewall around the Actor SDK;
- fixed allowlists for Apify's internal API origins;
- monkey-patching of Node HTTP/TLS/Undici/WebSocket APIs as a product mechanism;
- recursive attempts to prove universal zero-egress behaviour inside a hosted Actor;
- browser automation;
- residential proxies;
- managed unblockers;
- paid extraction/news APIs;
- publisher-specific parsers or rules;
- a second service solely to host another extraction runtime.

Diagnostic code may exist temporarily when directly required to understand a failure, but it must not become a prerequisite for testing the selected product architecture.

## 9. Failure model

The product-facing status model should distinguish at least these classes:

### URL resolution

- not requested;
- resolved;
- Google consent/interstitial;
- Google request denied/rate-limited;
- resolver input/marker unavailable;
- RPC/decode failure;
- invalid/non-publisher destination;
- unexpected resolver error.

### Full text

- not requested;
- no resolved publisher URL;
- robots/access skipped;
- publisher HTTP denial;
- timeout/network error;
- non-HTML/unusable response;
- parser guard rejected;
- no readable article found;
- extraction error;
- success.

Exact status names belong in the later LLD/implementation plan. The HLD requires the separation of these failure domains.

## 10. Decision rules

The agent may continue autonomously when it is:

- implementing or testing the architecture described here;
- fixing ordinary defects in that implementation;
- adjusting bounded test mechanics without changing the architecture.

The agent should stop and surface a design decision when it would need to:

- introduce a capability excluded by the POC;
- add a new subsystem or runtime;
- add custom security/network infrastructure around the normal Actor;
- replace the selected resolution architecture;
- move from generic extraction to publisher-specific logic;
- materially change acceptance criteria.

When an experiment reveals that this HLD is wrong, update the HLD first rather than allowing the PR history to become the new design implicitly.

## 11. Relationship to Issue #22 and PR #23

- **This HLD:** current design baseline — what we intend to build/test and why.
- **Issue #22:** investigation objective, constraints, completion criteria and current owner decisions.
- **`technical-spike.md` / PR #23:** chronological experiment evidence and historical findings.
- **Future implementation plan / LLD:** detailed execution design after the high-level direction is sufficiently proven.

Historical PR #23 experiments remain valid evidence within the limits recorded at the time. The HLD does not require deleting or rewriting that history. It does mean that future work should not continue a diagnostic branch merely because it is the latest branch of the PR.

## 12. Current recommendation

Rebaseline the next #22 work against this design:

1. stop treating the H14/H15/H15-B custom network-origin diagnostic chain as the route to production viability;
2. establish a minimal standard Apify Actor hosted smoke test;
3. resolve #4's Google consent/session blocker against the existing marker/RPC mechanism;
4. test #5 with a clean standard hosted path using bounded publisher HTTP + structured-data fast path + Mozilla Readability;
5. use the existing #4/#5 representative acceptance samples to decide feasibility;
6. escalate only when the approved lightweight architecture itself is shown insufficient.

This restores the intended development shape: **HLD first, experiments second, implementation detail only where the experiment requires it.**
