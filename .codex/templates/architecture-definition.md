# Architecture Definition: <product name>

> Canonical durable architecture artifact. This document describes the current approved technical structure of the product. Keep it concise and current; change-specific HLD/LLD artifacts and Git history record how the architecture evolved.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**Product Definition:** `<path and artifact ID>`  
**Traceability:** `<relevant requirements, decisions, issues, or change artifacts>`

## 1. Architecture Summary

<Describe the overall technical shape of the product, the main architectural approach, and the most important structural decisions in a few paragraphs.>

## 2. System Context and Boundaries

<Describe what is inside the product boundary, the users or consuming systems that interact with it, and the material external systems or platforms it depends on.>

## 3. Components and Responsibilities

| Component   | Responsibility                   |
| ----------- | -------------------------------- |
| <component> | <what it owns and why it exists> |

## 4. Principal Flows

### <Flow name>

1. <entry point or trigger>
2. <component interaction>
3. <processing / state change>
4. <result>

<Include only flows needed to understand the architecture.>

## 5. Interfaces and Integrations

| Interface / integration                                     | Purpose         | Direction / contract               |
| ----------------------------------------------------------- | --------------- | ---------------------------------- |
| <API, event, platform, service, CLI, Actor interface, etc.> | <why it exists> | <important architectural contract> |

## 6. Data and State

<Describe material data concepts, ownership, persistence, lifecycle, and movement between components. State “No persistent application state” where applicable.>

## 7. Deployment and Runtime

<Describe the deployment target, runtime shape, major environments, execution model, and infrastructure or platform dependencies that materially affect the architecture.>

## 8. Cross-Cutting Architecture

Record only concerns that materially shape the system.

- **Security:** <relevant trust, secret, identity, or access considerations, or Not material>
- **Reliability:** <failure/retry/resilience expectations, or Not material>
- **Observability:** <material logging, metrics, diagnostics, or Not material>
- **Performance / scale:** <material constraints or assumptions, or Not material>
- **Cost:** <architecture-relevant cost constraint or Not material>

## 9. Architecture Principles and Constraints

- <durable architectural rule, technology constraint, platform constraint, or design principle>
- <constraint or principle>

## 10. Open Architecture Questions

<Unresolved questions that materially affect the durable architecture. If none: “No outstanding architecture questions.”>

## 11. Architecture Summary

- <key architectural decision>
- <key architectural decision>
- <key architectural decision>

### Completion contract

The Architecture Definition is ready to act as an authoritative technical input when the product boundary, major components, principal flows, interfaces, data/state, deployment shape, material cross-cutting concerns, constraints, and material open questions are resolved.

Set **Status** to `Approved` only when no unresolved architecture decision blocks change design or implementation.

This document represents the current approved product architecture. Do not use it as a change design, implementation plan, file-level design, or historical decision log.
