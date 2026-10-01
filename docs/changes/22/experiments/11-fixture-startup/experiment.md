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
environment variables are removed. The SDK event WebSocket is disabled. Parent
and worker negative probes run before the fixture flow, with the loopback stub
checked for calls during those probes.

The import-graph check reviews the fixed entrypoint, guard, SDK stub, worker,
I10 extraction modules, and supporting modules for live probe/network imports,
dynamic or native loads, and direct Undici access. The output stores only fixed
counts, stage names, and allowlisted aggregate fields; it contains no fixture
article text or request query values.

## Result

The run completed through SDK initialization, exact fixture input acceptance,
Readability extraction, and one verified aggregate write. The worker returned
`complete` / `success` with a positive word count. All five frozen API tuples
matched; allowed SDK calls were 1 initialization, 2 input reads, and 2 aggregate
write calls. There were no unlisted application calls, tuple misses, denied
sockets in the normal fixture flow, or stub calls during negative probes. The
parent guard blocked all 15 probes and the worker guard blocked all 42 probes.
The import graph passed for seven reviewed modules.

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

The runner exits nonzero on any failed guard, unexpected SDK tuple, malformed
fixture input, failed extraction, unexpected aggregate, or import-graph check.

## Limits and decision

This establishes that the bounded fixture path reaches and completes local
SDK-backed extraction under a container with networking disabled. It does not
prove zero wire egress at the operating-system level, parity with the hosted
Apify runtime's SDK tuple set, successful publisher URL resolution or live
article extraction, or a successful hosted Actor start. The loopback tuple set
is evidence for this pinned local image only. The original I10 live 100-result
hosted check remains unresolved; H12 does not unblock it or close Issue #22.
