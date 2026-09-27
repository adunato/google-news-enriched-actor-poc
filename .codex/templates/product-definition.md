# Product Definition: <product name>

> Canonical durable product artifact. This document describes the current approved product intent and externally meaningful behaviour. Keep it concise and current; Git history records how the definition evolved.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**Upstream context:** `<POC, productisation decision, research, or other source links>`  
**Traceability:** `<relevant requirements, decisions, or issues>`

## 1. Product Summary

<Describe what the product is, the problem it solves, and the value it provides in a few sentences.>

## 2. Users and Primary Use Cases

### Users

- <user, customer, operator, or consuming system>

### Primary Use Cases

1. <primary use case>
2. <primary use case>

## 3. Product Scope

### In Scope

- <capability or behaviour that belongs to the product>

### Out of Scope

- <explicit non-goal or excluded capability>

## 4. Product Capabilities

| Capability   | Description                    |
| ------------ | ------------------------------ |
| <capability> | <what the product must enable> |

## 5. Product Requirements and Behaviour

Use stable requirement IDs where they materially improve traceability. Keep requirements behavioural and implementation-independent.

| ID       | Requirement                  |
| -------- | ---------------------------- |
| `PR-001` | <required product behaviour> |

## 6. External Interaction and Contract

<Describe the externally meaningful interaction with the product: user flow, API/CLI/Actor contract, principal inputs and outputs, or other observable behaviour. State “Not applicable” for aspects that do not apply. Do not describe internal architecture here.>

## 7. Constraints and Non-Goals

- <product, commercial, platform, compatibility, legal, or other constraint that affects what the product may do>
- <important non-goal>

## 8. Open Product Questions

<Unresolved questions that materially affect product scope or behaviour. If none: “No outstanding product-definition questions.”>

## 9. Product Definition Summary

- <key product decision>
- <key product decision>
- <key product decision>

### Completion contract

The product definition is ready to act as an authoritative product input when its purpose, users, scope, capabilities, material requirements, external behaviour, constraints, and material open questions are resolved. Set **Status** to `Approved` only when no unresolved product-definition decision blocks architecture or change design.

This document represents the current approved product definition. Do not use it as a roadmap, backlog, changelog, architecture document, or implementation plan.
