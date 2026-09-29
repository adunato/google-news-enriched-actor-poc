const CELLS = ["q1-gb", "q1-us", "q2-gb", "q2-us", "q3-gb", "q3-us", "q4-gb", "q4-us", "q5-gb", "q5-us"];
const CANDIDATE_CLASSES = ["resolved", "not_resolved"];
const ROBOTS_CLASSES = ["allowed", "not_found", "disallowed", "unavailable", "truncated_unknown", "not_checked"];
const FETCH_CLASSES = ["http_2xx_html", "http_other", "transport_error", "not_attempted"];
const EXTRACTION_CLASSES = ["not_attempted", "timeout", "error", "empty", "oversize", "too_short", "quality_rejected", "accepted_proxy"];
const PROXY_CLASSES = ["not_scored", "empty", "oversize", "too_short", "quality_rejected", "accepted_proxy", "error"];

function oneOf(value, choices, field) {
  if (!choices.includes(value)) throw new Error(`invalid_${field}`);
  return value;
}

function countMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function timingBin(value) {
  if (!Number.isFinite(value) || value < 0) return "unavailable";
  if (value < 500) return "lt_500ms";
  if (value < 1000) return "500ms_to_lt_1s";
  if (value < 2000) return "1s_to_lt_2s";
  if (value < 5000) return "2s_to_lt_5s";
  return "gte_5s";
}

function prefixBin(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "unavailable";
  if (value < 16 * 1024) return "lt_16KiB";
  if (value < 64 * 1024) return "16_to_lt_64KiB";
  if (value < 128 * 1024) return "64_to_lt_128KiB";
  if (value < 256 * 1024) return "128_to_lt_256KiB";
  return "256KiB_cap";
}

function newCell(cellId) {
  return {
    cellId,
    plannedRows: 0,
    candidate: countMap(CANDIDATE_CLASSES),
    robots: countMap(ROBOTS_CLASSES),
    fetch: countMap(FETCH_CLASSES),
    eligible2xxHtml: 0,
    gateSignal: { positive: 0, clear: 0, unavailable: 0 },
    extraction: countMap(EXTRACTION_CLASSES),
    proxy: countMap(PROXY_CLASSES),
    gateProxyComparison: {
      gate_positive_accepted_proxy: 0,
      gate_positive_scored_not_accepted: 0,
      gate_positive_timeout_error_or_not_scored: 0,
      gate_clear_accepted_proxy: 0,
      gate_clear_scored_not_accepted: 0,
      gate_clear_timeout_error_or_not_scored: 0,
      gate_unavailable: 0,
    },
    extractionTimingBins: countMap(["lt_500ms", "500ms_to_lt_1s", "1s_to_lt_2s", "2s_to_lt_5s", "gte_5s", "unavailable"]),
    prefixSizeBins: countMap(["lt_16KiB", "16_to_lt_64KiB", "64_to_lt_128KiB", "128_to_lt_256KiB", "256KiB_cap", "unavailable"]),
  };
}

function incrementComparison(cell, gate, extraction) {
  if (gate === null) {
    cell.gateProxyComparison.gate_unavailable += 1;
    return;
  }
  const prefix = gate ? "gate_positive" : "gate_clear";
  if (extraction === "accepted_proxy") cell.gateProxyComparison[`${prefix}_accepted_proxy`] += 1;
  else if (["empty", "oversize", "too_short", "quality_rejected"].includes(extraction))
    cell.gateProxyComparison[`${prefix}_scored_not_accepted`] += 1;
  else cell.gateProxyComparison[`${prefix}_timeout_error_or_not_scored`] += 1;
}

