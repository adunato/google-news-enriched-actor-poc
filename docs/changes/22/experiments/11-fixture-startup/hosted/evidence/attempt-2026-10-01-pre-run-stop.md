# H14 hosted attempt: stopped before run

Date: 2026-10-01 UTC

## Decision

The launcher stopped at `build_tag_readback_mismatch` before the run POST. No
run was started. No dataset or run logs exist for this attempt. No follow-up
build/run mutation was made.

## Candidate and pre-run evidence

- Reviewed repository commit: `4d807c2fdc1cef80b32d589f5dbbe644f2e2473b`
- Reviewed uploaded source digest: `b90e0a9d7678953670c1ca397bfc33cf5d2265543e6f7af387562c7b6712dca9`
- Package-lock digest: `e21e311f2a5d741023b29989cb88bc1cb0e45cbe6fdd673b090df237814a7986`
- Base image: `apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`
- Actor ID: `6cJ0cY4Xe7d5xyjL3`
- Actor visibility readback: private (`isPublic: false`)
- Actor default run options read back: `LIMITED_PERMISSIONS`, 256 MiB,
  180 seconds, restart disabled
- Build ID: `6lNNucwesR5s5YL5y`; build number: `1.0.1`; status: `SUCCEEDED`
- Build source readback matched all 18 allowlisted files and the reviewed
  source digest exactly.
- Build request used version `1.0`, cache disabled, beta packages disabled,
  and tag `h14-fixture-v1-b90e0a9d7678`.

## Stop cause

The launcher expected `actor.taggedBuilds[tag]` to equal the build ID string.
Apify returned an object at that key, with `buildId`, `finishedAt`,
`buildNumberInt`, and `buildNumber` fields. The build ID in the object matched
the successful build, but the launcher's exact string comparison failed. This
was a launcher readback-shape mismatch, not a build or source mismatch.

The launcher did not send the run POST after this failed gate. Do not treat this
attempt as fixture viability evidence. The correction must pass independent
review and fresh readback checks before resuming. The owner's existing expanded
H14 authority covers a changed/corrected run within the stated per-run bounds;
no additional per-run approval is required while work remains within that scope.

## Build resource and cost evidence

- Build duration: 12.182 seconds
- Build compute units: 0.013535555555555556
- Build image size: 550,480,896 bytes
- Build memory allocation: 4,096 MiB; disk allocation: 8,192 MiB
- Build platform usage total: $0.0027071111111111115 (compute units only)
- No Actor run cost was incurred because no run was started.

No raw build log, response body, credential, article content, or dataset output
was collected into this evidence artifact.
