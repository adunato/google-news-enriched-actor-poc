---
name: apify-actor-deployment
description: Deploy and operationally validate an Apify Actor release candidate, including Apify schema/package checks, exact-build hosted runs, dataset/API/log/cost evidence, memory sizing, monetization readiness, publication gating, and release-fix routing.
---

# Apify Actor Deployment

Use this skill for a SideGig product repository whose deployable product is an Apify Actor.

This is a platform-specific release skill. It complements rather than replaces:

- `prepare-release` for release-candidate creation and the `release/*` → `staging` promotion PR;
- `staging-validation` for the overall pre-production acceptance decision;
- `promote-release` for `main`, immutable tag/GitHub Release, production/public deployment, smoke verification, and cleanup;
- `capture-learning` for reusable lessons.

When the central SideGig source is available, the detailed reference is `implementation/apify/actor-deployment-playbook.md`. The deployed skill remains self-contained and must not depend on that file being present in a product repository.

## Preconditions

Before deploying:

1. identify the active `release/vMAJOR.MINOR.PATCH` branch and exact candidate commit;
2. confirm required repository/CI validation is green;
3. confirm the candidate was explicitly promoted to `staging`;
4. define a representative hosted input and expected dataset/API contract;
5. keep the Actor private/unlisted.

Do not use an arbitrary working-tree state as release evidence.

## 1. Apify preflight

Run the repository validation contract.

Then run:

```text
apify validate-schema
```

Inspect `.actor/actor.json` and referenced input/output/storage schemas.

Apify input schemas contain platform-specific requirements beyond generic JSON Schema. Verify the `editor` requirements for each field type rather than assuming generic JSON Schema is sufficient. In the current specification, string fields require an editor; numeric and boolean editors are optional. Missing **required** editor metadata is a release-blocking Apify configuration defect even if local runtime validation passes.

Inspect deployment ignores. Use `.actorignore` to exclude transient validation/evidence files and `.gitignore` when those files should also never be committed.

Typical transient exclusions:

```text
apify-validation-output/
apify-test-input.json
apify-validation-dump*.bat
```

Do not exclude actual Actor source/configuration.

Be aware that current Apify CLI chooses upload source type by size: below 3 MB it uploads multiple source files; at 3 MB or above it uploads a ZIP. If a push unexpectedly switches to `Zipping Actor files`, check package contamination/size before treating a later archive error as an application defect.

## 2. Deploy the exact candidate

From the current active release branch:

```text
git fetch origin
git switch release/vMAJOR.MINOR.PATCH
git pull --ff-only origin release/vMAJOR.MINOR.PATCH
apify push --json
```

Record release commit, Actor ID, build ID, build number, status, URL, and exit code.

Classify failures before changing source:

- application/source defect;
- Apify schema/configuration defect;
- deployment packaging/transport defect;
- account/platform prerequisite;
- transient platform failure.

If correction requires code or version-controlled configuration, create/reference a Bug Issue, fix from the active release branch through the release-fix lifecycle, merge the fix into the release branch, re-promote to `staging`, and retest. Do not patch the deployed Actor ad hoc.

A safe retry of identical immutable contents does not require a new release state.

## 3. Prepare hosted input safely

Prefer `--input-file` for Windows/PowerShell and other environments where inline JSON quoting is fragile.

PowerShell BOM-safe example:

```powershell
$json = '{"example":"value"}'
[System.IO.File]::WriteAllText(
    "$PWD\apify-test-input.json",
    $json,
    [System.Text.UTF8Encoding]::new($false)
)
```

Do not assume a file written as generic UTF-8 is BOM-free. A BOM can make the Apify JSON parser reject the first token.

Run the exact build:

```text
apify actors call <actor-id> -b <build-number> --input-file ./apify-test-input.json --json
```

Use `-m <megabytes>` only for an intentional memory-sizing experiment.

If `--silent` suppresses the call output, identify the run with:

```text
apify runs ls <actor-id> --desc --limit 1 --json
```

## 4. Hosted acceptance and output verification

A hosted run is not accepted merely because the CLI returned.

Record run ID, build ID/number, terminal status, exit code, duration, default dataset ID, and other material default storage IDs.

Require:

- `SUCCEEDED`;
- intended input accepted;
- product-specific limits respected;
- required dataset fields/types/semantics present;
- dedupe/order behavior correct where applicable;
- normal downstream dataset/API retrieval works;
- no unclassified runtime failure.

Retrieve the dataset through the user-facing storage path:

```text
apify datasets get-items <dataset-id> --format json
```

## 5. Operational evidence

Capture:

```text
apify runs info <run-id> --json --verbose
apify runs log <run-id>
```

Inspect and record:

- status/exit code;
- build identity;
- duration;
- compute units;
- configured, average, and peak memory;
- material CPU/network figures;
- dataset/storage operations;
- total platform usage cost and useful breakdown;
- billing model / max-charge state when relevant;
- output/API links;
- Actor visibility;
- warnings/errors.

