# H15 local API-origin classifier candidate

**Hypothesis:** A bare Node entrypoint can report the broad shape of the
`APIFY_API_BASE_URL` value in an Apify runtime without sending requests or
retaining the origin value. Its result can distinguish a documented public
Apify API URL from malformed, other-public, and private-address categories for
subsequent controlled investigation.

**Boundary:** Local-only candidate and preflight. No remote Actor/build/run,
no SDK initialization, no dataset output, and no Google or publisher traffic.

## Evidence basis

- H14 run `Gs1W120Uqdic08LtY` failed in 1.925 seconds with the fixed log code
  `h14_api_origin_rejected`; there was no application result marker or dataset
  item. H14's actual environment value was not retained.
- Official Apify JavaScript SDK documentation identifies
  `APIFY_API_BASE_URL` as the API base URL and documents the default as
  `https://api.apify.com`. Official Actor environment-variable documentation
  also describes the public API URL. Neither establishes an internal host for
  the observed H14 failure.
- A live read-only configuration audit found no custom H14 Actor-version
  environment variables. This does not expose the platform runtime value or
  attest its provenance.

## Classifier contract

`src/main.mjs` reads the two named environment variables, calls only the pure
URL-shape classifier, writes one schema-versioned fixed-shape JSON record, and
exits. Values are not copied into results, hashed, logged, or persisted.
Private-looking values are always marked unverified, including when
`APIFY_IS_AT_HOME=1`; the variable shape cannot prove platform ownership or
separate a platform value from an override.

## Local experiment

`npm test` runs synthetic missing, malformed, documented-public, other-public,
private IPv4/IPv6, loopback, credentials/query, scheme and path cases. An
integration test starts a loopback listener as a sentinel, runs the candidate
with that address as the synthetic API base, and requires zero connections.
A static entrypoint check rejects SDK, storage, DNS, socket, HTTP, Worker and
dynamic-import paths.

## Interpretation and limit

A passing local test verifies only the classifier and no-dispatch code paths
that were exercised. Since the actual hosted base URL was not observed, this
candidate cannot yet confirm why the H14 guard rejected it. Even a future
category such as `private_origin_in_apify_runtime_unverified` is a shape
classification, not authorization to add that origin to an HTTP allowlist.
