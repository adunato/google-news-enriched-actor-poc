# High-Level Design: Publisher URL Resolution

**Artifact ID:** `hld-4-publisher-url-resolution`<br>
**Status:** `Approved`<br>
**Owner:** Project owner<br>
**Created / updated:** `2026-09-30`<br>
**GitHub Issue:** [#4](https://github.com/adunato/google-news-enriched-actor-poc/issues/4)<br>
**Product Definition:** `docs/product.md`, PR-006, PR-007, PR-010, PR-011, PR-013<br>
**Architecture Definition:** `docs/architecture.md`, Sections 3–5 and 8–9<br>
**Technical Spike:** [#14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14), final Feasible conclusion integrated by [PR #21](https://github.com/adunato/google-news-enriched-actor-poc/pull/21); `docs/changes/14/technical-spike.md`<br>
**Traceability:** Issue #4 development lifecycle assessment; historical implementation and live evidence in draft PR #11 and `docs/changes/4/live-sample.json`

## 1. Summary

Issue #4 resolves each retained Google News article link to a publisher URL when resolution is enabled. Every row keeps its original Google News URL and receives an explicit success, failure, or not-requested outcome. A row-level resolver failure must not interrupt other rows or fail the Actor run.

The accepted resolution mechanism is the article-ID-bound Google News marker and `Fbv4je` / `garturlreq` RPC established by the completed #14 Spike. A current live sample is still required to satisfy Issue #4's >=95/100 acceptance criterion.

## 2. Current State

The Actor retrieves, limits, and optionally deduplicates Google News RSS records. `src/publisher-url.ts` contains an HTTP resolver, and `src/index.ts` orchestrates enrichment. The retained 100-row live sample in `docs/changes/4/live-sample.json` produced 0 valid publisher URLs: every row was redirected to a consent/interstitial destination before marker extraction or RPC. This sample does not test the accepted marker/RPC path.

The integrated #14 conclusion supports the marker/RPC mechanism under the owner-approved H5 attribution rule. Its retained fixed matrix produced 100/100 article-ID-bound parseable non-Google candidates; 79 rows had direct publisher-title confirmation, 21 were unverifiable by that method, and no mismatches were confirmed. This is mechanism-level URL-resolution evidence, not 100 independent publisher-page identity confirmations. Google does not publish this as a supported resolver API, so the mechanism may change.

## 3. Requirements

### Functional Requirements

- Attempt URL resolution for every eligible retained record when `resolvePublisherUrls=true`.
- Preserve the original `googleNewsUrl` and discovery fields in every outcome. Carry the edition used for RSS discovery internally through resolution without adding it to the public result row.
- Emit `urlResolved` and an explicit `urlResolutionStatus`; include `publisherUrl` and lowercased `publisherDomain` only on success.
- Keep a failure local to its row and continue processing unrelated rows.
- Make no resolver request and emit `not_requested` when resolution is disabled.
- Pass the mandatory fixed 100-row live sample with at least 95 valid non-Google HTTP(S) publisher URLs.

### Constraints and Important Conditions

- Keep the implementation HTTP-first and lightweight. Do not add browser rendering, residential proxies, paid extraction services, paywall bypass, or publisher access circumvention.
- Do not fetch publisher page bodies as part of URL resolution. Publisher accessibility and optional full-text extraction are separate capabilities.
- Preserve existing per-row bounds: 10-second deadline, 2 MiB response cap, at most five redirects, and concurrency of four.
- Keep dataset delivery and public dataset persistence outside this Issue's scope.
- Retain H5's distinction between resolver attribution and direct publisher-page title confirmation in evidence and reporting.

## 4. Expected Outcome

### Before

The latest retained representative sample fails at the Google page acquisition stage because the request is redirected to a consent/interstitial host. It yields 0/100 valid publisher URLs and does not exercise the marker/RPC resolution contract.

### After

Each retained row has a fail-soft, explicitly reported resolution outcome. A successful row has a preserved Google News URL and a validated non-Google HTTP(S) publisher URL/domain tied to a matching article-ID marker and corresponding RPC result. The fixed live sample passes only when all 100 rows are retained and at least 95 satisfy the success rule. Publisher-page accessibility/title confirmation is reported separately and does not redefine the approved H5 resolution rule.

## 5. Proposed Design

### High-Level Flow

1. Validate Actor input and retrieve, limit, and deduplicate Google News RSS records according to the existing controls. Pair each record with the exact edition values from that RSS request: `hl`, `gl`, and `ceid`.
2. If resolution is disabled, return each record with `not_requested` and make no resolver HTTP request.
3. For each enabled record/edition pair, preserve the record's Google News URL and extract its article ID. Acquire the Google News article marker through the explicit article-ID parameter-page path with the pair's edition/locale parameters; do not rely on traversing the RSS article link through a consent redirect to obtain the marker.
4. Accept markers only when the page article ID matches the input row's article ID. Submit the corresponding `Fbv4je` / `garturlreq` RPC to Google News using the fixed H5-tested RPC locale context `US:en` for every row, and parse its `garturlres` result. Do not derive RPC context from the row's RSS edition.
5. Treat the result as resolved only when it is a parseable HTTP(S) URL on a non-Google host and is bound to the matching article ID through the marker/RPC request. Set `publisherDomain` to the parsed lowercased hostname.
6. Convert missing, mismatched, malformed, timed-out, interstitial, or unsuccessful steps into a row-level failure; preserve the original URL and continue with the remaining rows.
7. Return enriched public rows in input order to the existing orchestration boundary. The internal edition context is consumed by resolution and is not copied into the result row or public dataset projection.

## 6. Backend Changes

The discovery boundary pairs each normalized record with the exact `hl`/`gl`/`ceid` values used for its RSS request. Deduplication retains the first matching candidate as a whole, including its edition context. The resolver uses that edition only for article-ID parameter-page acquisition. It submits every eligible RPC with the fixed H5-tested `US:en` context, independent of the row's RSS edition; no derived per-edition RPC mapping is established. The orchestration boundary passes candidates to resolution and receives flattened public result rows in the same order. It must not spread the candidate wrapper into the public result. Internal diagnostics record the actual RPC context (`US:en`) and whether the row is outside the tested GB/US English editions. They may capture bounded stage/category/status information needed to explain failures; raw page/RPC bodies and article text must not be retained in diagnostic reports.

The change does not add a runtime service, persistence layer, or dependency. It does not move publisher-page retrieval or dataset delivery into the resolver.

## 7. UI and User Experience Changes

No meaningful UI impact. Consumers observe the result through the Actor's row data and explicit resolution status.

## 8. Data and State

The internal discovery candidate is `{record, edition}`, where `record` is the unchanged `GoogleNewsArticleRecord` and `edition` is `{hl, gl, ceid}`. This internal context is not part of the output schema. The enriched public row retains existing discovery fields, including `query`, `title`, `googleNewsUrl`, and optional source/date/snippet fields. It adds `urlResolved:boolean` and `urlResolutionStatus` with `success`, `failure`, or `not_requested` values. A successful row includes `publisherUrl` and `publisherDomain`. Failed and not-requested rows preserve `googleNewsUrl` and omit successful publisher fields. `urlResolved` is true exactly when the validated URL/domain pair is present with success status.

## 9. Interfaces and Integrations

- `src/google-news.ts` returns each record with its RSS edition context and retains that association through deduplication.
- `src/publisher-url.ts` accepts the internal candidate, uses its edition for marker-page context, uses fixed `US:en` for RPC context, and returns a flattened public result row; Fetch remains injectable for deterministic checks.
- `src/index.ts` passes discovery candidates to the resolver and hands only flattened enriched rows to the existing processing seam.
- Google News marker and `batchexecute` interactions use native HTTP Fetch and URL handling. The `Fbv4je` / `garturlreq` contract is undocumented and is relied on only as supported by the integrated #14 evidence.
- Dataset/API delivery remains in the separate Issue #6 scope.

## 10. Error and Edge-Case Behaviour

- Invalid, missing, or non-Google News input URL: row failure; preserve the original value.
- Marker acquisition redirected to consent/interstitial, marker absent, or article ID mismatch: row failure; do not attempt consent handling, cookie state, or access workarounds.
- RPC HTTP error, timeout, network failure, malformed response, or absent result: row failure.
- Invalid result scheme, Google-owned result host, or malformed URL: row failure; never report it as a publisher URL.
- A valid destination is accepted under H5's mechanism-level attribution rule without fetching the publisher page. The 21 historically title-unverifiable rows remain an evidence limitation, not evidence of a confirmed mismatch.
- Missing or malformed internal edition context is a row-level failure; it must never be guessed from `googleNewsUrl` parameters such as `oc=5`.
- The result row must not contain an `edition` property or nested discovery candidate wrapper.
- One failed row does not cancel or prevent resolution of any other row. Bounds apply independently within the shared resolver limits.

## 11. Validation and Feasibility Considerations

Unit and mocked integration checks establish local parsing, validation, row isolation, disabled behavior, and request bounds. They cannot establish current Google News compatibility. The exact live sample in Issue #4 is mandatory and remains a blocking acceptance gate.

### Discovery-backed external / runtime contract

The integrated #14 Feasible conclusion supports this sequence: acquire Google News markers for the same source article ID; require the marker's article ID to match the row; issue the `Fbv4je` / `garturlreq` RPC with the fixed H5-tested `US:en` context; accept a parseable HTTP(S) non-Google destination returned by that request under the approved H5 rule. The retained mixed GB/US 100-row evidence used `US:en` and yielded 100 candidates, 79 title-confirmed rows, 21 title-unverifiable rows, and zero confirmed mismatches. A hosted known-positive page/RPC check also succeeded for one query using `GB:en`; this does not establish a general rule for deriving RPC context from RSS edition, nor replace the 100-row matrix or establish publisher-page accessibility.

### Residual assumptions and bounded feasibility gates

The H5 mixed-edition results support using `US:en` as best-effort RPC context for every row. The single-query `GB:en` success is useful corroboration, but broader RPC locale compatibility and a derived RSS-to-RPC locale mapping remain unverified. Add diagnostics for the RPC context used and flag rows outside GB/US English (`hl`/`gl` pairs other than `en-GB`/`GB` and `en-US`/`US`). Keep the exact 100-row matrix as the blocking external gate. If marker-page acquisition reaches a consent/interstitial host, classify the row as failed. Use the existing 10-second request deadline, 2 MiB response limit, and five-redirect maximum. Do not add cookies, browser requests, proxying, publisher-site access workarounds, or a different resolver family under this design. A materially different approach requires reassessment.

Run the unchanged 100-row live acceptance matrix after implementation and local checks. It must contain five queries (`world news`, `politics`, `business`, `technology`, `health`), GB and US English editions (`en-GB`/`GB`, `en-US`/`US`), and ten retained rows per query/edition cell. The run passes only with all 100 retained rows and at least 95 valid resolutions. Record the exact input/configuration, UTC collection time, commit, per-cell denominators/successes, failure categories, and bounded request metrics. Report any independent publisher-title confirmations and unverifiable rows separately; do not fetch or retain response bodies for this report.

## 12. Open Questions

No design question remains open. H5 supports the fixed `US:en` RPC context on the mixed GB/US matrix; broader locale compatibility remains unverified and must be made visible through internal diagnostics. Edition propagation to the parameter-page and public-row exclusion are implementation responsibilities covered by the LLD. The complete 100-row live acceptance gate remains open and blocks acceptance of Issue #4 until it passes.

## 13. Design Summary

- Use the integrated #14 article-ID-bound marker/RPC mechanism and approved H5 meaning of URL-resolution success.
- Obtain markers from the explicit article-ID parameter-page path with locale parameters; treat consent/interstitial outcomes as bounded row failures.
- Carry `{hl, gl, ceid}` beside each discovery record from RSS retrieval through deduplication and parameter-page acquisition; consume it internally and exclude it from public rows.
- Use the fixed H5-tested `US:en` RPC context for every enabled row, and record it plus the outside-tested-GB/US-English flag in internal diagnostics.
- Preserve the original Google News URL, status every row, and keep failures isolated.
- Require the exact 100-row live sample and >=95 valid publisher URLs before Issue #4 acceptance.
- Report direct publisher-page title evidence separately from URL-resolution status.
- No Product Definition change is indicated. Reconcile the Architecture Definition after implementation to describe the implemented acquisition path and the residual undocumented-Google-endpoint risk.

### Approval

**Decision:** `Approve`<br>
**Rationale:** The completed #14 Spike resolves the fundamental mechanism and attribution rule. H5's 100-row mixed-edition evidence used the fixed `US:en` RPC context; one `GB:en` known-positive check does not establish a generalized mapping. The unchanged 100-row live acceptance threshold remains a required completion gate. The internal edition association is needed for RSS/parameter-page context, while RPC context remains fixed as documented.<br>
**Required follow-up before implementation planning/development:** Implement and verify edition-context propagation and public-row exclusion, then record the full live acceptance evidence before closing #4.
