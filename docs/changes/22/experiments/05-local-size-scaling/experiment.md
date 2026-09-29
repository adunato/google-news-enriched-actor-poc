# Iteration 5 -- local synthetic input-size scaling

**Status:** Proposed; awaiting explicit owner approval. This is a plan only. No cases have been run and no scaling results are recorded.

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

Not run. Awaiting explicit approval for Iteration 5.

## Learning checkpoint

Pending execution.