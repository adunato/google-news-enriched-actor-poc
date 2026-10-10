# B2 controlled-process hosted result

Run `8Y49Z8FgdH8XS3C5b` used build `avU2E2IHAe5wlAWS1` and the frozen 100-row input (`ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`). The run succeeded in 1,130.443 seconds and cost $0.03182645542874768 under its 1,500-second and $0.10 limits. It emitted 8 `eligible_html`, 1 `http_denied`, and 91 `child_timeout` rows. Every row ID matched the frozen input, every child was reaped, and all 8 reported text hashes matched the independently retrieved dataset texts. Independent content review classified all eight extracted texts as readable; the other 92 rows had empty article text. The result is 8/100, below the 50/100 target, so this tested candidate is rejected under its stated limits.

## Timing observations

T0 is the parent monotonic timestamp taken immediately before forking a child. Parent-received event times include IPC delivery and are upper bounds for the child event. Parent and child monotonic clocks are summarized separately; they are never subtracted across processes. Summary percentiles use nearest rank (`ceil(0.95 × n)`) and are computed only over rows with an observed value. `T0 to first HTTP request` is the parent receipt time for the worker's request-start marker, not a packet-level measurement.

| Measurement | Rows with value | Minimum (ms) | Median (ms) | P95 (ms) | Maximum (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| T0 to child ready, parent receipt | 11 | 749.181 | 804.117 | 15,978.450 | 15,978.450 |
| T0 to first HTTP request, parent receipt | 11 | 752.505 | 808.518 | 16,368.831 | 16,368.831 |
| Child ready to HTTP-request marker receipt, paired parent deltas | 11 | 3.323 | 4.144 | 390.381 | 390.381 |
| Child `fetch_start` to `http_request_start`, child clock | 11 | 1.411 | 1.662 | 297.353 | 297.353 |
| Child body-read duration, child clock | 10 | 12.725 | 19.290 | 903.776 | 903.776 |
| Child extraction duration, child clock | 8 | 352.564 | 702.637 | 2,824.889 | 2,824.889 |
| T0 to child reap, parent clock | 100 | 1,213.176 | 24,101.042 | 24,224.442 | 24,275.810 |
| Timeout kill request to confirmed reap, parent clock | 91 | 4.968 | 100.167 | 200.274 | 268.394 |

Only 11 of 100 rows delivered a ready and HTTP-start marker to the parent: the 9 completed HTTP outcomes plus 2 timeouts. Of the 91 timeouts, 89 had no child-stage marker received before termination and 2 last reported `extract_start`. This shows where the parent last observed progress; no marker does not prove that the child had not begun an unreported operation. The run does not identify the cause of the missing markers or establish that HTTP itself stalled.

The candidate retains the R2 HTTP method and extraction implementation. Local direct-versus-child loopback controls passed 11/11, including matching request traces. The run-start marker recorded Node `v20.20.2` / Undici `6.24.1` before child work began. This does not make the hosted timeout cause known. Request counts are available for 9 completed rows (9 GETs observed); timeout children may have made unreported requests. The configured maximum is six GETs per row, giving a run upper bound of 600.

The validator's sanitized 100-row projection is `validated-row-projection.json`; its scope, hash, access, runtime, limit, and outcome checks are in `validation-controlled.json`. Both omit article text and include only concise readability rationales. The private default dataset remains restricted and retained.
