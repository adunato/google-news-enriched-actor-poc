# High-Level Design: <change name>

> Canonical change-specific design artifact. Use this template only when the Development Lifecycle requires an HLD. Keep the design proportional to the change and separate from the durable Product Definition and Architecture Definition.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Issue:** `<#issue or URL>`  
**Product Definition:** `<path / requirement references or None>`  
**Architecture Definition:** `<path / section references or None>`  
**Traceability:** `<other upstream requirement or decision links, or None>`

## 1. Summary

<Describe the change, the problem it solves, and the intended outcome in plain language.>

## 2. Current State

<Describe only the current behaviour and architecture relevant to this change, including material limitations.>

## 3. Requirements

<Restate the requirements needed for the design so this artifact can be understood alongside the originating Issue.>

### Functional Requirements

- <required behaviour>
- <required behaviour>

### Constraints and Important Conditions

- <compatibility, security, performance, integration, or unchanged behaviour constraint>

## 4. Expected Outcome

### Before

<Relevant current behaviour.>

### After

<Specific expected behaviour and evidence of success.>

## 5. Proposed Design

<Describe the architecture, responsibilities, interactions, decisions, and important data/control flow. Do not prescribe individual file edits.>

### High-Level Flow

1. <event or user action>
2. <system response>
3. <processing and state change>
4. <result or operational outcome>

## 6. Backend Changes

<Services, APIs, domain logic, persistence, jobs, integrations, or error handling. State “No meaningful backend impact” when applicable.>

## 7. UI and User Experience Changes

<User-visible flows and loading, empty, success, or error states. State “No meaningful UI impact” when applicable.>

## 8. Data and State

<Data concepts, ownership, persistence, transitions, migration, compatibility, and exchanged state.>

## 9. Interfaces and Integrations

<Internal/external APIs, events, queues, commands, or integration boundaries and their responsibilities.>

## 10. Error and Edge-Case Behaviour

<Material failures, invalid input, partial failure, retries, degraded behaviour, and recovery expectations.>

## 11. Validation Considerations

<Behaviours to prove through unit, integration, end-to-end, or manual validation.>

## 12. Open Questions

<Unresolved questions that affect behaviour or implementation. If none: “No outstanding design questions.”>

## 13. Design Summary

- <key decision>
- <key decision>
- <key decision>

### Approval

**Decision:** `<Approve | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up before implementation planning/development:** `<actions or None>`

### Completion contract

The HLD is substantively complete only when the material requirements, proposed design, validation considerations, durable Product/Architecture impacts, and open questions are resolved. Set **Status** to `Approved` only when the design is ready to constrain downstream implementation.
