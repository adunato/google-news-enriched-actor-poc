---
name: capture-learning
description: Capture a reusable lesson discovered while executing a SideGig product lifecycle as portable evidence that remains understandable outside the originating repository.
---

# Capture Learning

Use this skill when another lifecycle skill, release activity, bootstrap activity, or live POC operation exposes a lesson worth retaining.

A learning is warranted when the observation is reusable beyond the immediate execution step or exposes a meaningful weakness, ambiguity, inefficiency, missing guardrail, or successful pattern in one of these areas:

- Product;
- Development Operating Model;
- Skill/Template;
- Tooling/CI;
- Methodology.

Do not create a learning record merely because a bug, failed test, transient environment problem, or implementation correction occurred. Capture it only when there is a reusable lesson beyond resolving the immediate problem.

Create one record per distinct learning under:

`docs/learnings/<source>-<short-slug>.md`

Use `.codex/templates/learning-record.md`.

## Portable context contract

Every learning record must remain understandable after it is copied out of the product repository and reviewed later without the originating pull request already open.

Populate:

- `Learning ID` with a stable repository-qualified identifier, using `<repository-name>--<stable-source>--<short-slug>`;
- `Origin repository` with the canonical `owner/repository`;
- `Source` with the most stable local reference available, such as `GitHub Issue #23`, `release-0.1.0`, or `bootstrap`;
- `Lifecycle stage / skill`, date, category, review flag and disposition;
- `Change context` with the goal of the originating change/activity, the material constraints or assumptions, and the situation in which the lesson arose;
- `Observation`, `Evidence`, `Impact` and `Local action`;
- `Cross-project relevance` explaining why a `SideGig review: Yes` lesson may generalize and which SideGig-owned area may need reconsideration;
- `Stable local references` with useful repository paths or GitHub references.

Do not rely on branch names, local filesystem paths, chat history, or unstated pull-request context to make the record intelligible.

The eventual SideGig collector adds integration provenance that is not reliably known at capture time, including the merged pull request, integrated commit, origin path, collection timestamp and source-content hash. Do not fabricate those values in the product repository.

Classify the learning and set `SideGig review`:

- `No` when the lesson is product-specific and can be handled entirely through the product repository's normal authoritative artifacts or tooling.
- `Yes` when it may require a change to the cross-project Development Operating Model, canonical skills/templates, bootstrap package, shared tooling convention, or implementation methodology.

For a product-specific learning, make any justified local change through the normal lifecycle and reference it in the learning record. The learning record remains historical evidence and does not replace `docs/product.md`, `docs/architecture.md`, the originating Issue, or change-specific design artifacts.

For a SideGig-level learning, capture the observation and evidence only. Do not modify or recreate the SideGig Development Operating Model or methodology inside the product repository. Promotion is a separate SideGig review activity performed after automated central collection.

Avoid duplicates. If an existing learning already captures the same lesson, update or reference it rather than creating a second record.

## Completion contract

Report the learning-record path, Learning ID, source, category, whether SideGig review is required, and any local action taken. A `SideGig review: Yes` record is incomplete unless the portable context contract above is satisfied. If the candidate observation does not meet the learning threshold, do not create a record and report `Learnings: None`.
