# Learning Record

**Learning ID:** `google-news-enriched-actor-poc--issue-41--promise-observer-state`

**Origin repository:** `adunato/google-news-enriched-actor-poc`

**Source:** `GitHub Issue #41 — Prove Google News publisher resolution and full-text viability`

**Lifecycle stage / skill:** `Technical Spike execution and evidence review / technical-spike`

**Date:** `2026-10-07`

**Category:** `Methodology`

**SideGig review:** `Yes`

**Disposition:** `Captured`

## Change context

Issue #41 investigates whether a Node.js 20 Actor can resolve Google News URLs and retrieve readable publisher text under bounded HTTP-only conditions. The R4 hosted run timed out after 97 of 100 rows. Its diagnostic markers reported body reads and `reader.closed` as pending in three rows at two post-abort snapshots. The run emitted no final summary, and no internal Undici controller or cancellation state was exposed. The follow-up R5 assessment was limited to exact Node v20.20.2 / bundled Undici 6.24.1 sources; no new run or reproduction was authorized.

## Observation

An application flag updated inside a Promise reaction records that the reaction ran, not necessarily the private promise's state at the instant of a later snapshot. If the promise settles but its reaction has not run, an application snapshot can still show the previous flag value. A missing log marker is a separate case: if the reaction ran and updated state before attempting to emit a marker, a dropped marker does not undo that state update, though incomplete platform logs may hide the record. Evidence should name the observable layer and avoid translating “last observed pending” into “the underlying operation remained pending.”

## Evidence

In R4, `reader.closed` handlers update the recorded state before emitting their marker in `experiments/r4-hosted-body-read/main.mjs` (lines 365–390); read-settled state and await/catch handling are also application reactions (lines 399–403 and 521–531). The three rows had pending flags at finite snapshots, but R4 exposed no internal controller/body state and no final run summary. The R5 exact-version source assessment found that Node/Undici has a conditional stream-error path that should reject pending read and `reader.closed` promises if its conditions hold, plus a separate locked-cancel rejection path. The retained evidence did not show which internal branch ran or whether an application reaction had executed before each snapshot. No public passive diagnostic channel exposed that transition.

## Impact

Conflating observer state with private promise state can turn a bounded timeout trace into an unsupported claim about settlement, persistence, scheduler behavior or runtime root cause. Distinguishing delayed reaction execution from dropped log output also helps avoid unnecessary reruns when evidence is incomplete.

## Local action

The R4 result remains Inconclusive / Hold. Its record now describes snapshot flags as application-observed state and does not claim persistence to run end or a Node/Undici cause. R5 found no verified public passive discriminator; no hosted follow-up is authorized without a new bounded TID.

## Cross-project relevance

This may apply to other asynchronous diagnostics that derive status flags or markers from Promise reactions. The SideGig technical-spike evidence method or canonical spike skill may need to distinguish underlying operation state, observer/reaction state, and log-delivery state, and to require last-observed wording when internal state cannot be observed. No SideGig-owned files were changed here.

## Stable local references

- [Issue #41](https://github.com/adunato/google-news-enriched-actor-poc/issues/41)
- `docs/changes/41/technical-investigation-design.md` — R4 result and R5 assessment checkpoint
- `docs/changes/41/technical-spike.md` — R4 execution record and R5 outcome
- `docs/changes/41/experiments/r4-hosted-body-read/main.mjs`
- `docs/changes/41/experiments/r4-hosted-body-read/results-r4-operator-evidence.json`
- `docs/changes/41/experiments/r4-hosted-body-read/markers-r4-sanitized.jsonl`
- `docs/changes/41/experiments/r5-runtime-abort-assessment/evidence-r5-source-trace.md`
- [Node v20.20.2 Undici fetch implementation](https://github.com/nodejs/node/blob/v20.20.2/deps/undici/src/lib/web/fetch/index.js)
- [Node v20.20.2 Web Streams implementation](https://github.com/nodejs/node/blob/v20.20.2/lib/internal/webstreams/readablestream.js)
