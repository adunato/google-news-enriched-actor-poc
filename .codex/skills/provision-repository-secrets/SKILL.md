---
name: provision-repository-secrets
description: Provision standard SideGig GitHub Actions secrets into a product repository during bootstrap without exposing secret values.
---

# Provision Repository Secrets

Use this skill during repository bootstrap after the GitHub repository exists and before bootstrap is declared complete.

The standard SideGig post-merge learning handoff requires the repository Actions secret:

`SIDEGIG_COLLECTOR_DISPATCH_TOKEN`

The secret value is a reusable fine-grained GitHub token scoped only to `adunato/SideGig` with `Actions: write`. It is initialized once on the developer workstation and stored under the current Windows user's DPAPI protection. It must never be committed to a repository, printed in logs, copied into project documentation, or passed as a command-line argument.

## Required local prerequisite

The workstation must contain the encrypted bootstrap credential at:

`%LOCALAPPDATA%\SideGig\bootstrap\collector-dispatch-token.dpapi`

If it is missing, bootstrap is blocked. Do not silently continue and do not replace automatic provisioning with a reminder.

Initialize it once from the SideGig repository with:

`implementation/bootstrap/initialize-dispatch-credential.ps1`

Token creation itself remains an explicit human security action in GitHub. The initialization script only stores the already-created token locally under Windows DPAPI.

## Provisioning

From the product repository, run the installed package tool:

`.codex/tools/provision-repository-secrets.ps1 -Repository <owner/repository>`

The tool:

1. verifies GitHub CLI is available;
2. loads and decrypts the local DPAPI-protected bootstrap credential;
3. uses the developer's existing GitHub CLI authentication to create or update the repository Actions secret;
4. passes the secret value through standard input rather than exposing it in process arguments;
5. verifies that `SIDEGIG_COLLECTOR_DISPATCH_TOKEN` exists in the target repository.

A failure is a bootstrap blocker. Do not mark repository bootstrap complete while the secret is absent.

## Completion contract

Report the target repository and whether `SIDEGIG_COLLECTOR_DISPATCH_TOKEN` was provisioned and verified. Never report, echo, persist, or reconstruct the secret value.

## Learning checkpoint

Before completing this skill, consider whether secret provisioning exposed a reusable lesson about bootstrap, repository permissions, tooling or the Development Operating Model. Use `capture-learning` only when there is a reusable lesson beyond resolving the immediate setup problem; otherwise report `Learnings: None`.
