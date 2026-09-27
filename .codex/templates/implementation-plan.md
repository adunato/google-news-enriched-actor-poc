# Implementation Plan: <change name>

> Canonical change-specific implementation artifact. Use this template only when the Development Lifecycle requires an implementation plan. An HLD is referenced when one was required; otherwise record explicitly why no HLD was needed.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Issue:** `<#issue or URL>`  
**HLD reference:** `<path and artifact ID | Not required>`  
**Context references:** `<Product Definition / Architecture Definition references or None>`

## 1. Implementation Summary

<Practical implementation shape, affected areas, sequencing, and dependencies.>

## 2. HLD Reference

<Identify the approved HLD and the design decisions that constrain implementation. If no HLD was required, state “Not required” and explain why the Issue and durable product/architecture context are sufficient.>

## 3. Repository Assessment

<Relevant repository components, patterns, reusable behaviour, constraints, and replacement/extension points discovered during inspection.>

## 4. Implementation Approach

### 4.1 <Implementation Area>

<What changes, why, responsibility, and dependencies.>

### 4.2 <Implementation Area>

<Add or remove areas as needed.>

## 5. Implementation Sequence

1. <underlying capability>
2. <dependent behaviour>
3. <integration and supporting behaviour>
4. <integrity checks and hand-off>

<Explain only meaningful dependencies.>

## 6. Development Integrity Checks

- <lint, formatting, syntax, type, build, or repository-specific check>
- <check or “Not applicable, because …”>

## 7. Validation Requirements

### Unit Validation

- <behaviour and edge case to prove>

### End-to-End Validation

- <user/system flow to prove, or Not applicable>

### Other Relevant Validation

- <integration, migration, compatibility, or manual check, if needed>

## 8. Open Implementation Questions

<Questions requiring resolution before or during development. If none: “No outstanding implementation questions.”>

## 9. Low-Level Design Decision

**LLD required:** `<Yes | No>`

### Rationale

<Assess file-level complexity, coupling, repository-specific decisions, and implementation risk. If Yes, state what the LLD must resolve. If No, explain why the Issue, HLD (if any), and plan are sufficient.>

## 10. Implementation Checklist

- [ ] <implementation activity>
- [ ] <implementation activity>
- [ ] Complete relevant integrity checks
- [ ] Prepare implementation hand-off for validation

### Approval

**Decision:** `<Approve implementation | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up:** `<actions or None>`

### Completion contract

The plan is substantively complete only when the repository assessment, implementation approach and sequence, checks, validation requirements, explicit LLD decision, open questions, and traceability are resolved. Set **Status** to `Approved` only when implementation can proceed without an unresolved material planning decision.
