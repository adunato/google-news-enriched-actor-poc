# Technical Investigation Design: Google News access and publisher full-text boundary

> Canonical top-down design artifact for Technical Spike #34. It defines the technical search space and investigation strategy before individual experiments are approved. It is not a production HLD and does not record experiment chronology.

**Artifact ID:** `tid-34-news-access-full-text`  
**Status:** `Approved`  
**Owner:** `Project owner`  
**Created / updated:** `2026-10-02`  
**GitHub Spike Issue:** `#34`  
**Spike branch:** `spike/34-news-access-full-text`  
**Blocked downstream Issue(s):** `#4, #5`  
**Product Definition:** `docs/product.md` / PR-006 through PR-009, PR-011, PR-013  
**Architecture Definition:** `docs/architecture.md` / Sections 3-5, 8-10

## 1. Investigation Objective

Answer the stable #34 Technical Question: within the approved lightweight HTTP-first POC boundary, establish a production-like Apify Node 20 path that is sufficient for both:

1. **Issue #4:** reach the already-supported Google News marker/RPC publisher-URL resolver reliably enough to rerun and satisfy the defined 100-row live acceptance sample; and
2. **Issue #5:** fetch resolved public publisher pages and extract readable article text reliably enough to satisfy the defined representative >=50% full-text target.

The investigation must enable downstream engineering to distinguish:

- an implementation defect from an external-access limitation;
- Google News access/session failures from resolver-mechanism failures;
- publisher access failures from article-extraction failures;
- a candidate-specific failure from a POC/Product/Architecture boundary that must be changed explicitly.

The Spike must not optimise one failing candidate indefinitely. Its purpose is to find a supported route through the approved architecture or establish that the route is not feasible within the approved constraints.

## 2. Current Understanding

### Established facts

- #14 / PR #21 established the marker/RPC publisher-URL mechanism as technically supportable for #4.
- #4 later produced a failed hosted acceptance candidate because Google returned consent/interstitial behaviour before the marker/RPC path could execute.
- Historical #22 measured 72/100 HTTP 200 HTML publisher responses in the Apify runtime on a representative 100-row cohort; publisher access is therefore partial but materially available over ordinary HTTP.
- Historical #22 observed all 78 eligible Extractus 9.0.1 hosted extraction calls reaching the configured extraction deadline. That evidence did not score readable-text quality and does not establish that generic extraction is impossible.
- Direct Mozilla Readability executed successfully on controlled local HTML, but historical #22 never produced a clean representative hosted publisher measurement through the normal Actor path.
- The late historical #22 custom network/API-origin guard was diagnostic machinery rather than a Product or Architecture requirement. It is not a prerequisite for this Spike.
- #4 retains its >=95/100 successful valid non-Google publisher-URL acceptance target.
- #5 retains its >=50% successful readable full-text target across the representative mixed-publisher sample.
- The durable product/architecture boundary is one lightweight TypeScript/Node.js 20 Apify Actor with bounded HTTP access, per-row fail-soft behaviour, and no mandatory browser/proxy/paid extraction infrastructure.

### Material unknowns

- What minimal ordinary public HTTP/session/consent handling is required, if any, for the hosted Actor to reach the marker/RPC flow consistently.
- Whether the current resolver path can satisfy #4's >=95/100 live acceptance threshold after that access-layer correction.
- Whether bounded public publisher HTTP retrieval plus a generic Node-native extraction path can satisfy #5's >=50% readable-text target.
- For #5 misses, what proportion is caused by publisher access versus extraction quality.
- Whether any remaining blocker requires a Product/Architecture decision rather than more candidate-specific troubleshooting.
- The representative runtime/cost envelope of the supported path.

### Relevant prior evidence

Historical #22 / PR #23 is retained as evidence only. Useful evidence includes the 72/100 hosted direct-HTTP publisher baseline, the 78/78 Extractus deadline pattern, local Readability viability, and the later discovery that custom network-origin guarding displaced the investigation from the product path.

Superseded PR #30 contains useful top-down analysis that separated #4 Google access/resolution from #5 publisher retrieval/extraction and identified direct Mozilla Readability as the strongest Node-native generic extraction direction. Its HLD role is replaced by this TID.

## 3. Investigation Structure

| ID | Workstream / boundary | Question to resolve | Dependency |
| --- | --- | --- | --- |
| W1 | Google News access -> existing publisher-URL resolver | Can ordinary bounded HTTP/session handling in the target Apify runtime reach and operate the already-supported marker/RPC mechanism reliably enough for #4's live acceptance target? | None |
| W2 | Resolved publisher URL -> readable article text | Can bounded publisher HTTP retrieval plus a generic extraction path produce readable article text for >=50% of the representative #5 sample while preserving fail-soft behaviour? | Final #5 acceptance depends on W1-supported resolved URLs; candidate viability may use retained/fixed publisher URLs where provenance is clear |

