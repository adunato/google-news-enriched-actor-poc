# H12 fixture-only startup diagnostic

## Question

Does the H12 local fixture path reach the Readability worker, receive one
synthetic fixture result, and persist one aggregate through the Apify SDK when
external networking is unavailable? This diagnostic follows the I10 hosted
startup failure, which occurred before article data was processed. It does not
test publisher access, live Google News input, or hosted startup behavior.

## Method

The entrypoint uses the actual pinned Apify SDK and the bounded Readability
worker from I10. Its only accepted input is the exact fixture identifier
`readability-positive-v1`; the bundled synthetic HTML is served directly to the
worker. A loopback stub emulates the five observed SDK API tuples. A preload
guard freezes and enforces those tuples by origin, method, normalized path, and
phase. It rejects unlisted application requests and external sockets, and
replaces fetch, HTTP(S), DNS, and socket access with fail-closed checks. Proxy
environment variables are removed. The SDK event WebSocket is disabled. A
malformed full Actor input run verifies rejection before any Worker starts.
Separate runner processes perform the negative parent and Worker probes under
the same preload; the loopback stub is checked for calls during those probes.
The valid Actor run starts exactly one known Readability Worker, with the
preload explicitly included in that Worker's `execArgv`.

The import-graph check is a fixed seven-file lexical screen for selected
forbidden import names, dynamic import syntax, native-load patterns, and a
direct Undici import. It does not resolve the transitive dependency graph or
prove the absence of APIs behind aliases, computed names, or dependency
internals. It does not completely inspect TLS, HTTP/2, WebSocket,
`child_process`, native addons, or arbitrary Worker behavior. The output stores
only fixed counts, stage names, and allowlisted aggregate fields; it contains
no fixture article text or request query values.

## Result

The malformed input was rejected after SDK input retrieval and before any
Worker started (`workerCount: 0`). Two valid fixture runs each started exactly
one guarded Readability Worker after the input gate and returned `complete` /
`success`, 26 words, and 186 output characters; the fixed fixture SHA-256 and
both results matched between runs. Each run persisted one verified aggregate.
All five frozen SDK tuples matched; allowed SDK calls were 1 initialization, 2
input reads, and 2 aggregate write calls. The normal runs had zero denials,
tuple misses, or denied sockets. In the separate negative-probe process, the
parent guard blocked all 15 probes and the Worker guard blocked all 42; no
request reached the stub. The seven-file lexical screen passed its stated
patterns, subject to the exclusions above.

The evidence record is [`evidence/local-result.json`](evidence/local-result.json).
It was produced in the immutable Apify Actor Node image
`apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`
with Docker `--network none`. The container reported Node 20.20.2, Apify 3.7.2,
Apify client 2.25.0, Mozilla Readability 0.6.0, and LinkeDOM 0.18.13.

## Reproduction

From the repository root in PowerShell, with Docker available and the pinned
image already present locally:

```powershell
$repoRoot = (Get-Location).Path
$image = 'apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63'
docker run --rm --network none --mount "type=bind,source=$repoRoot,target=/workspace" --workdir /workspace -e H12_IMAGE_DIGEST=$image $image node docs/changes/22/experiments/11-fixture-startup/src/run-local.mjs --write-evidence
```

The runner exits nonzero unless the malformed-input rejection, separate
negative probes, both repeatable valid fixture runs, tuple manifest, exact
aggregate schema, and lexical-screen checks pass.

## Limits and decision

This establishes that the bounded fixture path reaches and completes local
SDK-backed extraction under a container with networking disabled and the
listed JavaScript API guards. It does not prove zero wire egress at the
operating-system level, full transitive API coverage, parity with the hosted
Apify runtime's SDK tuple set, successful publisher URL resolution or live
article extraction, or a successful hosted Actor start. The loopback tuple set
is evidence for this pinned local image only. The original I10 live 100-result
hosted check remains unresolved; H12 does not unblock it or close Issue #22.

## Owner authority update and next iteration

On 2026-10-01, the owner expanded authority to “test Mozilla Readability on
Apify”, make the POC work there, diagnose failures and continue changed
iterations without per-iteration approval. This supersedes the earlier
H12 checkpoint language that required separate approval before any hosted
run. It authorizes the bounded work below; it does not imply that a hosted run
has occurred or that the local result proves hosted behavior.

The next step is H14: prepare and independently check a changed
fixture-only candidate, then run it privately on Apify. Preserve the exact
fixture input and Readability worker; add fixed startup/error stages and
sanitized counters. Allow only documented and source-checked SDK destination
and operation tuples, fail closed on unknown calls, activate the parent guard
before application imports, and verify coverage markers/counters in every
reachable Worker. No Google or publisher request is part of fixture mode.
Each run is limited to 256 MiB, 180 seconds and $0.10, with restarts and
retries disabled.

