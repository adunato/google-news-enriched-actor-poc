# B2 controlled-process 60-second hosted result

Run `j41jHejubNuGJyzAa` used build `m3ulCqbSZjQNzpMLD` (`0.10.9`, tag `issue41-b2-controlled-60s`) on dataset `FQyCxhX8UDjkPZf4h`. It was aborted after a safe row-ID projection showed the terminal dataset violated the frozen 100-row integrity requirement. The immediate post-abort read had 104 items; the validator's post-terminal snapshot had 105 output occurrences. The terminal snapshot contained 88 distinct expected row IDs, 17 IDs occurring twice, 12 missing fixture IDs and zero unknown IDs. Occurrence outcomes were 41 `eligible_html`, 19 `http_denied`, and 45 `child_timeout`; all 105 reported child reaped. Thus, no valid 100-row success-rate denominator exists and the candidate is **Inconclusive / Hold**.

The run lasted 2,477.827 seconds and reported usage of `$0.06978753300047086`, within the approved 3,300-second and `$0.10` bounds. It used 512 MiB, concurrency two, `restartOnError=false`, and the same frozen input SHA-256 `ef5ea88082dcb7403f961828441cb477bd577711b9d8db8e86a146907eb17b01`. The run and dataset were RESTRICTED; token-free no-follow access returned 403. The run-start marker recorded Node `v20.20.2`, Undici `6.24.1`, 100 inputs and concurrency two before child scheduling. Safe API metrics report `restartCount=0`, average RSS `146,328,999.7` bytes and peak RSS `260,575,232` bytes. These values do not identify a cause.

## Output occurrences and duplicate handling

Independent review found 41 nonempty article-text occurrences, of which 40 were readable. They correspond to 33 distinct nonempty row IDs and 32 distinct readable row IDs. Among the 17 duplicated row-ID pairs, 8 pairs repeated the same readable-text hash, 4 mixed a timeout occurrence with an eligible occurrence, and 5 contained no readable article text. Every pair has different safe timing signatures. The projection does not retain child PIDs, so process identity cannot be established from this evidence. The duplicate pairs remain separate output occurrences; neither are they collapsed nor treated as independent fixture rows.

The previous 24-second candidate completed a valid 100-distinct-row sample with 8 `eligible_html`, 1 `http_denied`, 91 `child_timeout`, and 8 independently readable texts. The 60-second terminal snapshot instead has status sets across 88 unique row IDs: 29 eligible-only, 18 denied-only, 37 timeout-only, and 4 with both timeout and eligible occurrences. Twelve fixture IDs have no output. A one-to-one 24-to-60 outcome matrix would hide duplicate mixed results and missing rows, so the comparison is limited to the valid 24-second sample versus these invalid 60-second observations.

## Parent-clock timing

T0 is the parent monotonic timestamp immediately before `fork()`. Parent-received event times include IPC delay and are upper bounds on when the child emitted the event. Statistics below preserve all 105 output occurrences, including duplicate row IDs; they are not statistics over 105 distinct input rows. Percentiles use nearest rank (`ceil(0.95 × n)`); medians use the midpoint of the two central values for even sample sizes. Parent and child clocks are never mixed or subtracted.

| Measurement | Occurrences with value | Minimum (ms) | Median (ms) | P95 (ms) | Maximum (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| T0 to child-ready marker receipt | 105 | 841.537 | 29,244.846 | 37,103.455 | 45,956.733 |
| T0 to HTTP-request marker receipt | 105 | 845.867 | 29,445.879 | 37,399.536 | 46,559.750 |
| Child-ready to HTTP marker receipt, paired parent deltas | 105 | 3.454 | 199.175 | 495.544 | 603.018 |
| T0 to terminal-result receipt, all received results | 62 | 1,253.804 | 38,150.814 | 58,575.153 | 59,780.995 |
| T0 to terminal-result receipt, `eligible_html` only | 41 | 1,686.223 | 48,277.102 | 58,501.115 | 59,301.127 |
| Parent HTTP-marker receipt to result receipt, `eligible_html` only | 41 | 682.351 | 19,200.982 | 29,000.031 | 30,001.361 |
| Parent HTTP-marker receipt to result receipt, `http_denied` only | 19 | 188.621 | 2,100.663 | 3,599.278 | 3,599.278 |
| Parent HTTP-marker receipt to result receipt, all received results | 62 | 188.621 | 3,498.978 | 28,697.955 | 30,001.361 |
| T0 to confirmed reap | 105 | 1,364.104 | 57,176.781 | 60,281.607 | 60,501.720 |
| Kill request to confirmed reap, timeout outcomes | 45 | 8.455 | 155.886 | 296.204 | 349.973 |

All 105 occurrences delivered an HTTP-request marker to the parent: 20 marker receipts were at or before 24 seconds and 85 were later. A late parent receipt does not prove the underlying HTTP request began after 24 seconds; IPC may delay receipt. Thus, 85 is the count potentially exposed to the former outer deadline, not a proven count of HTTP starts that the old deadline would have prevented. There were no occurrences without an HTTP marker in this projection.

Of the 45 timeout occurrences, 43 last reported `extract_start` and 2 last reported `result_received`. The latter two were still written as `child_timeout`; their result status was not retained in the row projection. The parent requested kill at approximately 60 seconds and observed confirmed reap about 90 ms later for those two. Do not describe them as extraction hangs: the parent had received a terminal-result marker before kill, but cannot establish the contained result status from retained data. The two rows remain timeout outcomes under the parent lifecycle rule.

## Child-local successful-work durations

The following metrics use child-local elapsed values or differences between child-monotonic stage markers. They are separate from the parent-clock receipt intervals. For the 41 `eligible_html` occurrences, child fetch-start to terminal had median 19,202.642 ms, P95 29,000.759 ms, maximum 29,793.684 ms; HTTP-request-start to body-read-end had median 2,601.030 ms, P95 4,906.712 ms, maximum 5,697.882 ms; extraction-start to extraction-end had median 16,705.610 ms, P95 23,898.150 ms, maximum 26,093.712 ms. These are successful extraction occurrences, including one unreadable text result. The 45 child-timeout occurrences are censored and excluded from successful-duration distributions. These 41 occurrences are not 41 independent inputs because duplicate IDs are present.

For the 19 `http_denied` occurrences, child fetch-start to terminal had median 2,303.528 ms, P95/maximum 3,696.509 ms; no body-read-end or extraction interval was recorded for these denials. Across observed child stages, body-read start-to-end was n=86, median 901.020 ms, P95 2,198.135 ms, maximum 2,603.577 ms. HTTP-request-start-to-result-received was n=62, median 3,499.067 ms, P95 28,697.518 ms, maximum 29,901.696 ms; this combined stage measure includes denials as well as successful extraction. Timeout rows are censored, not zero-duration observations, and are excluded from successful child-duration groups.

## What this does and does not show

The source candidate changes only the parent outer deadline from 24 to 60 seconds. The existing 10-second HTTP chain, R2 request/extraction source, and diagnostics are unchanged. The improved marker coverage versus the 24-second run is consistent with a longer parent deadline allowing more child-stage events to be received, but this 60-second run has invalid output integrity and duplicate/missing row IDs. It cannot establish an acceptance-rate change or a causal explanation for the failures. No cause is inferred from utilization, timing, repeated row IDs or the zero restart count.

The sanitized occurrence projection and independent validation are `validated-row-projection.json` and `validation-controlled.json`. The private dataset remains RESTRICTED and retained; no article text is included in this repository evidence.
