# Implementation Plan: <change name>

> Canonical change-specific implementation artifact. Use this template only when the Development Lifecycle requires an implementation plan. An HLD is referenced when one was required; otherwise record explicitly why no HLD was needed.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Issue:** `<#issue or URL>`  
**HLD reference:** `<path and artifact ID | Not required>`  
**Technical Discovery:** `<completed discovery Issue/artifact reference | Not required>`  
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

1. <bounded residual feasibility gate, when one exists>
2. <underlying capability>
3. <dependent and integration behaviour>
4. <integrity checks and validation hand-off>

<Explain only meaningful dependencies. Required Technical Discovery must already be complete before this plan is approved. A plan-level feasibility gate is only for bounded residual uncertainty inside the established design.>

## 6. Development Integrity Checks

- <lint, formatting, syntax, type, build, or repository-specific check>
- <check or “Not applicable, because …”>

## 7. Test and Validation Strategy

The strategy must prove every material acceptance criterion at the lowest level that can actually establish the claimed behaviour. Mocked tests may prove local logic and failure handling, but they do not prove a material external/runtime integration works.

### Acceptance Evidence Matrix

| Acceptance criterion / behaviour | Risk or boundary                   | Test level                                              | Environment / data                   | Pass evidence                  |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------- | ------------------------------------ | ------------------------------ |
| <criterion/reference>            | <what could invalidate acceptance> | <unit/component/contract/integration/end-to-end/manual> | <mocked/local/live/staging/platform> | <observable evidence required> |

### Bounded Residual Feasibility Gates

<List only narrow residual assumptions that can be demonstrated without determining the fundamental external integration contract or basic viability. State the exact evidence and stop/return path if a gate fails. If the unknown is material enough to require empirical characterization or selection among fundamentally different integration approaches, this plan must remain on hold and the Issue must return to `assess-change` for Technical Discovery. If none: “None.”>

### Representative End-to-End / Live Coverage

<Define the representative scenario matrix needed to prove the real user/system flow. Cover material variability such as different external providers, data shapes, states, permissions, or failure classes where relevant. Do not use one token smoke test when the integration is materially variable. If live/in-environment validation is not applicable or cannot safely be performed before staging, explain why and state the later blocking gate explicitly.>

### Regression and Edge Coverage

<Identify lower-level automated tests needed for logic, regressions, error handling, bounds, and stable contracts.>

## 8. Open Implementation Questions

<Questions requiring resolution before or during development. If none: “No outstanding implementation questions.” A question about fundamental external/runtime viability or specification is Technical Discovery, not an implementation question. A narrow residual implementation assumption may be a bounded feasibility gate.>

## 9. Low-Level Design Decision

**LLD required:** `<Yes | No>`

### Rationale

<Assess file-level complexity, coupling, repository-specific decisions, and implementation risk. If Yes, state what the LLD must resolve. If No, explain why the Issue, HLD (if any), and plan are sufficient.>

## 10. Implementation Checklist

- [ ] Complete required feasibility gates
- [ ] <implementation activity>
- [ ] <implementation activity>
- [ ] Complete relevant integrity checks
- [ ] Execute the acceptance-evidence strategy required before validation hand-off
- [ ] Prepare implementation hand-off for validation

### Approval

**Decision:** `<Approve implementation | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up:** `<actions or None>`

### Completion contract

The plan is substantively complete only when required Technical Discovery is complete, the repository assessment, implementation approach and sequence, checks, acceptance-evidence matrix, bounded residual feasibility gates, representative end-to-end/live coverage, explicit LLD decision, open questions, and traceability are resolved. Set **Status** to `Approved` only when implementation can proceed without an unresolved material planning or feasibility decision.