If a hosted candidate fails, diagnose its logs, stage markers, SDK counters,
dataset and resource evidence, make a relevant change, then repeat the bounded
fixture run. Never rerun an unchanged failed candidate. If the failure
evidence does not identify a viable corrective action, a required platform
capability is unavailable, or continued work would cross the stated bounds or
Issue #22/product constraints, report that blocker and the recovery decision
needed.

A successful fixture run establishes only that this Readability path starts,
extracts the bundled sample and persists its aggregate on hosted Apify. Then
prepare a fresh 100-slot live cohort under the existing query, locale,
recency, deduplication, publisher-access, privacy and per-row failure rules to
measure the >=50 qualifying unique article target. The fixture result alone
does not measure live publisher success.

### First H14 remote preparation attempt (2026-10-01)

Apify accepted creation of private Actor `6cJ0cY4Xe7d5xyjL3` with default
`LIMITED_PERMISSIONS`; the configured run defaults were 256 MiB, 180 seconds
and restart disabled. Build `6lNNucwesR5s5YL5y` (`1.0.1`) succeeded from the
exact 18-file source snapshot (digest prefix `b90e0a9d`). Build cost was about
$0.002707 and elapsed time was 12.182 seconds.

The launcher stopped before posting a run because its build-tag readback
comparison produced a false negative. The returned Apify build object had a
`.buildId` matching the requested build, while the launcher expected a bare
string. This identifies a local launcher validation defect; the Actor process
did not start and no runtime failure occurred. There is no run ID, run cost,
run log, dataset or hosted Readability result. The sanitized preparation
evidence is
[`evidence/attempt-2026-10-01-pre-run-stop.md`](evidence/attempt-2026-10-01-pre-run-stop.md).

**Pre-first-run gate (resolved):** H14 remained authorized under the owner's expanded
authority, but do not submit the run until the comparison is corrected,
focused checks and independent review pass, and fresh readbacks confirm the
same private Actor/build and bounded settings. Then resume against this same
reviewed source build. If a later hosted run starts and fails, diagnose its
evidence and change the candidate before another run; do not repeat an
unchanged failed candidate. Each actual run remains capped at 256 MiB, 180
seconds and $0.10, with restarts/retries disabled. This gate was cleared for
the H14 run documented below; the current gate is H15.

### H14 hosted run result (2026-10-01)

After correcting the false-negative build readback, private run
`Gs1W120Uqdic08LtY` started on Actor `6cJ0cY4Xe7d5xyjL3`, build
`6lNNucwesR5s5YL5y` (`1.0.1`). Readbacks showed `LIMITED_PERMISSIONS`, 256 MiB,
180 seconds, $0.10 maximum charge and restart disabled. The run failed with
exit code 1 after 1.925 seconds, cost approximately $0.0000737073, and
produced zero dataset items. Its fixed sanitized log code was
`h14_api_origin_rejected`, before an application result. There is no
Readability output or publisher evidence. Full sanitized evidence is
[`evidence/resume-run-2026-10-01.md`](evidence/resume-run-2026-10-01.md).

The candidate's guard pins the public Apify API origin. Pinned Apify SDK 3.7.2
configuration and maintainer issue #744 indicate the platform may supply an
internal API base through `APIFY_API_BASE_URL`; the actual runtime origin
value was not retained, so this remains an unconfirmed explanation. The
failure establishes an API-origin guard rejection before Readability
processing, not an extraction failure. The tested H14 candidate is on HOLD
and must not be retried unchanged.

**Next diagnostic — H15-A:** run a changed no-dispatch startup diagnostic
that emits only fixed stage codes and an allowlisted API-origin category. It
must not initialize the Apify SDK, make network calls, or execute the fixture
or Readability. Use a read-only audit of SDK/platform origin configuration
alongside its result; do not log the actual origin value.

**Conditional H15-B:** only if H15-A plus the read-only override audit
establish a trusted exact runtime API origin, update the fixture candidate to
allow that origin for only the required SDK operations while failing closed
for all others. Independently review and validate the candidate before a
bounded hosted run. If no exact trusted origin can be established, stop and
report the platform/configuration blocker rather than widening the allowlist.
The owner's expanded authority covers these changed diagnostic steps without
per-run approval. Each actual run retains private `LIMITED_PERMISSIONS`, 256
MiB, 180 seconds, $0.10 maximum, restarts/retries disabled, and no Google or
publisher traffic in fixture mode. The live 100-slot publisher target remains
untested.

**Learning checkpoint:** None. The evidence currently points to a specific
candidate guard/configuration mismatch; the internal-origin explanation is
not confirmed and does not yet support a portable learning.

**Learning checkpoint:** None. This is a specific launcher/API-shape defect,
not a reusable cross-project learning beyond the existing startup-diagnostic
learning record.
