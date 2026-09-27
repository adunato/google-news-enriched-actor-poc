# Low-Level Design: <change name>

> Canonical optional file-level design artifact. Create this document only when an approved Implementation Plan explicitly requires an LLD. It is design guidance, not a patch.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Issue:** `<#issue or URL>`  
**Implementation Plan:** `<path and artifact ID>`  
**HLD reference:** `<path and artifact ID | Not required>`

## 1. Change Overview

<Implementation shape in a few sentences; do not repeat the HLD or plan.>

## 2. File Changes

### `<path/to/file>`

**Action:** `<Modify | Create | Remove | Move>`

<Specific responsibility, symbol/component, behaviour after change, and useful interactions. Do not provide a diff.>

### `<path/to/another-file>`

**Action:** `<Modify | Create | Remove | Move>`

<Required change. Add one subsection for every significant file.>

## 3. Cross-File Dependencies

1. `<file>` establishes `<capability/interface>`.
2. `<dependent file>` consumes or extends it.
3. `<integrating file>` exposes the resulting behaviour.

<State “No meaningful cross-file dependency” when applicable.>

## 4. File Change Summary

| File     | Action   | Purpose |
| -------- | -------- | ------- | ------ | ------ | --------------------- |
| `<path>` | `<Modify | Create  | Remove | Move>` | `<short description>` |

### Completion contract

The LLD is substantively complete only when every significant file has an action and responsibility, dependencies are explicit where needed, the summary agrees with the detailed entries, and **Status** is `Approved` against the originating Issue and Implementation Plan.
