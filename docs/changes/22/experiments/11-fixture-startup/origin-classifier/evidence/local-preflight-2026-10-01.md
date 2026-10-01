# H15 local origin-classifier preflight

Checked 2026-10-01. No Apify API call, remote build, or hosted run was made.

- Local package install completed with no external dependencies; `npm test`
  passed 12/12 tests and `npm run preflight` passed.
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
- The exact 12 test cases cover: (1) missing/malformed categories; (2) stable
  ordered 16-key shape and types across missing, malformed, oversized, public,
  and private-like values; (3) documented-public/other URL shapes; (4) private
  and loopback categories; (5) credentials/query/fragment redaction; (6) zero
  loopback listener hits; (7) static no-dispatch imports; (8) reviewed commit,
  digest and clean-tree binding; (9) private Actor/build preparation without a
  run; (10) collision and pre-build mismatch stops; (11) exact one-run path;
  and (12) tag/source/prior-run refusal before a run POST.
- Both launcher dry-run modes reported `remoteMutation: false`; no CLI API
  transport was invoked. They pin a 9-file source digest of
  `9e71b6ef145d9d0f956921a00f73b38a8974fb357f0687e2a568bac909bf482f` and the
  base image digest
  `apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`.

The observed production runtime value remains unknown. These synthetic
categories do not establish the source or trustworthiness of an internal-looking
origin and do not authorize changing the H14 allowlist.

**H15 hosted run count across builds:** 0. No H15 Actor or build was created,
and no H15 hosted run has been started.
