# Spike Implementation Plan: <question / boundary>

> Canonical execution-routing artifact for a Technical Spike. It translates the approved Technical Investigation Design into an ordered investigation route while leaving individual hypotheses and experiment design to the Technical Spike iteration loop.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<#issue or URL>`  
**Technical Investigation Design:** `<path and artifact ID>`  
**Spike branch:** `<branch>`

## 1. Purpose

<State what this plan controls and the downstream decision it supports. Do not restate the complete TID.>

## 2. Execution Map

Reference the TID workstream and option IDs directly. Do not rename them as new stages or create a second option taxonomy.

| Order | Workstream | TID approach | Entry condition | Exit / success condition | Fallback / next route                   |
| ----: | ---------- | ------------ | --------------- | ------------------------ | --------------------------------------- |
| 1     | W1         | A1           | <condition>     | <condition>              | <A2 / conclude workstream / TID review> |

The plan need not test every TID option. Define when sufficient evidence allows the investigation to stop and when a fallback becomes eligible.

## 3. Cross-Workstream Dependencies

<Describe only dependencies that affect execution order or evidence validity. If none: “None.”>

## 4. Execution Envelope

For each active route, state what may vary inside individual experiments without changing this plan and what would constitute a route change.

### <Workstream / TID approach>

**Experiment may vary:** <inputs, instrumentation, bounded diagnostics, implementation details that do not change the approach>  
**Requires plan/TID review:** <new mechanism, new dependency/runtime, different candidate, changed evidence meaning, changed workstream order>

## 5. Stop and Return Rules

Stop the current route and return to the appropriate higher-level artifact when:

- the TID option-viability condition is reached;
- continuing requires an approach not authorized by the TID;
- troubleshooting becomes a separate technical investigation rather than a straightforward correction to the approved experiment;
- a dependency, runtime, architecture, cost, security, legal, safety, or scope boundary materially changes;
- the representative evidence basis or success criterion must change.

## 6. Spike Completion Route

<State how completed workstreams combine to answer the Spike Issue, and which downstream Issues must be reassessed after final integration.>

## 7. Open Planning Questions

<List unresolved execution-routing questions. Do not put experiment-level hypotheses here. If none: “No outstanding Spike planning questions.”>

## 8. Approval

**Decision:** `<Approve | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up:** `<actions or None>`

### Completion contract

The plan is ready for approval when it references the approved TID directly, defines the meaningful execution order, entry/exit/fallback rules, dependencies and stop/return boundaries, and leaves individual hypotheses/experiment procedures to the Technical Spike iteration loop.
