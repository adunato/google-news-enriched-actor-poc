---
name: bootstrap-project
description: Establish a new SideGig product repository from the canonical operating model, templates and project context without inventing product scope.
---

# Bootstrap Project

Establish the initial repository baseline defined by Chapter 1 of the SideGig Development Operating Model.

Use the approved upstream product/POC context and the canonical project-local templates under `.codex/templates/`. Bootstrap is repository setup, not a product change: do not create an artificial implementation Issue or pull request solely to initialize the repository.

Create or populate, as applicable:

- `README.md` from `.codex/templates/README-template.md`;
- `AGENTS.md` from `.codex/templates/AGENTS-template.md`;
- repository-root `.gitattributes` from `.codex/templates/product.gitattributes`, establishing `* text=auto eol=lf` before normal development begins;
- `docs/product.md` from `.codex/templates/product-definition.md`;
- `docs/architecture.md` from `.codex/templates/architecture-definition.md`;
- `.github/ISSUE_TEMPLATE/feature.md` and `bug.md`;
- `.github/workflows/sidegig-learning-dispatch.yml` from `.codex/templates/learning-collection-dispatch.yml`;
- the project source/test/configuration baseline;
- the canonical local validation command and required language/tool configuration;
- formatter configuration and a formatter check for the generated and installed artifacts;
- the project-appropriate CI validation workflow and any deployment workflow already required by the known architecture.

The product `.gitattributes` baseline is standard SideGig repository infrastructure. It normalizes text checkouts to LF so formatter and validation behaviour is stable across Windows and Linux. The package installer creates it when absent. If an existing `.gitattributes` does not already contain the canonical `* text=auto eol=lf` rule, bootstrap must stop and require explicit reconciliation rather than overwrite product-specific attributes.

The learning-dispatch workflow is standard SideGig repository infrastructure. It runs when a pull request is merged to `dev` and immediately dispatches the central SideGig learning collector.

Secret provisioning is part of bootstrap, not a later manual reminder. After the repository and dispatch workflow exist, use `provision-repository-secrets` and run the installed `.codex/tools/provision-repository-secrets.ps1` tool for the new `owner/repository`. The tool consumes the one-time workstation credential initialized through `implementation/bootstrap/initialize-dispatch-credential.ps1` in the SideGig repository and automatically creates or updates `SIDEGIG_COLLECTOR_DISPATCH_TOKEN`.

If the local credential is missing or provisioning fails, treat bootstrap as blocked. Do not mark bootstrap complete and do not defer the secret as an undocumented or optional manual task.

Preserve the operating-model branch model: create `dev`, `staging`, and `main` from the same bootstrap baseline, set `dev` as the default branch, and apply the required repository controls after the branches and CI checks exist.

Do not invent unresolved product or architecture decisions merely to finish bootstrap. Durable documents may remain `Draft` where the operating model permits it, with unresolved decisions made explicit.

Do not bypass GitHub permissions or silently weaken branch protection, CI, or secret handling because an automated setup step is inconvenient.

After creating and installing all bootstrap artifacts, run the target repository's configured formatter check against those artifacts, followed by its canonical validation command. The canonical validation command must include formatting verification where the project supports it. A formatter or validation failure blocks bootstrap completion and must be corrected before reporting success.

## Completion contract

Report the repository, baseline commit, permanent branches/default branch, durable-document status, installed Issue templates, validation command, installed CI/deployment workflows, learning-dispatch workflow, automatic repository-secret provisioning result, lifecycle package version, repository controls applied, unresolved bootstrap blockers, and any explicit human action still required. Bootstrap is complete only when the repository can enter the normal Issue-centred Development Lifecycle safely.

## Learning checkpoint

Before completing this skill, consider whether execution exposed a reusable lesson about the product, Development Operating Model, a skill/template, tooling/CI, or the implementation methodology. A normal defect or one-off execution problem is not automatically a learning. When a reusable lesson exists, use `capture-learning` to record it under `docs/learnings/`; otherwise report `Learnings: None`. A learning that requires SideGig-level change must be recorded for later SideGig review rather than changing cross-project standards from the product repository.
