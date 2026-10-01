# H15 local origin-classifier preflight

Checked 2026-10-01. No Apify API call, remote build, or hosted run was made.

- Local package install completed with no external dependencies; `npm test`
  passed 11/11 tests and `npm run preflight` passed.
- Apify schema validation passed for the empty-object input schema.
- The pinned `apify/actor-node` image was already present locally. Docker build
  succeeded with `--network none`; container runs also used `--network none`.
- A synthetic private-address input produced only the fixed
  `private_origin_in_apify_runtime_unverified` category and redacted shape
  classes; the missing-variable case emitted `missing`. The classifier did
  not return host, address, port number, path, query, fragment, userinfo or raw
  environment values.
- The process-level test's loopback listener received zero connections.
  Static checks found no SDK import, dynamic import, HTTP, DNS, socket, storage,
  Worker or child-process dispatch in the Actor entrypoint/import graph.
- Both launcher dry-run modes reported `remoteMutation: false`; no CLI API
  transport was invoked. They pin a 9-file source digest of
  `9b09595a8b4432f32efa349c4ac42da11c88cb4bea7e6f270e5e66b0871944af` and the
  base image digest
  `apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`.

The observed production runtime value remains unknown. These synthetic
categories do not establish the source or trustworthiness of an internal-looking
origin and do not authorize changing the H14 allowlist.
