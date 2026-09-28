# AGENTS.md

This repository follows the SideGig Development Operating Model.

## Authoritative context

For every software change, read:

1. the originating GitHub Issue;
2. `docs/product.md`;
3. `docs/architecture.md`;
4. any change-specific artifacts under `docs/changes/<issue-number>/`;
5. the relevant source code and tests.

The GitHub Issue remains the root traceability object. Do not expand its scope silently.

## Agent package

Reusable SideGig skills are installed under `.codex/skills/`, canonical project-local templates under `.codex/templates/`, and bootstrap/repository utilities under `.codex/tools/`.

Use the relevant installed skill instead of recreating lifecycle behaviour ad hoc. The installed package includes the Apify Actor deployment skill and the full SideGig development/release lifecycle, including prerequisite Technical Discovery for materially unknown external/runtime boundaries.

## Development lifecycle

Before implementation, ensure the Feature/Bug Issue is development-ready. Use `refine-issue` where requirements need shaping and `assess-change` to decide first whether prerequisite Technical Discovery is required and then the minimum proportional design/planning path.

When `assess-change` requires Technical Discovery, create/link a separate Technical Discovery Issue, execute it with `technical-discovery`, integrate its evidence, and rerun `assess-change` on the blocked Feature/Bug Issue. Do not begin or continue HLD, implementation planning, or production implementation that depends on the unresolved technical boundary.

Create change-specific artifacts only when required under `docs/changes/<issue-number>/`:
- `technical-discovery.md` for a Technical Discovery Issue;
- `hld.md` for a material change-design decision;
- `implementation-plan.md` for meaningful repository-level implementation planning;
- `low-level-design.md` only when an approved implementation plan requires file-level design.

Use the canonical copies in `.codex/templates/`. Update the durable Product or Architecture definitions in the same change when the implemented outcome materially changes them.

## Learning capture

Every lifecycle skill performs a lightweight learning checkpoint. Record reusable lessons under `docs/learnings/` with `capture-learning`. Lessons marked `SideGig review: Yes` are collected centrally after a pull request is merged to `dev` by `.github/workflows/sidegig-learning-dispatch.yml`.

## Git and integration

- Normal change branches are based on `dev`.
- Do not push normal changes directly to `dev`, `staging` or `main`.
- After validation, use `merge-change` to commit, push and create/update the pull request.
- Pull requests must preserve Issue, design, validation, durable-document and learning traceability.
- Use `ci-diagnostics` for failed automated gates rather than weakening checks.
- Do not bypass required CI or branch protection.
- Do not merge or promote your own change; promotion remains an explicit human action.
- Use the installed release skills and `apify-actor-deployment` for Apify deployment work.

## Project commands

### Install

```text
npm ci
```

### Run locally

```text
npm run build && npm start
```

### Validate

```text
npm run validate
```

## Project-specific constraints

- Preserve the approved enriched Google News POC boundary: Google News query/locale/recency/result-limit/dedupe controls, publisher URL resolution, optional best-effort full-text extraction and Apify dataset/API delivery.
- Publisher URL resolution and full-text failures must be isolated per row; a single publisher failure must not fail the whole run.
- Preserve the original Google News URL as provenance/fallback.
- Keep the architecture lightweight and HTTP-first.
- Do not introduce browser rendering, paywall bypass, residential proxies, paid external extraction/news APIs, stateful monitoring, multi-source aggregation or AI enrichment without a new approved product decision.
- Do not copy legacy Actor implementation into this repository outside normal Issue-centred implementation work.
