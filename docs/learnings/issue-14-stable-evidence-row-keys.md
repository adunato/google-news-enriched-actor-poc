# Learning Record

**Learning ID:** google-news-enriched-actor-poc--issue-14--stable-evidence-row-keys

**Origin repository:** adunato/google-news-enriched-actor-poc

**Source:** GitHub Issue #14, H5 evidence synthesis

**Lifecycle stage / skill:** Technical Spike execution / `capture-learning`

**Date:** 2026-09-29

**Category:** Methodology

**SideGig review:** Yes

**Disposition:** Captured

## Change context

Issue #14 investigated whether Google News RSS article links can be resolved to publisher URLs with a lightweight HTTP-only mechanism. The investigation reused a fixed 100-row sample from Issue #18 and compared outputs from separate probe runs. Feed captures can contain repeated article IDs and can differ between runs, so the same numeric row position or truncated article ID is not a durable identity for one input occurrence. Probe artifacts also carried hashes calculated over different representations of a manifest.

## Observation

For repeatable evidence comparisons, persist a stable key for each input occurrence alongside its result. A truncated or nonunique article ID cannot distinguish duplicate rows, and a refreshed sample can shift row positions. Hash fields also need an explicit contract that states the exact input bytes or serialization, encoding, normalization, and digest representation. Without both contracts, reviewers may be unable to pair candidates to exact inputs or distinguish changed data from different serialization.

## Evidence

The H5 comparison found 83 distinct shared exact input-URL hashes represented by 88 row occurrences in each artifact; differing duplicate multiplicities allowed at most 87 one-to-one row pairs. The #14 RPC candidate rows did not retain the exact input URL, and their 16-character `articleIdHash` was nonunique. Consequently, the persisted records did not support a cross-run candidate or identity comparison for those rows. In the #18 evidence, the raw manifest-file SHA-256 was `d1ed2bea…`, while the recorded manifest hash was `aaa88dc2…` because it hashes the compact serialized manifest; the row-array hash `fdbab474…` remained the same. These values describe different hash inputs, not a changed row array.

## Impact

Without stable per-occurrence keys and explicit hash semantics, an investigation can overstate that a candidate was reproduced for a previously confirmed input, misapply identity labels across duplicate rows, or spend time diagnosing a serialization difference as data drift. The same weakness can affect experiments that compare repeated samples, retries, labeled controls, and generated outputs.

## Local action

The H5 record in `docs/changes/14/technical-spike.md` documents the overlap limits and does not claim cross-run candidate agreement. No probe schema or production code was changed in this iteration. Future evidence capture should persist an exact-input key with every per-row candidate and label, define how duplicate occurrences are represented, and name each digest according to its exact byte/serialization contract.

## Cross-project relevance

This may apply to shared discovery templates, experiment tooling, and validation evidence conventions wherever artifacts are joined across runs. SideGig review can assess whether reusable guidance should require stable per-row keys and explicit hash-input contracts before accepting cross-run comparisons. This record does not prescribe or implement a central schema.

## Stable local references

- [GitHub Issue #14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14)
- [GitHub Issue #18](https://github.com/adunato/google-news-enriched-actor-poc/issues/18)
- `docs/changes/14/technical-spike.md`
- `docs/changes/14/hosted-probe-results.json`
- `docs/changes/18/input-manifest.json`
- `docs/changes/18/hosted-results.json`
- `docs/changes/18/hosted-run-metadata.json`
- `docs/changes/18/probe.mjs`
- `docs/learnings/issue-14-publisher-url-validity.md`
- `docs/learnings/issue-14-calibration-failure-diagnostics.md`
