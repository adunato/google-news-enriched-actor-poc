export const CELLS = Object.freeze(["q1-gb", "q1-us", "q2-gb", "q2-us", "q3-gb", "q3-us", "q4-gb", "q4-us", "q5-gb", "q5-us"]);
const CANDIDATE = ["resolved", "unresolved", "not_returned", "duplicate"];
const ROBOTS = ["allowed", "not_found", "disallowed", "unavailable", "not_checked"];
const FETCH = ["http_2xx_html", "http_other", "transport_error", "not_attempted"];
const READABILITY = ["success", "empty", "timeout", "dom_limit", "output_limit", "worker_error", "network_attempt", "protocol_error", "not_attempted"];
const STRUCTURED = ["present", "empty", "cap", "error", "not_scored", "not_attempted", "unavailable"];
const OVERLAP = ["both", "readability_only", "structured_only", "neither", "not_eligible"];
const PREFIX = ["capped", "not_capped", "unavailable"];
const ELAPSED = ["lt_100ms", "100_to_lt_500ms", "500ms_to_lt_1s", "1s_to_lt_2s", "2s_to_lt_5s", "5s_to_lt_10s", "10s_to_lt_30s", "30s_or_more", "unavailable"];
const DOM = ["lt_1k", "1k_to_lt_5k", "5k_to_lt_10k", "10k_cap", "unavailable"];
const WORKER_TIME = ["lt_100ms", "100_to_lt_500ms", "500ms_to_lt_1s", "1s_to_lt_2s", "2s_to_lt_5s", "at_deadline", "unavailable"];
const exact = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join("|") === [...keys].sort().join("|");
const count = (names) => Object.fromEntries(names.map((name) => [name, 0]));

export function buildAggregate(rows) {
  if (!Array.isArray(rows) || rows.length !== 100) throw new Error("planned_cohort_must_be_100");
  const perCell = new Map(CELLS.map((cellId) => [cellId, { cellId, plannedSlots: 10, returnedRows: 0, duplicateRows: 0, uniqueRows: 0, eligibleRows: 0, candidate: count(CANDIDATE), robots: count(ROBOTS), fetch: count(FETCH), readability: count(READABILITY), structured: count(STRUCTURED), overlap: count(OVERLAP), prefix: count(PREFIX), elapsed: count(ELAPSED), dom: count(DOM), workerTime: count(WORKER_TIME) }]));
  const seenSlot = new Set();
  for (const row of rows) {
    const keys = ["cellId", "slot", "candidate", "robots", "fetch", "readability", "structured", "prefix", "elapsed", "dom", "workerTime"];
    if (!exact(row, keys)) throw new Error("observation_field_not_allowlisted");
    const cell = perCell.get(row.cellId);
    if (!cell || !Number.isSafeInteger(row.slot) || row.slot < 1 || row.slot > 10 || seenSlot.has(`${row.cellId}:${row.slot}`)) throw new Error("invalid_or_duplicate_slot");
    seenSlot.add(`${row.cellId}:${row.slot}`);
    for (const [value, allowed, field] of [[row.candidate, CANDIDATE, "candidate"], [row.robots, ROBOTS, "robots"], [row.fetch, FETCH, "fetch"], [row.readability, READABILITY, "readability"], [row.structured, STRUCTURED, "structured"], [row.prefix, PREFIX, "prefix"], [row.elapsed, ELAPSED, "elapsed"], [row.dom, DOM, "dom"], [row.workerTime, WORKER_TIME, "worker_time"]])
      if (!allowed.includes(value)) throw new Error(`invalid_${field}_status`);
    if ((row.candidate === "not_returned" || row.candidate === "duplicate") && (row.robots !== "not_checked" || row.fetch !== "not_attempted" || row.readability !== "not_attempted" || row.structured !== "not_attempted" || row.prefix !== "unavailable" || row.dom !== "unavailable")) throw new Error("missing_or_duplicate_row_has_downstream_observation");
    const eligible = row.fetch === "http_2xx_html" && ["allowed", "not_found"].includes(row.robots);
    if (row.readability === "success" && !eligible) throw new Error("readability_success_without_eligible_publisher_evidence");
    cell.candidate[row.candidate]++;
    if (row.candidate !== "not_returned") cell.returnedRows++;
    if (row.candidate === "duplicate") cell.duplicateRows++;
    if (["resolved", "unresolved"].includes(row.candidate)) cell.uniqueRows++;
    cell.robots[row.robots]++; cell.fetch[row.fetch]++; cell.readability[row.readability]++; cell.structured[row.structured]++;
    cell.prefix[row.prefix]++; cell.elapsed[row.elapsed]++; cell.dom[row.dom]++;
    cell.workerTime[row.workerTime]++;
    if (eligible) cell.eligibleRows++;
    const isReadable = eligible && row.readability === "success";
    const hasStructured = eligible && row.structured === "present";
    cell.overlap[!eligible ? "not_eligible" : isReadable && hasStructured ? "both" : isReadable ? "readability_only" : hasStructured ? "structured_only" : "neither"]++;
  }
  const cells = [...perCell.values()];
  const totals = (key) => cells.reduce((n, cell) => n + cell[key], 0);
  const readabilitySuccesses = cells.reduce((n, cell) => n + cell.readability.success, 0);
  const aggregate = {
    schemaVersion: "issue22-iteration10-direct-readability-v1", plannedRows: 100,
    requestedRows: 100, returnedRows: totals("returnedRows"), duplicateRows: totals("duplicateRows"),
    uniqueRows: totals("uniqueRows"), eligibleRows: totals("eligibleRows"), readabilitySuccesses,
    decision: totals("uniqueRows") < 100 ? "inconclusive_short_cohort" : readabilitySuccesses >= 50 ? "signal_threshold_met" : "signal_threshold_not_met",
    cells,
  };
  validateAggregate(aggregate);
  return aggregate;
}