The workstreams are deliberately separate. A W1 failure must not be debugged through W2 machinery, and a publisher access failure in W2 must not be treated as extractor failure.

## 4. Candidate Approaches

| ID | Workstream | Approach | Technical shape / mechanism | Why credible | Material constraints / weakness | Initial disposition |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | W1 | Existing marker/RPC resolver over ordinary bounded HTTP/session handling | Use the #14 resolver core; follow normal redirects and only the minimum ordinary public session/consent state needed to reach marker/signature extraction and RPC resolution | Already supported by #14 evidence; preserves current HTTP-first architecture and directly addresses the observed consent/interstitial blocker | Google behaviour is undocumented/volatile; ordinary session handling may still be insufficient | **Primary** |
| A2 | W1 | Alternative maintained implementation of the same marker/RPC mechanism as a comparison/reference | Compare request/session/parsing details with another implementation only when evidence suggests the local resolver implementation, rather than Google access itself, may be at fault | Can distinguish implementation defect from mechanism/access limitation without changing architecture | Must not become a library-shopping exercise; same external mechanism remains volatile | **Reference / conditional fallback** |
| A3 | W1 | Browser/proxy/managed-unblocking or paid alternative source | Use a heavier access mechanism or bypass Google News resolution entirely | Technically plausible outside current POC | Explicitly outside approved Product/Architecture boundary | **Rejected for this Spike; boundary decision only** |
| A4 | W2 | Bounded publisher fetch + structured-data fast path + direct Mozilla Readability | Actor owns HTTP fetch; inspect useful structured article data; otherwise parse supplied HTML with Readability under explicit size/complexity/runtime guards | Node-native, mature generic readability mechanism; keeps network access separate from extraction; local controlled viability already established | Requires representative hosted proof; may miss JS-dependent or structurally unusual pages | **Primary** |
| A5 | W2 | Another generic Node-native extractor after a proportionate option scan | Keep the same Actor-owned bounded HTTP fetch and substitute a materially different generic extraction algorithm | Provides a fallback only if accessible HTML is the limiting case and A4 fails on extraction quality | Must be justified by evidence; cannot fix publisher access failures; avoid publisher-specific rules | **Conditional fallback** |
| A6 | W2 | Extractus 9.0.1 | Generic article extractor previously tested from supplied HTML | Existing repository evidence and Node fit make it a known candidate | Historical hosted cohort reached the extraction deadline on 78/78 eligible rows without scored output; more candidate-specific diagnostics currently have low information value | **Deprioritised** |
| A7 | W2 | Python/sidecar/external extraction runtime or service | Add another runtime/process/service for extraction | Could expand algorithm options | Material architecture/packaging/cost change; inconsistent with the current single lightweight Node Actor unless explicitly approved | **Rejected for this Spike; TID/Product/Architecture review required** |

Third-party/community implementations are evidence about possible approaches, not authoritative external specifications.

## 5. Investigation Strategy

### W1 — Google News access/resolution

1. Investigate **A1 first** because the resolver mechanism is already supported and the unresolved observation is specifically the access/session layer in front of it.
2. The first A1 experiment must use the normal production-like Apify Actor/SDK path and the smallest bounded input that can reproduce the consent/interstitial boundary and demonstrate whether ordinary session handling reaches marker/RPC.
3. Do not introduce a custom egress firewall, origin allowlist, socket interception layer or equivalent harness as a prerequisite. If the experiment fails before reaching the intended boundary because the normal Actor itself cannot start, perform at most one bounded runtime-smoke correction/diagnostic. If that does not produce an obvious fix, stop at an Experiment Viability Checkpoint.
4. Once A1 demonstrates a functioning production-like path, rerun the exact #4 representative 100-row acceptance sample with the relevant corrective change.
5. A1 is sufficiently tested when the sample either:
   - meets #4's >=95/100 valid non-Google publisher-URL threshold with explicit failure classes; or
   - shows a repeatable external/access limitation that ordinary HTTP/session handling cannot resolve within the approved boundary.
6. **A2 becomes eligible only** if evidence indicates the problem is likely in the local implementation/request details rather than the external access mechanism itself. Comparison must remain bounded to the same mechanism.
7. If A1/A2 cannot make the route sufficiently reliable without A3-style machinery, W1 stops and reports the Product/Architecture boundary decision. Do not silently escalate.

### W2 — publisher retrieval/extraction

1. Investigate **A4 first**.
2. Keep network retrieval and extraction as separate measured stages:
   - bounded publisher HTTP fetch;
   - response/access classification;
   - structured-data fast path where useful;
   - direct Readability on already-fetched eligible HTML;
   - readable-text/status/word-count scoring.
