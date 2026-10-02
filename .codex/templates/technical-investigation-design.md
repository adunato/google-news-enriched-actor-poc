# Technical Investigation Design: <Spike question / boundary>

> Canonical Spike-specific investigation-design artifact. Use this template for a Technical Spike after the controlling Issue/workspace exists and before experiment execution begins. It defines the technical search space and evidence boundaries; it is not a production HLD and not an experiment log.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<#issue or URL>`  
**Product Definition:** `<path / requirement references or None>`  
**Architecture Definition:** `<path / section references or None>`  
**Traceability:** `<blocked downstream Issues / prior evidence / decisions or None>`

## 1. Investigation Context

<Explain the underlying Issue, why the technical uncertainty matters to the product/downstream work, and what must become known before downstream design/implementation can proceed.>

## 2. Current Technical Context

### Established facts

- <authoritative specification or directly observed behaviour>
- <relevant prior evidence>

### Material unknowns

- <unknown that the Spike must resolve>

Do not treat third-party/community code as authoritative specification unless the external provider explicitly documents it as such.

## 3. Scope, Constraints and Non-Goals

### In scope

- <bounded technical boundary>

### Constraints

- <approved product/architecture/dependency/cost/runtime/risk constraint>

### Explicit non-goals

- <direction that must not emerge implicitly during experimentation>

## 4. Investigation Structure

Break the technical question into one or more stable workstreams only when that decomposition materially clarifies the investigation.

| Workstream | Purpose                  | Dependency / relationship | Evidence needed to resolve it |
| ---------- | ------------------------ | ------------------------- | ----------------------------- |
| W1         | <technical sub-question> | <None / dependency>       | <decision evidence>           |

## 5. Candidate Approaches

Define materially credible approaches at the level needed to understand how they work and how they fit the system. Do not prescribe experiment-by-experiment troubleshooting here.

| Workstream | Option | High-level technical approach | Why credible         | Dependencies / constraints | Known limitations | Initial disposition                            |
| ---------- | ------ | ----------------------------- | -------------------- | -------------------------- | ----------------- | ---------------------------------------------- |
| W1         | O1     | <approach>                    | <evidence/rationale> | <constraints>              | <limitations>     | <Primary / Reserve / Reference only / Rejected> |

The option set should be proportionate to the Issue. A Spike is not a general market or technology survey.

## 6. Technical Interaction Model

<Describe the high-level system/integration flow relevant to the investigation and the responsibility boundaries that experiments must preserve. Use diagrams where useful.>

## 7. Evidence and Decision Criteria

For each workstream, define what evidence is sufficient to decide whether the required outcome is supported within the approved constraints.

| Workstream | Representative environment/data | Success / decision criterion          | Evidence boundary            |
| ---------- | ------------------------------- | ------------------------------------- | ---------------------------- |
| W1         | <environment/sample>            | <threshold or supported behaviour>    | <what is and is not proved>  |

Candidate approaches do not all need to be tested merely because they are listed. The Spike Implementation Plan determines the traversal order and fallback conditions.

## 8. Investigation Boundaries

The executing agent may formulate and propose bounded hypotheses inside the approved search space. A material change to the workstreams, candidate set, architectural assumptions, excluded capabilities or evidence criteria requires TID review before the investigation proceeds in that new direction.

## 9. Open Investigation-Design Questions

<Questions that prevent the investigation design from being approved. If none: “No outstanding investigation-design questions.”>

## 10. Investigation Design Summary

- <key workstream / option decision>
- <key boundary>
- <key evidence criterion>

### Approval

**Decision:** `<Approve investigation design | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up before Spike Implementation Planning:** `<actions or None>`

### Completion contract

The TID is complete when the technical question has a coherent problem decomposition, credible candidate approaches are represented proportionately, system/integration boundaries are clear, evidence criteria are explicit, and no unresolved investigation-design decision prevents planning. Approval authorizes the investigation design only; it does not establish technical feasibility.
