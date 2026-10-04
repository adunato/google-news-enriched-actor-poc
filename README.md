# Enriched Google News Actor POC

A proof-of-concept Apify Actor that turns Google News queries into structured article records with resolved publisher URLs and optional best-effort readable article text.

## Status

Proof of concept. Repository establishment is complete; product functionality is intentionally not implemented in the bootstrap baseline.

## Getting started

### Prerequisites

- Node.js 20
- npm
- An Apify account and Apify CLI when platform execution/deployment is required

### Install

```text
npm ci
```

### Run locally

```text
npm run build && npm start
```

The bootstrap entrypoint contains no functional Actor behaviour. Product implementation begins through GitHub Issues under the SideGig Development Lifecycle.

## Usage

The intended external contract is defined in [docs/product.md](docs/product.md). Actor inputs, output schemas and Store-facing behaviour will be introduced through controlled implementation Issues rather than during repository bootstrap.

## Development

Run the complete repository validation suite with:

```text
npm run validate
```

Additional project commands:

| Command                | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run format:check` | Verify formatting for repository and installed lifecycle artifacts. |
| `npm run lint`         | Run ESLint.                                                         |
| `npm run typecheck`    | Run the TypeScript compiler without emitting output.                |
| `npm test`             | Run the Vitest test suite.                                          |
| `npm run build`        | Compile TypeScript to `dist/`.                                      |

Repository-specific agent instructions are in [AGENTS.md](AGENTS.md).

## Project documentation

- [Product Definition](docs/product.md) — approved POC intent, scope, capabilities and external behaviour.
- [Architecture Definition](docs/architecture.md) — approved technical architecture.

Technical Spike artifacts (`technical-investigation-design.md` and `technical-spike.md`) and normal Feature/Bug HLD, Implementation Plan and LLD artifacts are stored under `docs/changes/<issue-number>/` only when required by the SideGig Development Lifecycle.

## Deployment

The deployment target is one independently deployable Apify Actor. Releases follow the SideGig `dev` → release candidate → `staging` → `main` promotion model and the installed `apify-actor-deployment` skill.