3. Start with a small representative hosted cohort only to prove the normal production path and instrumentation. Once it behaves as intended, move to the defined representative 100-row #5 capability sample.
4. Report at least these distinct denominators/outcomes: total retained rows, usable resolved URLs, successful eligible HTML fetches, readable-text successes, and failure classes.
5. If #5 misses the >=50% target primarily because publisher pages cannot be fetched within the approved boundary, **do not change extractor**. W2 stops at the access/architecture boundary.
6. If enough eligible HTML is available to make >=50% possible but A4 materially misses because it cannot extract readable text from accessible article HTML, **A5 becomes eligible** after a proportionate option scan and owner-approved plan continuation.
7. A6 remains deprioritised unless new evidence specifically reverses the current information-value judgment.
8. A7 cannot be adopted implicitly; it requires TID plus Product/Architecture review.

### Cross-workstream rule

W1 should be executed first because #5 depends on #4 in the product flow. W2 may use retained/fixed publisher URLs for bounded candidate validation only when provenance is clear, but the final #5 conclusion must be grounded in the approved representative flow and cannot conceal unresolved #4 failure.

## 6. Evidence and Decision Criteria

| Workstream | Required evidence | Success / exit criterion | Not-feasible / escalation condition |
| --- | --- | --- | --- |
| W1 | Production-like Apify Node 20 evidence for the consent/session boundary; exact corrective behaviour; then #4's defined 100-row live sample with per-row resolution/failure evidence and runtime/cost observations | >=95/100 valid non-Google publisher URLs on the defined sample; original Google News URLs retained; failures explicit and row-local | Ordinary bounded HTTP/session handling cannot make the marker/RPC path reliable enough, or success would require A3 / another excluded capability |
| W2 | Production-like Apify evidence separating fetch from extraction; representative mixed-publisher sample; total/resolved/fetched/extracted denominators; readable-text/word-count checks; failure taxonomy; runtime/cost observations | >=50/100 retained rows produce non-empty readable article text with consistent status/word count and row-local failures | Target remains below 50 because of access limitations within approved boundary, or credible generic Node-native candidates fail on accessible HTML and further progress requires A7 / another excluded architecture change |

Evidence must remain representative of the target runtime/data for the claim being made. Synthetic fixtures may validate mechanics but cannot satisfy the live capability thresholds.

## 7. Boundaries and Non-Goals

- No broad scraping/anti-bot market research.
- No browser automation/rendering.
- No residential proxies or managed unblockers.
- No paid external extraction/news APIs.
- No paywall bypass, CAPTCHA solving, credential attacks or access to non-public/private content.
- No publisher-specific heavy parser/rule infrastructure.
- No second service/runtime or Python sidecar without explicit TID + Product/Architecture review.
- No custom network-security/egress harness as a prerequisite for ordinary product-path testing.
- No weakening or redefining #4/#5 acceptance thresholds inside the Spike.
- No repeated unchanged reruns of a failed required acceptance candidate.
- No inference that changing an extractor can solve publisher access failures.
- No production feature implementation beyond disposable/reusable non-product Spike tooling explicitly needed for evidence.

## 8. Design-Change Rule

The Spike may generate hypotheses and diagnostic experiments inside the approved TID. If evidence materially changes the W1/W2 decomposition, candidate set, architectural mechanism, Product/Architecture constraints, evidence meaning, or investigation strategy, stop and update/review this TID before continuing.

In particular, a stubborn experiment must not grow new guards, wrappers, infrastructure, dependencies or diagnostics until the agent has checked whether the current candidate still has better information value than the next planned option.

## 9. Open Questions

No outstanding investigation-design questions. Experiment-specific hypotheses and operational bounds must be proposed one at a time through `technical-spike.md` and the owner approval checkpoint.

## 10. Summary and Approval

### Key decisions

- Preserve the #14 marker/RPC resolver and investigate the ordinary access/session layer first.
- Keep #4 Google access/resolution and #5 publisher retrieval/extraction as separate workstreams.
- Use the normal Apify Actor/SDK runtime; explicitly exclude the historical custom network-origin harness from the target path.
- Use direct Mozilla Readability with structured-data fast path as the primary #5 candidate.
- Activate another generic Node-native extractor only if accessible-HTML evidence shows extraction quality, not access, is the limiting factor.
- Treat any need for browser/proxy/paid/second-runtime machinery as an explicit boundary decision, not a troubleshooting step.

### Approval

**Decision:** `Approve`  
**Rationale:** The bounded technical question, workstreams, candidate set, evidence thresholds and stop/escalation rules are sufficiently defined for execution planning without inheriting the superseded #22 rabbit-hole path.  
**Required follow-up before Spike execution:** `Complete and approve the Spike Implementation Plan; then use the technical-spike owner checkpoint to propose the first W1/A1 experiment.`

### Completion contract

The TID is ready for execution planning. Individual hypotheses and experiment procedures belong in `technical-spike.md`, not this artifact.
