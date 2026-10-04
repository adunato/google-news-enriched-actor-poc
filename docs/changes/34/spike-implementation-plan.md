# Spike Implementation Plan: Google News access and publisher full-text

> Execution-routing artifact for Technical Spike [**Rebaseline Google News access and publisher full-text for the publisher-URL and full-text features (#34)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/34). It uses the experiments defined in the Technical Investigation Design as the authoritative investigation units and controls their execution order, prerequisites, hand-offs and stop/return rules.

**Artifact ID:** `sip-34-news-access-full-text`  
**Status:** `Draft — owner review`  
**Owner:** `Project owner`  
**Created:** `2026-10-02`  
**Updated:** `2026-10-04`  
**Technical Investigation Design:** `docs/changes/34/technical-investigation-design.md` / `tid-34-news-access-full-text`  
**Spike branch:** `spike/34-news-access-full-text`

## 1. Purpose

This plan controls how the experiments already defined in the Technical Investigation Design are executed. It does **not** redefine their objective, rationale, test method or measures.

The investigation supports two blocked product capabilities:

- [**Resolve Google News links to publisher URLs with fail-soft status (#4)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/4), which requires at least 95/100 valid non-Google publisher URLs on the defined representative live sample.
- [**Add optional best-effort article full-text extraction (#5)**](https://github.com/adunato/google-news-enriched-actor-poc/issues/5), which requires readable article text for at least 50/100 retained rows on the defined representative mixed-publisher sample.

Execution follows the TID's two Investigation Areas. Area A establishes whether the existing Google News resolver can be reached reliably in hosted execution and then proves the publisher-URL acceptance target. Area B then establishes whether accessible publisher pages can produce enough readable article text.

## 2. Execution Map

The experiment IDs below come directly from the TID. The TID remains authoritative for what each experiment does and why it exists.

| Order | Investigation Area | Experiment | Entry condition | Successful route | Unsuccessful route |
| ---: | --- | --- | --- | --- | --- |
| 1 | A — Reach the existing Google News resolver | **A1 — Reproduce and characterise Google News access** | TID and plan approved; normal Apify Node 20 execution available | If the resolver remains stably reachable across the bounded repeated-request sequence, go to **A4** | If consent/interstitial behaviour appears or access is unstable, go to **A2** |
| 2 | A | **A2 — Test minimal ordinary session/consent handling** | A1 did not provide a stable path to the existing resolver | If ordinary HTTP/session handling restores a stable path, go to **A4** | Go to **A3 only if** evidence specifically points to our request/session construction; otherwise stop Area A and return the boundary decision |
| 3 | A | **A3 — Compare request construction with an independent implementation** | A2 failed and evidence indicates a likely local request/session-construction problem | If one bounded corrective difference restores access, go to **A4** | Stop Area A; do not expand into library shopping or heavier access machinery |
| 4 | A | **A4 — Run the publisher-URL acceptance sample** | A1, A2 or A3 has established a stable production-like path to the existing resolver | At least 95/100 valid non-Google publisher URLs -> Area A complete | Record failed acceptance. Do not rerun unchanged; return to the observed failure and determine whether TID/plan review is required |
| 5 | B — Retrieve readable publisher article text | **B1 — Measure current publisher-page access** | Area A has completed sufficiently to support the product flow and the defined representative publisher-URL sample is available | If at least 50/100 rows provide usable article HTML, go to **B2** | Stop Area B and return the publisher-access boundary; changing extractor cannot solve the target |
| 6 | B | **B2 — Extract with structured data plus Mozilla Readability** | B1 demonstrates at least 50 usable HTML rows | If at least 50/100 retained rows produce readable article text, Area B complete | Go to **B3 only if** enough HTML was accessible and extraction quality is the demonstrated remaining blocker; otherwise stop |
| 7 | B | **B3 — Test one alternative generic Node-native extractor** | B2 misses the target specifically because of extraction quality on accessible HTML | If the supported path reaches at least 50/100 readable-text successes, Area B complete | Stop and return the demonstrated extraction/architecture limitation |

Experiments are **not all mandatory**. A1, A4 and B1 are required on the normal route. A2, A3 and B3 are conditional. B2 runs only when B1 shows that the product target is still technically achievable from the accessible HTML.

## 3. Cross-Investigation Dependencies

- Complete Investigation Area A before beginning the final Area B route. The full-text capability depends on usable publisher URLs in the product flow.
- A failed Area A conclusion must not be hidden by substituting a hand-curated publisher URL set and presenting Area B as an end-to-end success.
- Area B must keep publisher retrieval and text extraction as separate evidence stages. An inaccessible page is an access failure, not an extractor failure.
- Historical evidence may be reused where the TID says it remains valid, but any experiment requiring current hosted behaviour must use current production-like evidence.
- A failed acceptance run remains evidence for that code/configuration and cannot be repeated unchanged merely to seek a different result.

## 4. Execution Envelope

### A1 — Google News access baseline and repeated-request behaviour

**May vary within the experiment:** the small number of known-good controls; bounded number/order of requests; instrumentation needed to record request sequence, redirect behaviour, session/cookie state and, where observable, outbound network-identity continuity.

**Requires plan/TID review:** changing the purpose from characterising repeated-request behaviour; adding browser automation, proxies/unblocking, custom network-security infrastructure, another runtime/service, or a different resolver mechanism.

### A2 — ordinary session/consent handling

**May vary within the experiment:** the minimum redirect, cookie or ordinary session handling justified directly by A1 evidence.

**Requires plan/TID review:** heavy access machinery, a different resolution mechanism, or troubleshooting that becomes a separate investigation rather than testing ordinary HTTP/session handling.

### A3 — same-mechanism implementation comparison

**May vary within the experiment:** one maintained reference implementation; inspection of the minimum request/session differences relevant to the observed failure; one evidence-backed corrective change.

**Requires plan/TID review:** broad library comparison, a different resolver family, multiple speculative implementation changes or heavier access infrastructure.

### A4 — publisher-URL acceptance

**May vary within the experiment:** instrumentation and mechanical fixes required to execute the already-defined representative 100-row acceptance sample without changing what is being measured.

**Requires plan/TID review:** changing the sample, success definition, threshold or resolver architecture.

### B1 — publisher-page access

**May vary within the experiment:** bounded HTTP timeout, response-size and concurrency settings needed to execute the defined representative access measurement.

**Requires plan/TID review:** browser rendering, proxy/unblocking infrastructure, publisher-specific access logic, paid services or a changed definition of usable HTML.

### B2 — structured data plus Readability

**May vary within the experiment:** bounded parser/runtime guards and mechanical integration details that preserve the TID's structured-data-first / Readability fallback design.

**Requires plan/TID review:** an extractor that performs uncontrolled network access, publisher-specific parser rules, another runtime/service or changed readable-text success criteria.

### B3 — one alternative generic Node-native extractor

**May vary within the experiment:** selection and bounded configuration of one credible generic Node-native extractor with a materially different parsing approach, applied to the same already-fetched HTML basis.

**Requires plan/TID review:** multiple fallback extractors, publisher-specific rules, Python/sidecar/external services, changed fetch architecture or changed success criteria.

## 5. Stop and Return Rules

Stop the current experiment and return to the owner or higher-level artifact when:

- its TID decision condition says to stop rather than continue;
- continuing requires an experiment not authorised by the TID sequence;
- the first reasonable mechanical correction does not resolve an execution defect and further troubleshooting becomes a new investigation;
- new infrastructure, dependencies or diagnostics would materially change what is being tested;
- an experiment is being repeated unchanged after failure;
- a publisher-access failure is being used to justify changing extractor;
- representative data, evidence meaning or an acceptance threshold would need to change;
- a Product/Architecture constraint would need to be relaxed;
- the effort required to diagnose the current route becomes disproportionate to its information value.

At such a point, do not invent another experiment. Decide whether the correct action is to **stop the area, revise the TID, revise this plan, or return a Product/Architecture decision**.

## 6. Spike Completion Route

The Spike reaches a supported conclusion when both Investigation Areas have reached a supported outcome:

1. **Publisher URL resolution:** the hosted flow reaches the existing Google News resolver and satisfies the defined 95/100 acceptance target, or the exact approved-boundary blocker is demonstrated.
2. **Readable full text:** the representative publisher flow satisfies the defined 50/100 readable-text target, or the exact access/extraction boundary preventing it is demonstrated.
3. `technical-spike.md` records the experiment evidence, failure classes, material runtime/cost observations and the final supported technical specification.
4. Run final Spike validation.
5. Create the final integration PR from `spike/34-news-access-full-text`.
6. After integration, reassess **Resolve Google News links to publisher URLs with fail-soft status (#4)** and **Add optional best-effort article full-text extraction (#5)** from the final Spike evidence.

A successful result in only one Investigation Area does not complete the Spike.

## 7. Open Planning Questions

No outstanding execution-routing questions.

The first execution action is to use the Technical Spike process to present the owner approval checkpoint for **A1 — Reproduce and characterise Google News access**. The checkpoint must use the TID's current A1 definition, including its bounded repeated-request sequence. Do not execute A1 before approval.

## 8. Approval

**Decision:** `Pending owner review`  
**Rationale:** This revision aligns the existing implementation-plan structure to the approved TID experiment model while avoiding a second workstream/approach taxonomy.  
**Required follow-up:** `Owner review of this updated plan; after approval, propose A1 through the Technical Spike owner checkpoint.`

### Completion contract

The plan is ready for approval when the TID experiments remain authoritative, their execution order and conditional transitions are unambiguous, cross-area dependencies are explicit, and execution-envelope/stop rules prevent an experiment from silently expanding into a different investigation.
