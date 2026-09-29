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

Pending. Record the exact private Actor ID, build ID/number, one run ID, Node version, run status/exit code, duration, timeout/memory and charge cap, rows/cells, candidate/access/robots counts, dataset/API verification, usage cost/memory, sanitized evidence hash, and cleanup outcome here. Do not paste raw URLs, titles, bodies, or logs.
