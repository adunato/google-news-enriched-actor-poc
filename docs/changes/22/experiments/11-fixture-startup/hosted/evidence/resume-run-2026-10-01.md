# H14 resumed hosted fixture run

One run was started on 2026-10-01 using the reviewed resume launcher at
commit `45c20a99a75c5bb95c46f85d84a836afee6ede69`. The launcher confirmed the
existing private Actor `6cJ0cY4Xe7d5xyjL3`, build `6lNNucwesR5s5YL5y`
(`1.0.1`), 18-file source digest
`b90e0a9d7678953670c1ca397bfc33cf5d2265543e6f7af387562c7b6712dca9`, exact
tag object, and no prior run for this build before its single run POST. No
Actor create or build request was issued.

## Run result

- Run: `Gs1W120Uqdic08LtY`
- Terminal status: `FAILED`, exit code `1`
- Started: `2026-10-01T17:21:51.657Z`; finished: `2026-10-01T17:21:53.582Z`
- Runtime: about 1.925 seconds
- Run options read back: 256 MiB, 180 seconds, $0.10 maximum charge, restart
  disabled, LIMITED permissions
- Average and peak memory: 7,909,376 bytes each
- Compute units: `0.000118125`
- Total platform usage: `$0.000073707328915596` (compute
  `$0.000023625`; key-value-store writes `$0.00005`; other reported categories
  totaled approximately `$0.0000000823` for external transfer)

The default dataset `xyhNONV7Q3jwu7L6P` was read back and contained zero items;
there is no aggregate output. The sanitized platform-log check found the fixed
guard error code `h14_api_origin_rejected`. No structured H14 result object or
application stage list was present in the fetched logs. This places the
observed failure in preload API-origin validation before an application result
was emitted. The runtime's API-base value was not collected. The evidence does
not show that the Readability worker ran, so it gives no hosted Readability
viability result.

## Decision

Classify this candidate as `Hold` for the hosted startup question. Do not retry
this unchanged source. A new, reviewed source change must reconcile the exact
hosted `APIFY_API_BASE_URL` shape with the fail-closed origin check and tuple
manifest, then repeat local and source verification before any new hosted run.
No raw platform logs, credentials, API bodies, or article text were retained.
