# Issue #14 Apify hosted probe evidence handoff

## Probe identity and reproducibility

- GitHub Issue: [#14](https://github.com/adunato/google-news-enriched-actor-poc/issues/14)
- Account: `adunato`, user ID `O56PJDpqDQa4WIM3x`
- Disposable Actor: `issue14-node20-rpc-probe-20260928-a9f3c2`, ID `qGVphQDt7CqcseeEO` (private; deleted after evidence capture)
- Hosted image: `apify/actor-node:20`, resolved digest `sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`
- Hosted runtime: Linux, Node.js `v20.20.2`; Apify API did not expose the container region. The build registry was in `us-east-1`; this is not treated as runtime-region evidence.
- Exact input manifest: the fixed 100-row `probe-results.json` copied before the hosted RPC run; SHA-256 `C1A9E6E6957187D76032923A406DCEA0166AB0DF904F6C3EB148FD9857FACAA1`.
- Hosted RPC probe script SHA-256: `2D3BFA6B0A0295E66A8B0A2F71AB014B601CAE43C72BCD3C7758AFB0F12D022F`.
- Hosted wrapper SHA-256: `B4BFFAB3AD1401D256458323AD431558B1474169E9D562A06A2DE40B3AA4D72F`.
- Limits: 100 fixed rows; RPC concurrency 4, shared 10-second row timeout, five redirects, 2 MiB Google responses. Publisher GET concurrency 4, 10-second row timeout, five redirects, 256 KiB HTML prefix.

## Final evidence run

- Build: `0.0.4`, ID `6GaplhGGGMCwe5zXp`, status `SUCCEEDED`.
- Run: `SaG4cPaZ0Z3RZT2tO`, status `SUCCEEDED`, exit code 0.
- UTC execution: `2026-09-28T13:17:31.261Z`–`13:17:46.671Z`; RPC window `13:17:33.883Z`–`13:17:38.113Z`; publisher GET window `13:17:38.122Z`–`13:17:45.261Z`.
- Default dataset: `HuoFDXS4fKeDnf6w9`; fetched through `apify datasets get-items ... --format json` and saved as [`hosted-probe-results.json`](hosted-probe-results.json).
- Default KVS: `24oRn1HN3Bm2WxNDf`; default request queue: `Yak8Zj45ZfRWnUx9s`.
- RPC outcomes: 100/100 `success_rpc`; 10/10 in each of the five query × two edition cells. All 100 publisher hosts passed the expanded Google-owned host exclusion.
- Publisher GET outcomes: 77 HTTP 200 pages with an article-like marker, 20 errors (13 HTTP 403, 5 HTTP 401, 2 HTTP 405), and 3 HTTP 200 HTML pages without the marker. This heuristic does not establish exact story identity. Strict target of at least 95 accessible/article-like destinations was not met.
- Run metrics: 15.325 s; 256 MiB configured; peak memory 89,939,968 bytes; 0.0010642361 compute units; reported run usage `$0.0003268311`.

## Temporary cloud resources created

Four builds and four runs were created while correcting evidence persistence and capturing accurate publisher-check timestamps. Only run 4 is final discovery evidence. All listed resources were created by this task and were deleted after evidence retention:

| Build ID / version            | Run ID              | Dataset ID          | Key-value store ID  | Request queue ID    |
| ----------------------------- | ------------------- | ------------------- | ------------------- | ------------------- |
| `sbILEKueOEui7NCKL` / `0.0.1` | `tKmp8zg2SKWqExW35` | `OqMBYZ9E56IU1SfzA` | `cVfOVajuctj3pDoWx` | `hLDaDLCQRpWa8Vzvg` |
| `mFAkgOz1eaZJBN1dv` / `0.0.2` | `98ZBQvPGE0CAhvarb` | `Qt4pve2E2A5qsa6vC` | `myvyY81XBCrn1UQAX` | `5PeBHAfysxbcNhXTf` |
| `edwHkHPtFHnU0bA0w` / `0.0.3` | `2KJiE4jAQUhTwWpJS` | `uPLiRkjTciaSRc08p` | `MBUYHFbh8nQoT5VRg` | `ccHwnmZwOsM9Yssp9` |
| `6GaplhGGGMCwe5zXp` / `0.0.4` | `SaG4cPaZ0Z3RZT2tO` | `HuoFDXS4fKeDnf6w9` | `24oRn1HN3Bm2WxNDf` | `Yak8Zj45ZfRWnUx9s` |

## Retained reproducibility inputs and hashes

| File                               | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `hosted-probe-input-manifest.json` | `C1A9E6E6957187D76032923A406DCEA0166AB0DF904F6C3EB148FD9857FACAA1` |
| `hosted-probe-rpc.mjs`             | `2D3BFA6B0A0295E66A8B0A2F71AB014B601CAE43C72BCD3C7758AFB0F12D022F` |
| `hosted-probe-main.mjs`            | `B4BFFAB3AD1401D256458323AD431558B1474169E9D562A06A2DE40B3AA4D72F` |
| `hosted-probe.Dockerfile`          | `9536DD6A2DBBFCD790FC157C7B7F05C1D299E6D12367AC8E2B547810C329F1F7` |
| `hosted-probe-package.json`        | `0910250F5CF84B685860DF2B21F567A1020900852645027BD88A7921D89039DD` |
| `hosted-probe-package-lock.json`   | `6680B0C3DE5133F7CB54462C4A826FDD20C1B136BFFCC474767DDE139C5DCA9C` |
| `hosted-probe-actor.json`          | `ECC22295C080C63E803E68FF4FE95216B0EB3C1C77730D374FC72EE3334A4D02` |

To reproduce, place the retained Actor definition at `.actor/actor.json`, the retained Dockerfile/package files and hosted scripts in one temporary Actor directory, set the Actor name to a new unique value, then run the same bounded `apify actors push` and exact build `apify actors call` commands described above. Do not include `hosted-probe-results.json` in the build context.

Cleanup result: all four runs were deleted; their datasets and key-value stores were already absent immediately after run deletion; the account request-queue listing returned 0 items; the temporary Actor was absent from the account Actor listing (2 unrelated Actors remained); all four builds were deleted before the Actor was deleted.
