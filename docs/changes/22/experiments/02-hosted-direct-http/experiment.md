# Iteration 2 — hosted direct-HTTP baseline

## Purpose

Compare the bounded direct-HTTP path with Iteration 1 from the target Apify Node 20 environment, using one fresh 100-row cohort across the same ten query/edition cells. This is a technical access experiment; it does not measure readable full-text extraction or establish permission to access any publisher.

## Execution design

- The Actor fetches fresh RSS feeds in-run for five queries and GB/US editions, taking ten items from every cell. No article URL or title is supplied in the run input.
- The probe uses the Iteration 1 direct Google marker/RPC destination-resolution procedure and public publisher HTTP flow. This Google endpoint is undocumented and is used only as an investigation input.
- Publisher requests retain the existing bounds: concurrency 4, 10-second timeout, five redirects, 256 KiB publisher prefix, 250 ms per-host request spacing, public DNS validation/pinning, and conservative robots skip rules.
- Each row is isolated. A fresh cohort other than exactly 100 rows fails the run. No automatic run retry is configured.
- Only sanitized row classifications are written to the default dataset. Retained fields include row/cell identifiers, query/locale, publisher labels/hostnames, statuses, bounded metrics, and hashes. URLs, title values, page bodies, cookies, and raw error messages are excluded.
- The Actor uses Node 20, 256 MiB memory, a 900-second timeout, and the Apify API's server-enforced `$1` `maxTotalChargeUsd` limit. It is private and disposable.

## Local preparation checks

- `npm install --package-lock-only --ignore-scripts`: passed; zero reported vulnerabilities.
- `npm ci --ignore-scripts`: passed; zero reported vulnerabilities.
- `node --check` on `probe.mjs`, `probe-network.mjs`, and `probe-title.mjs`: passed.
- `apify validate-schema`: passed for the empty-input schema.
- No local 100-row sample was run; the only fresh cohort is acquired inside the single hosted run.

## Hosted execution evidence

- Actor `557mC3yknShbfdUFj` was private with `LIMITED_PERMISSIONS`; it was deleted after evidence collection. Build `VmbZa987nkwekkELF` (`0.2.1`) succeeded.
- Exactly one run was started: `rs8Ld1Hbq48WKaPHi`. It succeeded with exit code 0 on Node `v20.20.2`, using 256 MiB, a 900-second timeout, restart disabled, and a server-enforced `$1` maximum total charge confirmed in run metadata.
- Run window: `2026-09-29T16:31:21.109Z` to `2026-09-29T16:33:32.651Z`; duration `131.389` seconds. Platform usage: `$0.0025387885869575873`, `0.0091242361` compute units. Average/peak memory: `72,294,011` / `117,448,704` bytes. Average/peak CPU usage: `4.889` / `103.668`. Network receive/send: `34,023,567` / `893,821` bytes.
- Normal dataset retrieval from `i0SFWOp2bDxXlTSiG` returned 100 items, ten in each of ten cells, across 73 publisher hosts. SHA-256 of the retrieved sanitized JSON: `b52c3db653ab34d0fcf64ff33bf22b494deb616b78b708551d423139c10ca0eb`.
- Candidate resolution: 100/100. Access: HTTP 200 HTML 72/100, HTTP 403 13/100, robots unavailable/skipped 10/100, robots disallowed/skipped 5/100. Five robots files were not found and their publisher requests proceeded. Robots totals: 80 allowed, 10 unavailable, five disallowed, five not found. Article-like marker: 69/100; headline identity match: 70/100; combined strict marker-and-identity signal: 68/100; generic challenge/denial heuristic: 29/100.
- Dataset inspection found no URL/title/body fields or URL values. The retrieved run log contained no URL values; only summarized signals are retained. The run input was `{}` and hosted code did not persist the URL-bearing RSS manifest. The run and sanitized dataset remain available; no raw logs, URLs, titles, cookies, or page bodies were committed.
- Result: Inconclusive for the original Technical Question and controlled local-versus-hosted comparison. Direct HTTP returned HTML for a subset of this hosted sample. Readable full-text extraction and permission remain untested.

See the Iteration 2 evidence table and next owner checkpoint in [`technical-spike.md`](../../technical-spike.md). No second run was started.

## Validation

**Iteration 2 validation: Pass.** The live target runtime was exercised; the exact build and accepted run options were verified; the run completed once with 100/100 rows and ten rows in every planned cell; normal dataset retrieval returned all 100 items; the enforced cost cap and actual platform usage were recorded; and the sanitized dataset/log checks found no raw publisher URLs, title/body fields, or URL values. The private disposable Actor was removed after evidence collection. Local syntax, dependency, and Apify input-schema checks also passed.

**Issue #22 completion validation: Hold / Inconclusive.** Iteration 2 does not resolve the original broader question. Readable full-text extraction, session/state, browser requirements, proxy/managed access, terms/policy/legal boundaries, and reusable final guidance remain open. No production behaviour or Product/Architecture definition changed. `Learnings: None`.

## Next owner decision

Issue #5 does not currently approve a specific readable-text extraction library, algorithm, or dependency. Iteration 2 remains inconclusive for readable text.

- **Option A (recommended):** authorize bounded candidate-method selection/evaluation within Issue #22's direct-HTTP investigation. Any new dependency must be explicitly approved before a hosted run uses it.
- **Option B:** if the owner judges #22's access investigation sufficient, route readability-method selection to Issue #5 design and stop further access investigation. Current evidence does not meet #22's broader completion criteria, so this option alone does not support closing #22 or claiming a Feasible/Not feasible conclusion. Keep the Spike open unless its criteria are met or the original required outcome is explicitly changed/stopped.

No new run is authorized by this checkpoint alone.