When collecting outputs from a Windows `.bat`, invoke the CLI as `call apify ...` because the installed executable may resolve to `apify.cmd`; without `call`, the parent batch can stop after the first command.

Never leave generated evidence inside the Apify deployment payload.

## 6. Right-size memory

Treat memory as an evidence-based release setting.

1. Record baseline configured/peak memory, duration, compute units, and platform cost.
2. Select a conservative lower test allocation above measured peak plus reasonable headroom.
3. Run the same workload with `-m <candidate-mb>`.
4. Compare functional output and operational metrics.
5. If it passes, set `defaultMemoryMbytes` explicitly in `.actor/actor.json`.
6. Add a deterministic regression assertion where practical.
7. Route the change through the release-fix/re-promotion path.
8. Rebuild.
9. Run the representative workload again **without** `-m`.
10. Confirm `options.memoryMbytes` in verbose run metadata equals the intended default.

This is required before monetization when memory materially affects creator platform cost or charging economics.

## 7. PPE and publication readiness

Do not publish the Actor merely because hosted execution passes.

Complete monetization/account prerequisites and configure the intended pricing in Apify Console.

For PPE, explicitly record:

- events and prices;
- primary event;
- platform-usage pass-through setting;
- minimum allowed max cost per run;
- representative creator platform cost and margin assumptions.

Know the two synthetic events:

- `apify-default-dataset-item` automatically charges for each item written to the default dataset when enabled;
- `apify-actor-start` is automatically charged when enabled, should not be charged manually, currently defaults to `$0.00005`, covers the first five seconds of compute, and is charged once up to and including 1 GB RAM, then once per additional GB.

Do not infer a universal per-result price from the skill. Product pricing comes from the approved product/release context and measured cost.

Complete billing/payment details early. Identity verification (KYC) is required for payouts and agentic-payment eligibility. If Console blocks monetization/publication while verification is pending, record an external platform/account blocker, keep the Actor private, and resume later without reopening completed software validation.

Only perform a controlled billable PPE run when it is safe, allowed, bounded, and provides useful evidence.

Before Store publication, verify required Publishing sections such as display information, monetization, sample output, output/dataset schema, permissions, and README.

## 8. Production/public release boundary

Return the overall staging result to `staging-validation`.

Only after staging is `Pass` may `promote-release` proceed.

After the explicit human merge to `main`:

1. verify the production commit is the staged candidate;
2. create the immutable version tag and GitHub Release;
3. build/verify the Actor from the tagged state;
4. apply the approved monetization configuration;
5. publish/make the Actor public;
6. run a bounded public smoke test;
7. verify Store page, input UI, dataset/API output, pricing display, run success, and charging behavior;
8. reconcile release-only fixes back to `dev`;
9. complete release cleanup.

Do not use a release-candidate branch as the final public production authority.

## Failure patterns to recognize

- `...editor is required` during build → Apify schema/configuration defect; add editors, regression check, `apify validate-schema`, release-fix/re-promote.
- PowerShell `Cannot parse JSON input` → avoid inline JSON; use `--input-file`.
- `Unrecognized token '﻿'` → UTF-8 BOM; rewrite without BOM.
- required input missing after stdin pipe → prefer a real JSON file.
- Windows `.bat` stops after first Apify command → use `call apify`.
- silent call prints nothing → inspect newest run with `runs ls`.
- lightweight Actor allocated several GB → run controlled memory comparison and pin `defaultMemoryMbytes`.
- `Zipping Actor files` followed by corrupt archive/extraction error → inspect `.actorignore`, transient artefacts, and package size before changing application code.
- KYC pending → external account/platform blocker, not a software defect.

## Completion contract

Report:

- release version and exact release commit;
- staging-promotion state;
- Actor/build identity;
- schema/package preflight result;
- hosted run IDs and result;
- dataset/API contract result;
- log/runtime/cost evidence;
- memory-sizing evidence and confirmed default;
- PPE configuration/readiness;
- billing/KYC state;
- Actor visibility/publication state;
- release-fix Issues/PRs and retest evidence;
- explicit Apify deployment result: `Pass`, `Hold`, or `External blocker`;
- next generic release skill/action.

## Learning checkpoint

Before completion, assess whether Apify execution exposed a reusable Product, Development Operating Model, Skill/Template, Tooling/CI, or Methodology lesson.

Capture cross-project lessons with `capture-learning` and mark them for SideGig review. Do not turn every transient platform error into a learning record.

## Platform references

Current behavior was verified against official Apify documentation on 2026-09-27. Re-check current documentation when CLI/platform behavior materially differs:

- https://docs.apify.com/actors/development/deployment
- https://docs.apify.com/cli/docs/reference
- https://docs.apify.com/actors/development/actor-definition/input-schema/specification/v1
- https://docs.apify.com/actors/monetize/set-up-monetization
- https://docs.apify.com/actors/publishing/monetize
- https://docs.apify.com/actors/publishing/publish
