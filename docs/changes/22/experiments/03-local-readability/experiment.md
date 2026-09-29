# Iteration 3: local readability-method evaluation

**Issue:** #22
**Hypothesis:** `@extractus/article-extractor@9.0.1` can produce readable text from already-fetched HTML across common page layouts without making its own network requests, and improves on a minimal semantic-container baseline.
**Authorization:** Owner approved local candidate evaluation. No production dependency or hosted run is approved.

## Protocol

Inspect the published npm artifact, metadata, README API and implementation. Install only inside this directory with lifecycle scripts disabled. Call only `extractFromHtml(html, url)`. Confirm its implementation parses the supplied HTML and does not call its `retrieve`/fetch path. Evaluate six synthetic authored fixtures: four article-positive cases (semantic article, generic div containers, navigation-heavy article, and malformed/truncated article) and two negative cases (short/metadata page and consent/block page). No live publisher page, URL, network request or credential is used by the evaluation.

Input HTML is limited to 256 KiB per fixture. Process fixtures serially, with a 5-second per-fixture worker timeout and 60-second total deadline. Catch failures per fixture. A readable result requires at least 100 words, expected-body token recall of at least 0.55, and expected-body token precision of at least 0.80; negative fixtures are false positives if they meet that threshold. Report token metrics, word counts and classifications only, not extracted output text. The baseline emits text only from `article` or `main`; it is unavailable for other layouts and is never credited for a marker alone.

## Decision rules

- Recommend the candidate for a separate hosted evaluation only if it returns readable text on all four article-positive fixtures, returns no readable text on either negative fixture, has no systemic contamination or layout failure, and materially improves fixture coverage over the semantic baseline.
- Recommend against it if it fetches independently, fails package identity/integrity checks, executes unexpected install scripts, or exhibits systematic fixture failure/contamination.
- Otherwise classify this screen as inconclusive and recommend the highest-value follow-up.
- Even a pass is local method-selection evidence only. A fresh representative 100-row hosted evaluation is still required to assess Issue #5's 50% acceptance criterion, and explicit owner approval of the dependency and hosted run is required first.

## Reproduction

From this directory, run `npm ci --ignore-scripts --no-audit --no-fund` and then `node run-evaluation.mjs`. It reports sanitized results in `results.json`. Network access is needed only for restoring the exact locked package artifact and its dependencies. The evaluation itself uses local fixtures only.

## Result

**Package facts:** `@extractus/article-extractor@9.0.1`, MIT; npm integrity `sha512-tI6tVthdtv3diHKg7SwiHrhwmP4AERKSa/0Cv/MT8cP7vFFMk74M1IgegZLf6pWtq4tdCxPdiDQ/77DVa0yTpQ==`; no install scripts or declared Node engine range. Runtime dependencies: `@mozilla/readability@0.6.0` (Apache-2.0, Node >=14) and `linkedom@0.18.13` (ISC, Node >=16). `npm ci --ignore-scripts` restored 22 packages total. Static source inspection showed `extractFromHtml` passes supplied HTML to the parser; only the separate `extract()` URL path calls the fetcher through `retrieve()`.

**Observation:** On local Node `v24.15.0`, all four positive fixtures met the readability threshold: 113–124 words, token recall 1.00, and precision 0.99–1.00. Neither short metadata nor consent/block fixture met the threshold (0/2 false positives). The semantic baseline passed two positive fixtures; it could not emit text for generic-div or malformed layouts. Candidate output was not retained, only word counts and token metrics in `results.json`.

**Conclusion:** `Supported` for this narrow authored-fixture screen. Recommend this candidate for one separately approved hosted Node 20 evaluation. The local result does not establish publisher-level reliability, Node 20 compatibility, cost, or Issue #5's 50% success rate. Production adoption is not approved.
