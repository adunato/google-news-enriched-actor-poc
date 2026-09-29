# Iteration 5 -- local synthetic input-size scaling

**Status:** Executed. Approval covered one bounded, synthetic local iteration only; it did not authorize a hosted run.

## Purpose and hypothesis

Separate worker startup/import overhead from extraction cost and map a reproducible synthetic input-size boundary for the five-second worker deadline. The hypothesis is that startup/import remains below one second and larger inputs cause extraction to cross the deadline sooner than smaller inputs; markup shape may also affect the boundary.

This diagnostic cannot establish live publisher extraction quality, human readability, or the cause of any specific Iteration 4 timeout.

## Planned cohort and procedure

Use the exact Iteration 4 dependency lock and `@extractus/article-extractor@9.0.1` on local Node `v20.19.0`. Generate synthetic English article HTML in memory in two shapes (semantic article/paragraphs and generic nested divs) at 16, 32, 64, 128, 192, and 256 KiB target sizes: 12 serial cases total. Record actual UTF-8 input bytes. Each case runs once in a fresh worker using `extractFromHtml(html, fixture.invalid URL)` and the same five-second wall-clock worker bound used in Iteration 4. Instrument worker start, dynamic import, extraction, output post, parent proxy scoring and total time. Do not retry timed-out cases.

## Bounds and stop conditions

- No publisher URL/data, credentials, cookies or network access; synthetic content only.
- One active worker; 12 cases maximum; five seconds per case; 90-second overall deadline.
- Maximum 256 KiB input and 1 MiB extracted output per case.
- Parent Node process and worker each use a 128 MiB old-space limit. Record process RSS; stop above 256 MiB.
- Stop on lock/package mismatch, attempted network access, raw fixture/output persistence or logging, cap violation, memory breach or overall timeout.
- No production/shared-code edit and no hosted Actor run.

## Retained evidence

Retain only case ID, markup shape, actual input bytes, phase/total timings, status/last phase, output character count and sanitized proxy counts. Do not retain generated markup or extracted article text. Deliver a measured timeout/size recommendation or mark the diagnostic inconclusive.

## Result

Executed once on local Windows Node `v20.19.0`. The exact lock and installed package were verified as `@extractus/article-extractor@9.0.1`; lock SHA-256: `d40e0664285e6ebdd6222ed452dd91c3fc2f77a4fa5f3abef652e9648868b3e2`. All 12 cases completed as test cases (nine extraction completions and three five-second extraction timeouts) in 27,803.8 ms total. There was no global stop condition, no network attempt, and no retry. Peak recorded process RSS was 76,201,984 bytes; final RSS was 76,201,984 bytes. Parent and worker old-space limits were 128 MiB each.

| Synthetic shape | 16 KiB | 32 KiB | 64 KiB | 128 KiB | 192 KiB | 256 KiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Semantic article extraction | 69.8 ms | 154.1 ms | 502.6 ms | 1,758.7 ms | timeout at 5 s | timeout at 5 s |
| Generic nested-div extraction | 55.6 ms | 120.9 ms | 348.6 ms | 1,237.3 ms | 4,266.6 ms | timeout at 5 s |

Phase details: worker start arrived 27.9-54.0 ms after parent case start. Dynamic import took 2,174.1 ms on the first case and 123.2-139.3 ms on the remaining cases. All three timeouts occurred after `extract_started`; the nine completed cases emitted output and passed through parent scoring, which took 3.5-14.0 ms. The exact sanitized per-case metrics, including output sizes and proxy classes, are retained in `results.json`.

**Interpretation:** The hypothesis that import remains below one second across all cases was false for the first cold import. After that first import, extraction time rose with input size in both synthetic shapes. Semantic markup timed out at 192 KiB while generic nested-div markup completed at 192 KiB near the deadline, so this does not establish a universal byte threshold. The generated repetitive text was proxy-rejected in every completed case; that is expected and is not a content-quality result. The evidence supports a synthetic size/performance relationship but cannot establish live publisher readability, explain the 44 Iteration 4 row timeouts, or prescribe a safe live input cap/deadline.

**Result:** Inconclusive for Spike #22's original Technical Question and for live publisher extraction quality. No production dependency or runtime limit change is supported. Another hosted run is not authorized.

**Next checkpoint:** Seek separate owner approval for one local Node 20 complexity-control study: 12 serial cases using semantic-article and nested-div structures, 64/128/192 KiB input sizes, and two synthetic content profiles (unique varied prose at low markup density; equivalent-length repeated prose at high markup density). Use a fresh worker/case, five-second per-case and 90-second overall deadlines, 256 KiB input/1 MiB output caps, 128 MiB parent and worker old-space caps, and stop above 256 MiB RSS or on any network attempt. Retain sanitized phase timing, profile/shape/size, proxy counts and completion phase only. This tests repetition and markup-density effects around the 192 KiB boundary; it still cannot establish live publisher readability or a safe live-page cap. Do not repeat the hosted run without a new explicit approval.

## Learning checkpoint

None. This result is specific to the locked extractor version, Node patch, machine and synthetic inputs.
