# Issue #4 one-row hosted parameter-path feasibility replay

Date: 2026-09-30. Outcome: **feasibility gate failed; stop before resolver implementation**.

The frozen known-positive row `q1-gb-01` was replayed on private disposable Apify Actor `EmIxhAdiYdveVQM99`, build `0.0.3` (`CNDaR3hTM8PhNKug4`), run `TLDRFGMcPEnbO9kXF`. The exact build succeeded and the hosted run finished `SUCCEEDED` on Linux Node.js `v20.20.2` (Apify Node 20 image digest `sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63`). Run window: `2026-09-30T06:56:50.614Z`–`2026-09-30T06:56:53.379Z`.

| Variant                                                                | Page response                                                          | Article-ID marker             | RPC                                                       | Candidate |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------- | --------- |
| Original RSS URL                                                       | HTTP 200 after one allowed `news.google.com` redirect; 580,461 bytes   | No matching marker            | Not attempted                                             | No        |
| Explicit article-ID parameter page (`hl=en-GB`, `gl=GB`, `ceid=GB:en`) | HTTP 200 after one allowed `news.google.com` redirect; 1,130,388 bytes | Matched the source article ID | HTTP 200, 101-byte body; no parseable `garturlres` result | No        |

The RPC endpoint, Fbv4je/garturlreq envelope, framing parser, marker regex, headers, manual redirect handling, and 2 MiB cap follow the retained #14 hosted probe. The probe uses an Issue #4 user-agent and supplies the row locale (`GB:en`) in the RPC context; the retained #14 code hardcodes `US:en`. No cookies were sent. The 101-byte HTTP 200 response was parsed in memory and discarded; neither body nor content-type was retained, so the response shape/error cannot be classified without a new request. The direct path reached the expected marker, but the corresponding RPC did not produce a parseable candidate. The gate therefore fails. No publisher URL was fetched. Redirect handling followed only `news.google.com` destinations and stopped at consent or any other host; no consent destination was followed. Limits were 10 seconds shared across the row, 2 MiB per response, and at most five redirects.

Run resource evidence: 256 MiB configured, 37,478,400-byte peak memory, 2.641 seconds reported run time, 0.0001834028 compute units, `$0.0000990544` run usage. Apify reported `$0.0028473` total across three builds (two schema-validation failures, one successful build) and the run. No proxy or residential usage was reported.

The run dataset was fetched through the Apify dataset command before cleanup. It retained only the row ID, a truncated source-URL hash, status/host classes, byte counts, timing, marker-match boolean, RPC status and candidate-valid boolean. It retained no raw URL, article ID, title, response body, cookie, or token.

Temporary Actor, run, dataset and local package were deleted and verified absent. Apify confirmed the build deletion requests, but its build-info endpoint continued to serve historical metadata after deletion; build absence could not be independently verified. No production source or test files were changed. Per the approved implementation plan, stop this live path and reassess Issue #4; this replay does not authorize an alternate resolver or consent handling.

## Follow-up: controlled RPC locale comparison

Date: 2026-09-30. This follow-up supersedes the earlier one-row feasibility outcome for the explicit parameter path; it does not establish the 100-row acceptance threshold.

The same frozen row `q1-gb-01` was replayed in a fresh private Actor, build `0.0.1` (`w5RfdX2DLJFvRrxYE`), run `nQIGAhEwijVRT159B`. Runtime was Linux Node.js `v20.20.2`; run window `2026-09-30T07:05:28.773Z`–`2026-09-30T07:05:32.776Z` UTC. The bounded explicit page request returned HTTP 200 (`text/html`, 1,130,457 bytes) after one allowed `news.google.com` redirect and matched the source article ID.

| RPC context                   | Status | Content type       | Bytes | Response shape | Parsed result | Candidate                |
| ----------------------------- | ------ | ------------------ | ----: | -------------- | ------------- | ------------------------ |
| `US:en` (retained H5 context) | 200    | `application/json` |   172 | anti-XSSI JSON | Yes           | Valid non-Google HTTP(S) |
| `GB:en` (row locale)          | 200    | `application/json` |   172 | anti-XSSI JSON | Yes           | Valid non-Google HTTP(S) |

The two RPC attempts used the same marker and differed only in the locale value; endpoint, envelope, headers, user-agent, parser, and redirect policy matched the retained #14 hosted probe. No cookies were sent. Both variants passed the one-row marker/RPC candidate gate in this run, so locale did not change the pass/fail outcome here. The prior 101-byte `GB:en` response was not reproduced; because the prior run used a different user-agent, this comparison does not establish the cause of that earlier response. Response bodies and candidate URLs were discarded; no publisher page was requested. Consent/off-Google redirects were not followed. The 10-second shared timeout, 2 MiB response cap, and five-redirect maximum applied.

Run usage: `$0.0001117549`, 0.000256875 compute units, 3.699 seconds, 27,267,072-byte peak memory at 256 MiB configured. Build usage was `$0.0027267`; total reported for this diagnostic was `$0.0028384`. No proxy or residential usage was reported. The dataset was fetched before cleanup and contained only row/source hashes and the redacted fields above.

The temporary run, dataset, Actor, and local package were deleted and verified absent. The build deletion command reported success, but its info endpoint continued to return historical metadata, so build absence could not be independently verified. This diagnostic supports feasibility for this single known-positive row only; the required 95/100 sample remains untested.
