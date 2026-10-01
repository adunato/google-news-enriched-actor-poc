# H15-B private-origin fixture diagnostic

H15-B is a separate, private Apify Actor candidate for Issue #22. It runs the
existing bounded Mozilla Readability worker against one bundled synthetic
HTML article. It does not import the Google News probe or publisher-fetch path;
its input schema accepts only `fixture-only` with
`readability-positive-v1`.

H14 failed before its application marker because its guard allowed only the
documented public API hostname. A separate H15 no-dispatch diagnostic observed
a private IPv4 URL shape alongside `APIFY_IS_AT_HOME=1`. That observation does
not prove platform provenance. H15-B tests the bounded assumption that the
runtime-injected value is the API service for this private run.

## Runtime origin boundary

Before SDK import, the preload requires `APIFY_IS_AT_HOME=1` and accepts only
an HTTP URL with a canonical RFC1918 IPv4 literal, explicit nondefault port,
and root path. It rejects public, loopback, link-local, multicast,
unspecified, shared, malformed, HTTPS, default-port, path, credential, query,
and fragment variants. Both no-trailing-slash and trailing-slash root forms
are accepted because the URL parser normalizes each to `/`.

Known proxy override variables cause a fixed-code startup rejection; their
values are not read into evidence, printed, or silently removed. The SDK
allowlist binds each of the seven pinned method/path/phase tuples to the
validated in-memory IP and port. The socket guard permits only that same
address and port for those tuples. Hosted DNS is denied, redirects to any
other origin or route miss the tuple allowlist, and application/Worker network
calls remain denied. Observed tuple output uses fixed route templates and a
fixed `runtime_validated_private_ipv4` label; it never includes the runtime
address, port, resource IDs, or raw URL.

This is a shape-based, bounded diagnostic assumption, not cryptographic origin
verification. A platform or run-level environment override could imitate the
same shape. The new Actor has no custom environment variables configured, and
the launcher creates a distinct private Actor rather than modifying H14.
Reject any run if Actor/version readbacks show custom environment variables or
if the preload sees a proxy override.

## Local validation

From this directory:

```powershell
npm ci
npm run launch:self-test
npm run preflight
docker build -t issue22-h15b-hosted-local .
docker run --rm --network none issue22-h15b-hosted-local node src/preflight.mjs
node tools/hosted-launcher.mjs
```

Tests exercise the runtime gate across accepted private IPv4 ranges and
rejected origin/proxy classes. Preflight runs the existing local SDK stub,
checks all seven exact routes, denies 15 parent and 42 Worker API probes,
rejects malformed input before starting the Readability worker, repeats the
valid synthetic fixture twice, and confirms the fixed aggregate and readback
(26 words, 186 characters). Local stub runs use a fixed loopback origin and do
not validate the hosted private origin.

The Docker command runs the local SDK stub with external networking disabled.
These checks establish local behavior for this exact package; they do not
prove every operating-system egress path is blocked or prove ownership of the
hosted origin.

## Exact candidate launch path

The package pins Apify SDK 3.7.2, `apify-client` 2.25.0, Crawlee 3.18.2,
Mozilla Readability 0.6.0, LinkeDOM 0.18.13, and the Apify Node base image by
digest. `tools/hosted-launcher.mjs` defaults to dry-run, reads no token, and
uses the authenticated `apify api` CLI transport only after explicit reviewed
commit and exact source SHA-256 gates.

The execution path creates only the distinct `issue-22-h15b-private-origin-fixture`
Actor after a name-collision check. It requires private visibility,
`LIMITED_PERMISSIONS`, 256 MiB, 180 seconds, restart disabled, no custom
environment variables, empty SDK build environment, the exact uploaded
source, and a successful exact-source build. It rereads Actor, source, tag and
build state before the only run POST, checks run history twice for that build,
and sends the fixture-only input with a `$0.10` max charge and SDK HTTP retries
set to zero. It never targets the prior H14 Actor and does not retry create,
build, or run POSTs.

After a separate review of the clean committed candidate and source digest,
the bounded launch form is:

```powershell
node tools/hosted-launcher.mjs --execute --reviewed-commit <reviewed-commit-sha> --reviewed-source-sha256 <dry-run-source-digest>
```

The H15-B source package has not been built or run on Apify. The earlier H14
Actor remains unchanged. H15-B's future hosted run must stop on any origin,
proxy, Actor, source, build, settings, or run-history gate failure. A
`private_origin_in_apify_runtime_unverified` classification alone is not
permission to broaden this allowlist.
