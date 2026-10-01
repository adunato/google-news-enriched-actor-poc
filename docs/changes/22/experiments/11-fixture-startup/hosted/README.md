# H14 hosted fixture diagnostic candidate

This is a separate, fixture-only Apify Actor candidate for Issue #22. It runs
the existing bounded Mozilla Readability worker against one bundled synthetic
HTML article. It does not import the Google News probe or publisher-fetch path,
and its input schema accepts only `fixture-only` with
`readability-positive-v1`.

## Local checks

The package pins Apify SDK 3.7.2, `apify-client` 2.25.0, Crawlee 3.18.2,
Mozilla Readability 0.6.0, LinkeDOM 0.18.13, and the Apify Node base image by
digest. From this directory:

```powershell
npm ci
npm run preflight
docker build -t issue22-h14-hosted-local .
docker run --rm --network none issue22-h14-hosted-local node src/preflight.mjs
npm run launch:self-test
npm run launch:dry-run
```

The preflight exercises the complete local SDK/input/worker/aggregate/readback
flow against a loopback SDK stub, repeats the fixed fixture twice, and runs
negative API probes in separate parent and Worker processes. The container
preflight passed with external networking disabled. These checks establish
local behavior for this exact package. They do not establish hosted SDK tuple
parity or prove that every possible operating-system egress path is blocked.

## Hosted launcher and run gate

`tools/hosted-launcher.mjs` uses the authenticated `apify api` CLI transport, so
it does not read, export, or print an API token. It defaults to dry-run. Dry-run
prints the deterministic source file hashes, source digest, lockfile hash,
pinned base digest, exact actor-create body digest, build query, and run query.
The remote source payload is generated only from
`tools/deploy-file-list.json`; local preflight, mock, and launcher files are
excluded.

Any later remote invocation requires both `--execute` and explicit
`--reviewed-commit <sha> --reviewed-source-sha256 <digest>`. The launcher checks
that HEAD and the source digest match those reviewed values and that the H14
package worktree is clean. Before actor creation it checks all owned Actor
names and refuses an exact or similarly prefixed collision. It only creates a
new private Actor, never targets an existing Actor for update. It reads back
the Actor, uploaded version source, and built source before starting a run.
The run request pins the exact successful build number and sends 256 MiB, 180
seconds, $0.10, restart disabled, and limited permissions. It then reads the
run by ID and verifies the returned build ID/number, memory, timeout, and charge
cap. No POST is retried automatically.

After a reviewer has approved and committed the exact candidate, the execution
form is:

```powershell
node tools/hosted-launcher.mjs --execute --reviewed-commit <reviewed-commit-sha> --reviewed-source-sha256 <dry-run-source-digest>
```

If a response is lost after Actor creation, or a readback gate fails after
creation, the launcher stops and leaves the newly created Actor private for
manual inspection. It never retries the create/build/run POST and never
deletes an Actor automatically.

Apify's Actor run response does not expose `restartOnError` or the effective
permission override in the returned run options. The launcher verifies the
Actor's private/default limited-permission settings before POST, sends the
exact run query parameters, checks the post-run fields Apify exposes, and
records this API limitation without claiming those two fields were echoed.
The separate SDK API retry setting is source-checked as `maxRetries = 0` before
`Actor.init`; it is not a platform run option.

The Actor entrypoint independently rejects a hosted runtime whose run/build
identity, permission level, limits, or retry setting do not match. Its first
sanitized output is emitted at process exit, so a crash before the startup
marker can still produce no stage output. Apify's platform logs may contain
startup details for such a crash; the launcher does not fetch or retain those
logs. Keep the input exactly as shown in `run-options.json`.

The authenticated CLI route was confirmed with read-only checks. This launcher
has not been executed remotely: no Actor was created, no remote build was
started, and no hosted run was made. The manifest's seven Apify API tuples are
derived from the locally observed SDK 3.7.2/client 2.25.0 flow and remain
unverified against a hosted run. A future hosted diagnostic must stop on any
tuple miss; do not broaden the manifest based on an unexplained request.

The launcher follows Apify's documented [Create Actor](https://docs.apify.com/api/v2/actors-post),
[Build Actor](https://docs.apify.com/api/v2/actors-builds-post), [Get Actor version](https://docs.apify.com/api/v2/actor-version-get),
[Get build](https://docs.apify.com/api/v2/actor-build-get), and [Run Actor](https://docs.apify.com/api/v2/actors-runs-post)
API schemas. If a source/configuration field is not returned exactly as
required, it stops before the next mutating request.

Output contains fixed stage names, bounded result counts, aggregate/readback
booleans, and API counters. It intentionally omits article content, credentials,
Actor identifiers, raw exceptions, and response bodies.
