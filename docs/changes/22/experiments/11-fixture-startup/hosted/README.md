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
```

The preflight exercises the complete local SDK/input/worker/aggregate/readback
flow against a loopback SDK stub, repeats the fixed fixture twice, and runs
negative API probes in separate parent and Worker processes. The container
preflight passed with external networking disabled. These checks establish
local behavior for this exact package. They do not establish hosted SDK tuple
parity or prove that every possible operating-system egress path is blocked.

## Hosted run gate

Before any later hosted run, build this exact reviewed source and record its
immutable build identity. Verify the Actor is private and its permission level
is `LIMITED_PERMISSIONS`; `run-options.json` records the required candidate
settings: 256 MiB, 180 seconds, $0.10 maximum charge, restart disabled, and SDK
API retries set to zero. The entrypoint independently rejects a hosted runtime
whose run/build identity, permission level, limits, or retry setting do not
match. Keep the input exactly as shown in `run-options.json`.

The CLI authentication route was confirmed with a read-only status check. No
Actor was created, no remote build was started, and no hosted run was made for
this candidate. The manifest's seven Apify API tuples are derived from the
locally observed SDK 3.7.2/client 2.25.0 flow and remain unverified against a
hosted run. A future hosted diagnostic must stop on any tuple miss; do not
broaden the manifest based on an unexplained request.

Output contains fixed stage names, bounded result counts, aggregate/readback
booleans, and API counters. It intentionally omits article content, credentials,
Actor identifiers, raw exceptions, and response bodies.
