<!-- prettier-ignore-start -->

# Technical Investigation Design: <question / boundary>

> Canonical pre-execution design artifact for a Technical Spike. It explains the technical problem, defines the bounded experiments needed to answer it, and makes their order, conditionality and decision routing explicit. It is not a production HLD and it is not an experiment log.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Approved | Superseded>`  
**Owner:** `<person or role>`  
**Created:** `<YYYY-MM-DD>`  
**Updated:** `<YYYY-MM-DD>`  
**GitHub Spike Issue:** `<descriptive Issue name + #number or URL>`  
**Spike branch:** `<branch>`  
**Blocked downstream Issue(s):** `<descriptive Issue name(s) + #number(s) or URL(s)>`  
**Product Definition:** `<path / requirement references or None>`  
**Architecture Definition:** `<path / section references or None>`

## 1. What this investigation is trying to achieve

<Explain the product/capability problem and the technical question in plain language. Name affected downstream Issues/capabilities before using their numbers. State the measurable outcome the Spike must establish and why existing evidence is insufficient.>

<Summarise only prior evidence that materially changes what should be tested now. Do not reproduce experiment chronology.>

---

## 2. Investigation Area <A> — <plain-language question>

> Use Investigation Areas only when the Technical Question genuinely contains separable technical questions. A simple Spike may contain a single area.

### Objective

<State what this area must establish.>

### Existing evidence and why this area is needed

- <relevant established fact or prior evidence>
- <why that evidence leaves this specific uncertainty unresolved>

### Success criteria for this investigation area

<State the measurable evidence required to complete this area, including representative environment/data and quantitative thresholds where applicable.>

<State the boundary condition that would stop this area rather than silently expand the architecture or scope.>

### Experiment sequence

| Order | ID | Experiment | Purpose | Run when | Next if successful | Next if unsuccessful |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | A1 | <short experiment name> | <concise reason it exists> | **Always first** | <next experiment / area complete> | <next experiment / stop / TID review> |
| 2 | A2 | <short experiment name> | <concise reason it exists> | **Only if <trigger>** | <next route> | <next route> |

This table is the controlling procedural view for the area. Detailed experiment sections below explain each experiment; they do not create a different sequence or trigger model.

### Experiment A1 — <name>

**Objective**  
<What this experiment must establish or distinguish.>

**Why this experiment exists**  
<Why this test is necessary given the evidence already available. Explicitly distinguish a baseline/reproduction test from a new feasibility test when relevant.>

**Test**  
<The bounded experiment: representative environment/data, comparison/control, sequence and relevant setup. Be concrete enough that the executor knows what is being tested without inventing a different test.>

**Measures**  
- <observable measure>
- <observable measure>

**Execution rule**  
<Always run / run only if a specific predecessor condition is met.>

**Decision / next step**
- If <result>, <next route>.
- If <result>, <next route>.
- If continuing would require a materially different mechanism, dependency, architecture, evidence basis or investigation, stop for TID review/owner decision.

### Experiment A2 — <name>

<Repeat the same Objective / Why / Test / Measures / Execution rule / Decision structure for every planned experiment.>

---

## 3. Constraints that apply to every experiment

- <approved architecture/product/runtime constraint>
- <prohibited technique or dependency>
- <cost/request/time/data-retention boundary>
- <evidence or acceptance criterion that must not be silently weakened>

A straightforward mechanical correction inside a defined experiment is allowed when it does not change what is being tested or what the evidence would mean. If troubleshooting becomes a different technical investigation, requires new machinery, or changes the experiment's purpose, stop and revise/review the TID before continuing.

---

## 4. Evidence and decision rules

Each experiment must make it possible to answer:

1. What were we trying to establish?
2. Why was this experiment necessary given what we already knew?
3. What happened, using understandable measures?
4. What does that result mechanically cause us to do next?

Reuse valid historical evidence rather than recreating it unless current production-like behaviour is itself part of the question.

Synthetic/local evidence may prove mechanics but cannot replace required representative live/in-environment evidence.

A failed required acceptance run remains a failed result for that code/configuration. Do not rerun it unchanged merely to seek a different outcome.

---

## 5. Investigation completion

<State how the Investigation Areas combine to answer the original Technical Question and what constitutes Feasible versus Not feasible.>

<State what downstream Issue(s) or Product/Architecture decision must follow each terminal outcome.>

## 6. Open design questions

<List only questions that prevent approval of the investigation design. Do not put execution-time findings here. If none: “No outstanding investigation-design questions.”>

## 7. Review and approval

**Decision:** `<Approve | Hold | Reject>`  
**Rationale:** `<decision and remaining conditions>`  
**Required follow-up before execution:** `<actions or None>`

Approval authorises execution of the bounded experiment sequence and conditional transitions defined in this TID. A separate approval is not required for each experiment that remains within the approved design.

### Completion contract

The TID is ready for approval when the technical problem is understandable without repository archaeology; any useful Investigation Areas are self-contained; every planned experiment has an objective, rationale, test, measures, execution rule and next-step rule; sequence/optionality/branching are obvious at a glance; success criteria and constraints are explicit; and no material investigation-design decision remains unresolved.

<!-- prettier-ignore-end -->
