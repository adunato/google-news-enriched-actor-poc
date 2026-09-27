# Learning Record

**Learning ID:** google-news-enriched-actor-poc--bootstrap--canonical-lld-template-formatting

**Origin repository:** adunato/google-news-enriched-actor-poc

**Source:** Repository bootstrap, commits `bcba5a02565ba404197045098ecf4548c1f220d8` through `2704cc41f53dbc97ffcd2453f9359a8b2334337d`

**Lifecycle stage / skill:** Repository establishment / `bootstrap-project`

**Date:** 2026-09-27

**Category:** Skill/Template

**SideGig review:** Yes

**Disposition:** Captured

## Change context

The repository was established from the current SideGig v2.7.0 canonical bootstrap package. Bootstrap requires the target repository formatter check to include generated and installed lifecycle artifacts before the repository can be reported ready.

## Observation

The canonical `low-level-design.md` template installed from SideGig v2.7.0 was not accepted by the same Prettier configuration used by the SideGig bootstrap package. A fresh product bootstrap therefore required a local formatting change to an installed canonical artifact before target validation could pass.

## Evidence

GitHub Actions Validate runs `36323954092` and `36324026067` both failed at `npm run format:check`. Alongside generated project documents, Prettier specifically reported `.codex/templates/low-level-design.md`. Running the repository's pinned Prettier configuration changed that installed template by one line replacement and removed the formatter failure for that artifact.

## Impact

A new repository can fail its mandatory bootstrap validation even when it installs the canonical package unchanged. This creates unnecessary bootstrap rework and means the package source and its target-repository formatting contract are not fully self-consistent.

## Local action

The installed `.codex/templates/low-level-design.md` copy was formatted locally as part of repository establishment. No SideGig source was changed from this product repository.

## Cross-project relevance

Review the canonical SideGig `implementation/templates/low-level-design.md` source and bootstrap-package verification so the distributed template is already compliant with the formatter configuration required of product repositories. If corrected centrally, increment the canonical package as appropriate so future bootstraps receive the corrected artifact.

## Stable local references

- `.codex/templates/low-level-design.md`
- `.prettierrc.json`
- `.github/workflows/ci.yml`
- Validate runs `36323954092` and `36324026067`
