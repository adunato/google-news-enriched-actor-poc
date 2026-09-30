# Issue #18 hosted replay handoff

## Final decision

The tested marker/RPC plus bounded publisher HTTP path is **Not feasible** for Issue #4's 95/100 strict success gate on this fixed sample. The exact pinned final run scored 76/100; the matching local replay scored 75/100. This does not prove that every future HTTP-only resolver is impossible. Issue #4 remains blocked pending product/design disposition; this discovery did not implement production code.

## Frozen input and reproducibility

- Manifest: [`input-manifest.json`](input-manifest.json), SHA-256 `d1ed2bea31efc54358ac24d991a9037ec0f0840ccd50547c01bd794c64389f3c`; row-array SHA-256 `fdbab474e5764350c547080c0002f042b062e03f157a270d5b9474d846ad2f2a`.
- Final probe: [`probe.mjs`](probe.mjs), SHA-256 `16da65c4ba05259b4e9614325576e8f8ad33c1ab38b686cf97369de6921d1b22`; pinned transport module SHA-256 `9fc0357e9f97e0325951fe40388dd238d05ed5ffff0e9da445b6699d0c3723a3`; title module SHA-256 `f609bef966f264ea64e1650158776bbee4c7b157777e7214db74ab6678053de9`.
- Final local evidence: [`local-results.json`](local-results.json), SHA-256 `f24402ddcc1b5b0990a9acc19bed36f95b49dc77abee6dbf5b9699c349b9972f`.
- Current artifact hashes are in `hosted-run-metadata.json.hashes`; the original hashes recorded for hosted execution are preserved in `hosted-run-metadata.json.preFormatHashes`. Prettier normalization retained the frozen row-array SHA-256.
- Hosted row evidence: [`hosted-results.json`](hosted-results.json); exact dataset export: [`hosted-dataset-items-pinned-final.json`](hosted-dataset-items-pinned-final.json); run log: [`hosted-run-log-pinned-final.txt`](hosted-run-log-pinned-final.txt).
- From this directory, `npm ci`, `npm test`, and `node probe.mjs` reproduce the safety checks and local probe. Do not pass `--refresh`; it changes the frozen sample. Seven focused safety tests passed, including special IPv4/IPv6 rejection, pinned DNS lookup, redirect checks, malformed entity fail-soft handling and title adjudication.

## Final hosted run

- Private disposable Actor `issue18-publisher-identity-node20-8d8299d8`, ID `ffjdMHqwE6aTsLhnb` (created only for this task).
- Build `0.4.1`, ID `bhBBv5ohtKDQamR4D`; tag `issue18-final-v4`; status SUCCEEDED. Base image `apify/actor-node:20`, digest `sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`.
- Run `oiLOkd2rSc4WAYTAg`, status SUCCEEDED; dataset `urfl3jsv2WB81GnUo`; key-value store `msi9KdzxsMlf7Mtn2`; request queue `ANcfxlHwSUAsX3q30`.
- UTC window `2026-09-28T15:57:19.831Z`–`2026-09-28T15:57:51.272Z`; probe window `15:57:21.883Z`–`15:57:37.465Z`.
- Node `v20.20.2`, Linux x64; configured 256 MiB and 900 seconds; peak memory 72,314,880 bytes; compute units 0.00217514; usage $0.0010753898.
- The Actor validated both frozen hashes and row IDs exactly once, then wrote one summary plus 100 per-row records. The evidence retains no Google News or publisher URLs, response bodies, cookies, tokens or secrets.

| Measure                     | Local Node 24.15.0 | Hosted Node 20.20.2 |
| --------------------------- | -----------------: | ------------------: |
| Candidates                  |            100/100 |             100/100 |
| HTTP 200 HTML               |                 80 |                  81 |
| 403 / 401 / 451             |         15 / 4 / 1 |          15 / 4 / 0 |
| Article-like                |                 77 |                  78 |
| Confirmed title matches     |                 78 |                  79 |
| Confirmed mismatches        |                  0 |                   0 |
| Unverifiable identity       |                 22 |                  21 |
| Strict successes            |         **75/100** |          **76/100** |
| Retries in final pinned run |                  0 |                   0 |

The local and hosted strict result differs on exactly three rows: `q1-us-06` (hosted gain: local 451, hosted 200 and strict), `q2-gb-04` (hosted loss: local 200 and strict, hosted 403), and `q4-us-08` (hosted gain: local 403, hosted 200 and strict). Two hosted gains and one loss produce the net +1. This is live access/response variation; the classifier agreed.

## Superseded attempts and retry evidence

- `qucBPtccC6YhknGKN` / build `ff7MAA5j9eFlIBuxW`: superseded after title/entity adjudication defects were found.
- `Elw4umZiOM0dddUDb` / build `OuuO1CT6bmKziAWDH`: superseded because DNS preflight did not pin validated addresses to sockets. This run had one eligible 503 retry on `q5-gb-08`; both requests returned 503, access and identity were unchanged, and strict success did not change. It added one GET; total run usage was $0.0010548036, with marginal request cost not separately reported. See [`hosted-results-pre-pinned-superseded.json`](hosted-results-pre-pinned-superseded.json).
- `fb01FIaxyn5eRlafA` / build `jslSiwDfVTu4jQYbM`: failed before publisher requests because the wrapper dependency was missing.
- Final run `oiLOkd2rSc4WAYTAg` used pinned public DNS answers and manual redirect target validation; there were no retry-eligible errors and no retries.

## Cleanup

After retaining evidence locally, all four task-created runs, all four builds, and the disposable Actor were deleted. The exact Actor and build lookups returned not found after deletion; the run-associated datasets, key-value stores and request queues were removed with their runs/Actor. Cleanup status and IDs are recorded in [`hosted-run-metadata.json`](hosted-run-metadata.json). No other Apify resource was touched.
