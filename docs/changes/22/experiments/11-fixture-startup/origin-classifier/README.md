# H15 API-origin classifier

H15 is an isolated, no-dispatch Actor candidate for Issue #22. It reads only
`APIFY_API_BASE_URL` and `APIFY_IS_AT_HOME`, emits one fixed-shape category
record, and exits. It does not import the Apify SDK, read Actor input or
storage, resolve DNS, open sockets, send HTTP, or run the H14 Readability
worker. Its Actor input schema accepts only `{}`.

## What the categories establish

The classifier reports whether the API-base variable is missing, empty,
malformed, uses an unsupported scheme, resembles the documented public Apify
API URL, or has an internal-looking address shape. It reports scheme, broad
host class, effective port class, and path class without retaining or printing
the host, address, port number, URL path, query, fragment, or user information.
It also reports the `APIFY_IS_AT_HOME` signal separately.

These fields classify value shape. A private address observed in an Apify
runtime is labelled `private_origin_in_apify_runtime_unverified`; that does not
prove the address is an official platform service or establish where the value
came from. Apify's published JavaScript SDK configuration documents
`APIFY_API_BASE_URL` as defaulting to `https://api.apify.com`. H14 failed with
`h14_api_origin_rejected` because its stricter check rejected the runtime
value, but the value itself was not retained. H15 cannot reconstruct or attest
its provenance.

## Local checks

```powershell
npm ci
npm test
npm run preflight
node src/main.mjs
node tools/hosted-launcher.mjs
node tools/hosted-launcher.mjs --prepare
```

The tests use synthetic values and a loopback listener sentinel. The sentinel
must receive zero connections. No hosted build or run is part of local
preflight.

## Future hosted run gate

The candidate pins a Node base image digest and lockfile. It is configured for
a private Actor, LIMITED permissions, 256 MiB, 180 seconds, a $0.10 maximum,
restarts disabled, and empty input. The launcher defaults to a dry-run and
uses the authenticated `apify api` CLI transport. The separate
`--prepare --execute` mode checks for Actor name collisions, creates only a
new private Actor with the pinned source/settings, verifies it, and starts one
build. It never starts a run. The later run mode requires a reviewed commit
and exact 9-file source digest, explicit Actor and successful build IDs/number,
fresh private/settings/version/source/tag/build readbacks, and two run-list
checks showing no run for that build. It can issue only one run POST and
verifies the run by ID afterward. Both modes require a clean package and exact
reviewed commit/source values; neither retries POSTs. Do not execute either
mode until H15 source and dry-run have independent review and a separate hosted
authorization.

After separate authorization and independent review, the reviewed command
forms are:

```powershell
node tools/hosted-launcher.mjs --prepare --execute --reviewed-commit <reviewed-commit-sha> --reviewed-source-sha256 <dry-run-source-digest>
node tools/hosted-launcher.mjs --actor-id <prepared-actor-id> --build-id <prepared-build-id> --build-number <exact-build-number> --execute --reviewed-commit <reviewed-commit-sha> --reviewed-source-sha256 <dry-run-source-digest>
```

Apify's documented [Actor environment variables](https://docs.apify.com/actors/development/programming-interface/environment-variables)
and [JavaScript SDK configuration](https://docs.apify.com/sdk/js/reference/3.0/class/Configuration)
are references for the names and default API URL. They do not attest an
undocumented internal origin or environment-variable provenance.