export function validateAggregate(value) {
  if (!exact(value, ["schemaVersion", "plannedRows", "requestedRows", "returnedRows", "duplicateRows", "uniqueRows", "eligibleRows", "readabilitySuccesses", "decision", "cells"]) || value.schemaVersion !== "issue22-iteration10-direct-readability-v1" || value.plannedRows !== 100 || value.requestedRows !== 100 || !["inconclusive_short_cohort", "signal_threshold_met", "signal_threshold_not_met"].includes(value.decision) || !Array.isArray(value.cells) || value.cells.length !== 10) throw new Error("invalid_aggregate_schema");
  const totals = { returnedRows: 0, duplicateRows: 0, uniqueRows: 0, eligibleRows: 0 };
  for (let i = 0; i < CELLS.length; i++) {
    const cell = value.cells[i];
    if (!exact(cell, ["cellId", "plannedSlots", "returnedRows", "duplicateRows", "uniqueRows", "eligibleRows", "candidate", "robots", "fetch", "readability", "structured", "overlap", "prefix", "elapsed", "dom", "workerTime"]) || cell.cellId !== CELLS[i] || cell.plannedSlots !== 10) throw new Error("invalid_cell_schema");
    for (const [key, allowed] of [["candidate", CANDIDATE], ["robots", ROBOTS], ["fetch", FETCH], ["readability", READABILITY], ["structured", STRUCTURED], ["overlap", OVERLAP], ["prefix", PREFIX], ["elapsed", ELAPSED], ["dom", DOM], ["workerTime", WORKER_TIME]]) {
      if (!exact(cell[key], allowed)) throw new Error("invalid_count_schema");
      for (const number of Object.values(cell[key])) if (!Number.isSafeInteger(number) || number < 0) throw new Error("invalid_count_value");
      if (Object.values(cell[key]).reduce((a, b) => a + b, 0) !== 10) throw new Error("cell_histogram_reconciliation_failed");
    }
    if (Object.values(cell.candidate).reduce((a, b) => a + b, 0) !== 10 || cell.returnedRows !== 10 - cell.candidate.not_returned || cell.duplicateRows !== cell.candidate.duplicate || cell.uniqueRows !== cell.candidate.resolved + cell.candidate.unresolved || cell.returnedRows !== cell.duplicateRows + cell.uniqueRows) throw new Error("cell_reconciliation_failed");
    if (cell.eligibleRows !== cell.overlap.both + cell.overlap.readability_only + cell.overlap.structured_only + cell.overlap.neither || cell.overlap.not_eligible !== 10 - cell.eligibleRows || cell.eligibleRows > cell.uniqueRows) throw new Error("eligible_overlap_reconciliation_failed");
    if (cell.readability.success !== cell.overlap.both + cell.overlap.readability_only || cell.structured.present !== cell.overlap.both + cell.overlap.structured_only) throw new Error("eligible_extraction_reconciliation_failed");
    for (const key of Object.keys(totals)) { if (!Number.isSafeInteger(cell[key]) || cell[key] < 0) throw new Error("invalid_total"); totals[key] += cell[key]; }
  }
  for (const [key, total] of Object.entries(totals)) if (value[key] !== total) throw new Error("aggregate_reconciliation_failed");
  const successes = value.cells.reduce((n, cell) => n + cell.readability.success, 0);
  if (!Number.isSafeInteger(value.readabilitySuccesses) || value.readabilitySuccesses !== successes) throw new Error("readability_success_reconciliation_failed");
  const expectedDecision = value.uniqueRows < 100 ? "inconclusive_short_cohort" : successes >= 50 ? "signal_threshold_met" : "signal_threshold_not_met";
  if (value.decision !== expectedDecision) throw new Error("decision_reconciliation_failed");
  const json = JSON.stringify(value);
  if (/https?:|<script|article text|forbidden sentinel/i.test(json)) throw new Error("aggregate_privacy_violation");
  return true;
}

export async function persistAggregateOnly(rows, sink) {
  const payload = buildAggregate(rows);
  validateAggregate(payload);
  await sink(payload);
  return payload;
}
