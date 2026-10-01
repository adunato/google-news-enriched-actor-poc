# H15-B local preflight — 2026-10-01

## Candidate identity

- Candidate Actor name: `issue-22-h15b-private-origin-fixture` (distinct from the prior H14 Actor).
- Source SHA-256 from launcher dry-run: `3c5a2c7240399578257b38d9b814f920701153da3d1e99d1d85ce6c7684d671c` across 19 deploy files.
- Base image: `apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`.
- Dry-run confirms private visibility, `LIMITED_PERMISSIONS`, 256 MiB, 180 seconds, restart disabled, `$0.10` run cap, exact fixture-only input, and no remote mutation.
- The working package is intentionally uncommitted/dirty; the launcher therefore refuses execution until a clean reviewed commit and exact source digest are supplied.
- No Apify Actor, build, or run was created or started in this iteration.

## Origin gate and local tests

- Unit/launcher tests: 14/14 passed.
- Hosted origin helper accepts canonical RFC1918 IPv4 HTTP origins with an explicit nondefault port and root path, with or without a trailing slash; it requires `APIFY_IS_AT_HOME=1`.
- Synthetic negatives cover public, loopback, link-local, multicast, unspecified, shared, HTTPS, absent/default/invalid ports, non-root paths, userinfo, query, fragment, malformed/canonicalization variants, and the recognized proxy override variables.
- Child-process checks confirmed the pre-import preload rejects unsafe origins and proxy overrides using fixed error codes without echoing supplied values.
- The tuple guard binds the seven pinned SDK method/path/phase routes to the in-memory approved host and port. Hosted DNS is denied, proxy overrides fail closed, application and Worker network probes remain denied, and tuple evidence retains only fixed route templates.

## Full local flow

- `npm run preflight`: passed. Two valid synthetic fixture runs each produced 26 words and 186 output characters, wrote/read back the fixed aggregate, and matched all seven expected SDK tuples.
- Negative probes: all 15 parent attempts and all 42 Worker attempts were denied.
- A synthetic same-origin redirect to an unlisted route caused one tuple miss, returned the fixed `h15b_network_denied` result, and never reached the redirect target.
- Docker image build succeeded. Container preflight passed with `docker run --network none`; it repeated the tuple, redirect, probe, and fixture checks.
- Launcher dry-run produced the source digest above and confirms `remoteMutation: false`.

## Limits

H15 observed only a private IPv4 URL shape alongside the Apify runtime signal; it did not establish origin provenance. H15-B relies on the bounded platform-injection assumption for one fixture diagnostic. If the hosted Actor lacks the required runtime signal, reports a proxy override, uses any other origin shape, misses a tuple, or exposes custom Actor environment variables, it must stop without broadening the gate. Hosted behavior remains untested, and this candidate makes no live publisher or Google News request.
