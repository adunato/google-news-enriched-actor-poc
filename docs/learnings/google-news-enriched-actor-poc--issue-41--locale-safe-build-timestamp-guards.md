# Learning Record

**Learning ID:** `google-news-enriched-actor-poc--issue-41--locale-safe-build-timestamp-guards`

**Origin repository:** `adunato/google-news-enriched-actor-poc`

**Source:** GitHub Issue #41, Technical Spike for Google News publisher resolution and full-text viability

**Lifecycle stage / skill:** Technical investigation / `technical-spike`

**Date:** 2026-10-07

**Category:** Tooling/CI

**SideGig review:** Yes

**Disposition:** Captured

## Change context

Issue #41's approved R6 diagnostic sequence allowed one monitored Apify Actor build, with a 120-second guard before one best-effort abort. The operator used PowerShell to inspect a JSON timestamp in a locale-sensitive build monitor. A premature abort consumed the single authorized build attempt before the image, exact runtime, or offline observer gate was reached. No hosted run began.

## Observation

Do not pass protocol timestamps through locale-sensitive display conversion when they drive a destructive timeout decision. Preserve the original JSON string, require an explicit ISO-8601 offset, parse invariantly, and use a monotonic clock for elapsed duration. Validate the timestamp against a fresh server status before acting; ambiguous or conflicting evidence should stop without an automatic abort.

## Evidence

The monitor's `ConvertFrom-Json` path materialized the ISO `startedAt` as `System.DateTime`; casting it to string under PowerShell 7.6.5 `en-GB` produced `10/07/2026 20:04:21`, which the later parse treated as July 10. The computed guard age was 7,693,201.398 seconds, while a later GET for the same build reported `2026-10-07T20:04:21.456Z`; the abort followed that GET timestamp by 0.946 seconds. The original POST body and immediate pre-abort GET receipt time were not retained, so the exact original timestamp and discrepancy cause are not reconstructable. A synthetic offline regression reproduces the locale-conversion failure mode, and the corrected parser/guard checks passed under `en-GB` with zero network/API/build/run/abort calls.

## Impact

A locale conversion can turn a valid server timestamp into a plausible but different calendar date. If that value controls an abort or other irreversible timeout action, the monitor can destroy a valid operation and consume a one-shot authorization. A local synthetic test can validate parser and guard behavior without being misrepresented as evidence about the original server response.

## Local action

The R6 operator monitor now reads raw JSON with `System.Text.Json`, preserves the timestamp string, rejects timestamps without an explicit offset, validates the original and fresh server anchors, and uses a monotonic guard beginning at successful POST receipt. Invalid or conflicting inputs return Hold without an automatic abort. Offline regression cases are in `docs/changes/41/experiments/r6-dependent-signal/r6-build-monitor-check.ps1`; monitor logic is in `r6-build-monitor.psm1`.

## Cross-project relevance

This applies to shared operator scripts, deployment tooling, and CI guards that turn API timestamps into abort, retry, cleanup, or expiry decisions. The SideGig tooling convention should distinguish raw protocol values from localized display values and prefer monotonic elapsed-time checks with fail-closed handling for uncertain anchors.

## Stable local references

- GitHub Issue #41: https://github.com/adunato/google-news-enriched-actor-poc/issues/41
- `docs/changes/41/technical-spike.md` — B2-R6 build attempt and next-attempt approval checkpoint
- `docs/changes/41/experiments/r6-dependent-signal/r6-operator-evidence.json`
- `docs/changes/41/experiments/r6-dependent-signal/r6-build-monitor.psm1`
- `docs/changes/41/experiments/r6-dependent-signal/r6-build-monitor-check.ps1`
