# AGENTS.md

This repository follows the SideGig Development Operating Model. Use this file for repository-specific instructions that a coding agent must know before making changes.

## Authoritative context

For every software change, read:

1. the originating GitHub Issue — scope and acceptance criteria;
2. `docs/product.md` — current approved product definition;
3. `docs/architecture.md` — current approved technical architecture;
4. any change-specific artifacts under `docs/changes/<issue-number>/`;
5. the relevant source code and tests.

The GitHub Issue remains the root traceability object. Do not expand its scope silently.

## Agent package

Reusable SideGig skills are installed under:

`.codex/skills/`

Canonical project-local templates used by those skills are installed under:

`.codex/templates/`

Bootstrap and repository-management utilities used by those skills are installed under:

`.codex/tools/`

Use the relevant skill and installed tool instead of recreating lifecycle behaviour ad hoc. The installed package covers repository bootstrap, durable product/architecture definition, Issue refinement, proportional change assessment, prerequisite Technical Spike investigation design/planning/execution, normal change design/planning/execution, validation, CI diagnosis, integration, release preparation, staging validation, production promotion and learning capture.

## Development lifecycle

Before implementation, ensure the Feature/Bug Issue is development-ready. Use `refine-issue` when requirements or acceptance criteria need shaping, and `assess-change` to decide first whether prerequisite Technical Spike is required and then the minimum proportional design/planning path.

When `assess-change` requires a Technical Spike, create/link one controlling Technical Spike Issue and one dedicated Spike branch. Produce and approve the Technical Investigation Design, then the Spike Implementation Plan, then execute one owner-approved experiment at a time with `technical-spike`. The TID owns the technical search space; the Spike plan owns option/workstream traversal; `technical-spike.md` owns the current experiment and evidence history. Do not open a PR while the Spike is still being investigated. Create the final PR only after a supported `Feasible`/`Not feasible` conclusion and final Spike validation. After integration, rerun `assess-change` on the blocked Feature/Bug Issue.

Every experiment approval checkpoint must be self-contained from Issue context down to the proposed experiment and assume the owner has no recent project context open. If troubleshooting stops being straightforward, the agent must stop at an Experiment Viability Checkpoint rather than choosing a deeper diagnostic direction autonomously.

Create change-specific artifacts only when required:

- `technical-investigation-design.md` for the top-down Technical Spike search space and evidence boundaries;
- `spike-implementation-plan.md` for Technical Spike workstream/option sequencing and fallback rules;
- `technical-spike.md` for the living Technical Spike experiment/evidence record;
- `hld.md` for a material Feature/Bug change-design decision;
- `implementation-plan.md` for meaningful repository-level implementation planning;
- `low-level-design.md` only when an approved implementation plan requires file-level design.

When required, store these under:

`docs/changes/<issue-number>/`

Use the canonical copies in `.codex/templates/` when creating those artifacts.

Update `docs/product.md` or `docs/architecture.md` in the same change when the implemented outcome materially changes the durable product or architecture.

## Learning capture

Every lifecycle skill performs a lightweight learning checkpoint. Record only reusable lessons, not ordinary defects or one-off execution problems. When a learning exists, use `capture-learning` and store it under `docs/learnings/`; otherwise report `Learnings: None`.

Learning records must be portable evidence. A reviewer outside this repository must be able to understand the originating change/activity, constraints, observation, evidence, impact, local action and cross-project relevance without reconstructing the original pull request from scratch. Follow the required context contract in `capture-learning` and `.codex/templates/learning-record.md`.

Product-specific lessons may be resolved through normal local artifacts and changes. Lessons marked `SideGig review: Yes` are not copied to SideGig by the coding agent. When a pull request is merged to `dev`, `.github/workflows/sidegig-learning-dispatch.yml` immediately dispatches the central SideGig collector, which imports eligible records and adds merge/commit provenance. A low-frequency central scheduled scan exists only as recovery for missed dispatches.

## Git and integration

- Normal change branches are based on `dev`.
- Follow the repository branch naming defined by the SideGig GitHub Delivery Model.
- Do not push normal changes directly to `dev`, `staging` or `main`.
- For normal Feature/Bug work, after validation use `merge-change` to commit/push the branch and create/update the pull request.
- For an open Technical Spike, keep the dedicated branch without a PR. After final Spike validation, use `merge-change` to create the final integration PR.
- Pull requests must include Issue, design, validation, durable-document and learning-record traceability.
- A failed required acceptance test puts the tested candidate on Hold. Do not rerun an unchanged candidate merely to obtain a pass; diagnose the failure and make a relevant corrective change before retesting.
- Use `ci-diagnostics` for failed automated gates rather than weakening checks.
- Do not bypass required CI or branch protection.
- Do not merge or promote your own change; those remain explicit human actions.
- Use the release skills for candidate preparation, staging validation and production promotion where applicable.

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

The validation command is the repository-wide local quality contract and should match the checks used by CI.

## Project-specific constraints

- Preserve the approved enriched Google News POC boundary: Google News query/locale/recency/result-limit/dedupe controls, publisher URL resolution, optional best-effort full-text extraction and Apify dataset/API delivery.
- Publisher URL resolution and full-text failures must be isolated per row; a single publisher failure must not fail the whole run.
- Preserve the original Google News URL as provenance/fallback.
- Keep the architecture lightweight and HTTP-first.
- Do not introduce browser rendering, paywall bypass, residential proxies, paid external extraction/news APIs, stateful monitoring, multi-source aggregation or AI enrichment without a new approved product decision.
- Do not copy legacy Actor implementation into this repository outside normal Issue-centred implementation work.
