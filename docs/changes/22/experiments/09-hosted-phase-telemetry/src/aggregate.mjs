export const CELLS = ["q1-gb", "q1-us", "q2-gb", "q2-us", "q3-gb", "q3-us", "q4-gb", "q4-us", "q5-gb", "q5-us"];
const CANDIDATE_CLASSES = ["resolved", "not_resolved"];
const ROBOTS_CLASSES = ["allowed", "not_found", "disallowed", "unavailable", "truncated_unknown", "not_checked"];
const FETCH_CLASSES = ["http_2xx_html", "http_other", "transport_error", "not_attempted"];
const ELIGIBLE_OUTCOMES = ["accepted_proxy", "quality_rejected", "empty", "oversize", "too_short", "timeout", "network_attempt", "worker_error", "worker_exit_error", "worker_exit_timeout", "message_error", "protocol_error"];
const TERMINAL_PHASES = ["not_attempted", "startup", "import", "extract", "result_delivery", "worker_exit", "protocol"];
const PHASES = ["startup", "import", "extract", "resultDelivery", "workerExit"];
const TIMING_BINS = ["lt_100ms", "100_to_lt_500ms", "500ms_to_lt_1s", "1s_to_lt_2s", "2s_to_lt_5s", "unavailable"];
const PREFIX_BINS = ["lt_16KiB", "16_to_lt_64KiB", "64_to_lt_128KiB", "128_to_lt_256KiB", "256KiB_cap", "unavailable"];

function oneOf(value, choices, field) {
  if (!choices.includes(value)) throw new Error(`invalid_${field}`);
  return value;
}
function counts(keys) { return Object.fromEntries(keys.map((key) => [key, 0])); }
function timingBin(value) {
  if (!Number.isFinite(value) || value < 0 || value >= 5000) return "unavailable";
  if (value < 100) return "lt_100ms";
  if (value < 500) return "100_to_lt_500ms";
  if (value < 1000) return "500ms_to_lt_1s";
  if (value < 2000) return "1s_to_lt_2s";
  return "2s_to_lt_5s";
}
function prefixBin(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 262144) return "unavailable";
  if (value < 16384) return "lt_16KiB";
  if (value < 65536) return "16_to_lt_64KiB";
  if (value < 131072) return "64_to_lt_128KiB";
  if (value < 262144) return "128_to_lt_256KiB";
  return "256KiB_cap";
}
function newCell(cellId) {
  const timing = () => counts(TIMING_BINS);
  const outcomeCounts = () => counts(["not_attempted", ...ELIGIBLE_OUTCOMES]);
  return {
    cellId,
    plannedRows: 0,
    candidate: counts(CANDIDATE_CLASSES),
    robots: counts(ROBOTS_CLASSES),
    fetch: counts(FETCH_CLASSES),
    eligibleRows: 0,
    gateSignal: { positive: 0, clear: 0, unavailable: 0 },
    gateOutcome: { gate_positive: outcomeCounts(), gate_clear: outcomeCounts(), gate_unavailable: outcomeCounts() },
    prefixSizeBins: counts(PREFIX_BINS),
    terminalPhase: counts(TERMINAL_PHASES),
    outcome: outcomeCounts(),
    phaseTimingBins: Object.fromEntries(PHASES.map((phase) => [phase, timing()])),
  };
}

