# Technical Discovery: <question / boundary>

> Canonical evidence artifact for a prerequisite technical investigation. This artifact establishes what is known well enough to support downstream design decisions. It is not a production implementation plan.

**Artifact ID:** `<stable-id>`  
**Status:** `<Draft | Complete | Inconclusive | Superseded>`  
**Owner:** `<person or role>`  
**Created / updated:** `<YYYY-MM-DD>`  
**GitHub Issue:** `<#issue or URL>`  
**Blocked downstream Issue(s):** `<#issue(s) or URL(s)>`  
**Product Definition:** `<path / requirement references or None>`  
**Architecture Definition:** `<path / section references or None>`

## 1. Technical Question

<State exactly what must be learned or decided and what downstream decision depends on the answer.>

## 2. Known Context and Unknowns

### Established evidence

- <official specification, existing repository evidence, validated prior behaviour, or other established fact>

### Material unknowns

- <undocumented, reverse-engineered, volatile, environment-dependent, or otherwise unproven behaviour>

Treat third-party/community implementations as leads or evidence sources, not as authoritative specifications unless the external provider explicitly documents them as such.

## 3. Investigation Design

### Representative environments and data

<Define the runtime environments, regions/accounts/permissions, live data, external providers, URL/data shapes, or other dimensions that materially affect the answer.>

### Hypotheses / candidate approaches

- <hypothesis or approach and what observation would support/refute it>
- <alternative where applicable>

### Probes / experiments

1. <reproducible probe, command, script, or controlled experiment>
2. <probe>

State bounds for requests, cost, data retention, credentials, and other operational constraints. Disposable probes may be used; they are not production code.

## 4. Evidence

<Record exact observations with timestamps, environment identity, inputs, result counts, statuses, representative failures, and stable references to retained evidence. Do not convert inference into fact.>

## 5. Findings

- <finding directly supported by evidence>
- <finding>

Distinguish:

- observed behaviour;
- supported inference;
- unresolved uncertainty.

## 6. Limitations and Variability

<What was not tested, environmental constraints, provider volatility, sample limitations, legal/permission boundaries, or other reasons the findings may not generalise.>

## 7. Conclusion

**Result:** `<Feasible | Not feasible | Inconclusive>`

**Supported integration/behaviour contract:** <What downstream design may now rely on, or "None established.">

**Viable approach(es):** <approach(es), or None>

**Rejected / unsupported approach(es):** <approach(es) and evidence, or None>

A Feasible conclusion requires enough representative evidence to support downstream design within the approved constraints. Inconclusive evidence does not authorize production implementation that depends on the unresolved behaviour.

## 8. Downstream Implications

- <blocked Feature/Bug Issue(s) and how they should be refined/reassessed>
- <Product Definition or Architecture Definition decision/update if required>
- <additional discovery required, if any>

After this discovery is integrated, rerun `assess-change` on each blocked downstream Issue. Do not continue an existing HLD/Implementation Plan that assumed behaviour contradicted or left unresolved by this evidence.

## 9. Reproducibility

Record:

- exact repository commit / probe version;
- commands or scripts used;
- runtime/environment details;
- configuration and representative input set;
- UTC execution time/window;
- retained evidence paths;
- any credential or environment prerequisite without recording secret values.

## Completion

**Decision:** `<Complete | Inconclusive / further discovery required>`  
**Rationale:** <why the evidence is sufficient or insufficient>  
**Required downstream action:** <reassess blocked Issue(s), product/architecture decision, further discovery, or None>