/** Convert transient per-row observations into aggregate-only persisted evidence. */
export function aggregateRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 100) throw new Error("cohort_must_contain_100_rows");
  const cells = new Map(CELLS.map((cellId) => [cellId, newCell(cellId)]));
  for (const row of rows) {
    if (!row || !cells.has(row.cellId)) throw new Error("invalid_cell_id");
    const cell = cells.get(row.cellId);
    cell.plannedRows += 1;
    const candidate = oneOf(row.candidateClass, CANDIDATE_CLASSES, "candidate_class");
    const robots = oneOf(row.robotsClass, ROBOTS_CLASSES, "robots_class");
    const fetch = oneOf(row.fetchClass, FETCH_CLASSES, "fetch_class");
    const extraction = oneOf(row.extractionClass, EXTRACTION_CLASSES, "extraction_class");
    const proxy = oneOf(row.proxyClass, PROXY_CLASSES, "proxy_class");
    if (typeof row.gateSignal !== "boolean" && row.gateSignal !== null) throw new Error("invalid_gate_signal");
    if (!Number.isSafeInteger(row.prefixBytes) || row.prefixBytes < 0 || row.prefixBytes > 256 * 1024)
      throw new Error("invalid_prefix_bytes");
    if (row.extractMs !== null && (!Number.isFinite(row.extractMs) || row.extractMs < 0 || row.extractMs > 5000))
      throw new Error("invalid_extract_time");
    if (fetch === "http_2xx_html" && !["allowed", "not_found"].includes(robots))
      throw new Error("robots_policy_violation");
    const eligible = fetch === "http_2xx_html" && ["allowed", "not_found"].includes(robots);
    if (eligible !== (extraction !== "not_attempted")) throw new Error("eligible_extraction_mismatch");
    if (extraction === "accepted_proxy" && proxy !== "accepted_proxy") throw new Error("proxy_status_mismatch");
    if (["empty", "oversize", "too_short", "quality_rejected"].includes(extraction) && proxy !== extraction)
      throw new Error("proxy_status_mismatch");
    if (["not_attempted", "timeout", "error"].includes(extraction) && proxy !== "not_scored")
      throw new Error("proxy_status_mismatch");

    cell.candidate[candidate] += 1;
    cell.robots[robots] += 1;
    cell.fetch[fetch] += 1;
    if (eligible) cell.eligible2xxHtml += 1;
    if (row.gateSignal === true) cell.gateSignal.positive += 1;
    else if (row.gateSignal === false) cell.gateSignal.clear += 1;
    else cell.gateSignal.unavailable += 1;
    cell.extraction[extraction] += 1;
    cell.proxy[proxy] += 1;
    incrementComparison(cell, row.gateSignal, extraction);
    cell.extractionTimingBins[timingBin(row.extractMs)] += 1;
    cell.prefixSizeBins[prefixBin(row.prefixBytes)] += 1;
  }
  for (const cell of cells.values()) {
    if (cell.plannedRows !== 10) throw new Error("each_cell_must_contain_10_rows");
  }
  return {
    schemaVersion: "issue22-iteration7-aggregate-v1",
    proxyDefinition: "implemented_optimistic_structural_proxy_without_navigation_ratio",
    denominator: 100,
    cells: [...cells.values()],
  };
}

export function allowedAggregateFields() {
  return new Set(["schemaVersion", "proxyDefinition", "denominator", "cells", "cellId", "plannedRows",
    "candidate", "resolved", "not_resolved", "robots", ...ROBOTS_CLASSES, "fetch", ...FETCH_CLASSES,
    "eligible2xxHtml", "gateSignal", "positive", "clear", "unavailable", "extraction", ...EXTRACTION_CLASSES,
    "proxy", "not_scored", ...PROXY_CLASSES, "gateProxyComparison", "gate_positive_accepted_proxy",
    "gate_positive_scored_not_accepted", "gate_positive_timeout_error_or_not_scored", "gate_clear_accepted_proxy",
    "gate_clear_scored_not_accepted", "gate_clear_timeout_error_or_not_scored", "gate_unavailable",
    "extractionTimingBins", "lt_500ms", "500ms_to_lt_1s", "1s_to_lt_2s", "2s_to_lt_5s", "gte_5s",
    "prefixSizeBins", "lt_16KiB", "16_to_lt_64KiB", "64_to_lt_128KiB", "128_to_lt_256KiB", "256KiB_cap"]);
}

export function cellIds() {
  return [...CELLS];
}