export function aggregatePhaseRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 100) throw new Error("cohort_must_contain_100_rows");
  const cells = new Map(CELLS.map((cell) => [cell, newCell(cell)]));
  for (const row of rows) {
    const expectedRowKeys = ["cellId", "candidateClass", "robotsClass", "fetchClass", "eligible", "gateSignal", "terminalPhase", "outcome", "prefixBytes", "timing"];
    if (!row || Object.keys(row).sort().join("|") !== expectedRowKeys.sort().join("|"))
      throw new Error("observation_field_not_allowlisted");
    const cell = cells.get(row?.cellId);
    if (!cell) throw new Error("invalid_cell_id");
    cell.plannedRows += 1;
    const candidate = oneOf(row.candidateClass, CANDIDATE_CLASSES, "candidate_class");
    const robots = oneOf(row.robotsClass, ROBOTS_CLASSES, "robots_class");
    const fetch = oneOf(row.fetchClass, FETCH_CLASSES, "fetch_class");
    cell.candidate[candidate] += 1;
    cell.robots[robots] += 1;
    cell.fetch[fetch] += 1;
    const eligible = fetch === "http_2xx_html" && ["allowed", "not_found"].includes(robots);
    if (row.eligible !== eligible) throw new Error("eligibility_mismatch");

    if (!eligible) {
      if (row.terminalPhase !== "not_attempted" || row.outcome !== "not_attempted" || row.prefixBytes !== 0 ||
          row.gateSignal !== null ||
          !row.timing || PHASES.some((phase) => row.timing[phase] !== null))
        throw new Error("ineligible_row_has_worker_result");
      cell.terminalPhase.not_attempted += 1;
      cell.outcome.not_attempted += 1;
      continue;
    }

    cell.eligibleRows += 1;
    if (row.gateSignal !== true && row.gateSignal !== false && row.gateSignal !== null)
      throw new Error("invalid_gate_signal");
    if (row.gateSignal === true) cell.gateSignal.positive += 1;
    else if (row.gateSignal === false) cell.gateSignal.clear += 1;
    else cell.gateSignal.unavailable += 1;
    const terminalPhase = oneOf(row.terminalPhase, TERMINAL_PHASES.filter((phase) => phase !== "not_attempted"), "terminal_phase");
    const outcome = oneOf(row.outcome, ELIGIBLE_OUTCOMES, "outcome");
    if (!Number.isSafeInteger(row.prefixBytes) || row.prefixBytes < 0 || row.prefixBytes > 262144)
      throw new Error("invalid_prefix_size");
    cell.prefixSizeBins[prefixBin(row.prefixBytes)] += 1;
    cell.terminalPhase[terminalPhase] += 1;
    cell.outcome[outcome] += 1;
    const gateKey = row.gateSignal === true ? "gate_positive" : row.gateSignal === false ? "gate_clear" : "gate_unavailable";
    cell.gateOutcome[gateKey][outcome] += 1;
      if (!row.timing || typeof row.timing !== "object" ||
          Object.keys(row.timing).sort().join("|") !== [...PHASES].sort().join("|") || PHASES.some((phase) =>
      row.timing[phase] !== null && (!Number.isFinite(row.timing[phase]) || row.timing[phase] < 0 || row.timing[phase] >= 5000)))
      throw new Error("invalid_phase_timing");
    for (const phase of PHASES) cell.phaseTimingBins[phase][timingBin(row.timing[phase])] += 1;
  }

  for (const cell of cells.values()) {
    if (cell.plannedRows !== 10 || cell.fetch.http_2xx_html + cell.fetch.http_other + cell.fetch.transport_error + cell.fetch.not_attempted !== 10)
      throw new Error("cell_reconciliation_failed");
    const terminalTotal = Object.values(cell.terminalPhase).reduce((sum, value) => sum + value, 0);
    const outcomeTotal = Object.values(cell.outcome).reduce((sum, value) => sum + value, 0);
    if (terminalTotal !== 10 || outcomeTotal !== 10 || terminalTotal !== cell.plannedRows ||
        cell.eligibleRows !== 10 - cell.terminalPhase.not_attempted)
      throw new Error("terminal_reconciliation_failed");
    if (Object.values(cell.gateSignal).reduce((sum, value) => sum + value, 0) !== cell.eligibleRows)
      throw new Error("gate_reconciliation_failed");
    const expectedGateTotals = {
      gate_positive: cell.gateSignal.positive,
      gate_clear: cell.gateSignal.clear,
      gate_unavailable: cell.gateSignal.unavailable,
    };
    for (const [key, countsByOutcome] of Object.entries(cell.gateOutcome))
      if (Object.values(countsByOutcome).reduce((sum, value) => sum + value, 0) !== expectedGateTotals[key])
        throw new Error("gate_reconciliation_failed");
    for (const bins of Object.values(cell.phaseTimingBins))
      if (Object.values(bins).reduce((sum, value) => sum + value, 0) !== cell.eligibleRows)
        throw new Error("timing_reconciliation_failed");
  }
  return { schemaVersion: "issue22-iteration9-phase-aggregate-v1", denominator: 100, eligibleRows: [...cells.values()].reduce((sum, cell) => sum + cell.eligibleRows, 0), cells: [...cells.values()] };
}

export function validateAggregateOnly(payload) {
  const allowed = new Set([
    "schemaVersion", "denominator", "eligibleRows", "cells", "cellId", "plannedRows", "candidate", "resolved", "not_resolved",
    "robots", "allowed", "not_found", "disallowed", "unavailable", "truncated_unknown", "not_checked", "fetch", "http_2xx_html",
    "http_other", "transport_error", "not_attempted", "eligibleRows", "prefixSizeBins", ...PREFIX_BINS,
    "gateSignal", "positive", "clear", "gateOutcome", "gate_positive", "gate_clear", "gate_unavailable",
    "terminalPhase", ...TERMINAL_PHASES, "outcome", ...ELIGIBLE_OUTCOMES, "phaseTimingBins", "startup", "import", "extract",
    "resultDelivery", "workerExit", ...TIMING_BINS,
  ]);
  const strings = new Set(["issue22-iteration9-phase-aggregate-v1", ...CELLS, ...CANDIDATE_CLASSES, ...ROBOTS_CLASSES,
    ...FETCH_CLASSES, ...ELIGIBLE_OUTCOMES, ...TERMINAL_PHASES, ...PHASES, ...TIMING_BINS, ...PREFIX_BINS]);
  function visit(value, key = "") {
    if (Array.isArray(value)) return value.forEach((item) => visit(item));
    if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) {
        if (!allowed.has(childKey)) throw new Error("aggregate_field_not_allowlisted");
        visit(child, childKey);
      }
    } else if (typeof value === "string") {
      if (!strings.has(value)) throw new Error("aggregate_string_not_allowlisted");
    } else if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("aggregate_count_invalid");
    }
  }
  visit(payload);
  if (payload?.schemaVersion !== "issue22-iteration9-phase-aggregate-v1" || payload.denominator !== 100 ||
      payload.cells?.length !== 10 || payload.eligibleRows !== payload.cells.reduce((sum, cell) => sum + cell.eligibleRows, 0))
    throw new Error("aggregate_shape_invalid");
  return true;
}
