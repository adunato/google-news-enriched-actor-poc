import { aggregatePhaseRows, validateAggregateOnly } from "./aggregate.mjs";

const ELIGIBLE_OUTCOMES = new Set(["accepted_proxy", "quality_rejected", "empty", "oversize", "too_short", "timeout", "network_attempt", "worker_error", "worker_exit_error", "worker_exit_timeout", "message_error", "protocol_error"]);
const TERMINAL_PHASES = new Set(["startup", "import", "extract", "result_delivery", "worker_exit", "protocol"]);

export function feedOutcomesFromDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length !== 10) throw new Error("feed_matrix_incomplete");
  return diagnostics.map((item) => ({
    cellId: item.cell,
    status: item.status >= 200 && item.status < 300 ? "http_2xx" : "http_other",
    responseBytes: item.feedBytes,
    itemCount: item.itemCount,
    retainedCount: item.retainedCount,
  }));
}

function robotsClass(outcome, hasCandidate) {
  if (!hasCandidate) return "not_checked";
  return new Set(["allowed", "not_found", "disallowed", "truncated_unknown"]).has(outcome?.robotsSignal)
    ? outcome.robotsSignal
    : outcome?.robotsSignal === "unavailable" ? "unavailable" : "not_checked";
}

function fetchClass(outcome, hasCandidate, robots) {
  if (!hasCandidate || !outcome) return "not_attempted";
  if (outcome.accessStatus === "http_2xx_html") return "http_2xx_html";
  if (["no_response", "timeout", "network_error", "row_probe_error"].includes(outcome.accessStatus)) return "transport_error";
  if (["disallowed", "unavailable", "truncated_unknown"].includes(robots)) return "not_attempted";
  if (Number.isInteger(outcome.httpStatus) || String(outcome.accessStatus ?? "").startsWith("http_")) return "http_other";
  if (["unsafe_destination", "redirect_limit"].includes(outcome.accessStatus)) return "not_attempted";
  return "not_attempted";
}

export function observationsFromProbe(rows, resolutions, checkedRows) {
  if (!Array.isArray(rows) || rows.length !== 100 || !Array.isArray(resolutions) || resolutions.length !== 100)
    throw new Error("probe_cohort_incomplete");
  const rowIds = new Set(rows.map((row) => row?.rowId));
  if (rowIds.size !== 100 || rowIds.has(undefined) || checkedRows.some((row) => !rowIds.has(row.rowId)))
    throw new Error("probe_row_identity_inconsistent");
  const rowsPerCell = new Map();
  for (const row of rows) rowsPerCell.set(row.cell, (rowsPerCell.get(row.cell) ?? 0) + 1);
  if (rowsPerCell.size !== 10 || [...rowsPerCell.values()].some((count) => count !== 10))
    throw new Error("probe_cell_matrix_inconsistent");
  const byRowId = new Map(checkedRows.map((row) => [row.rowId, row]));
  if (byRowId.size !== checkedRows.length) throw new Error("duplicate_checked_row");
  return rows.map((row, index) => {
    const resolution = resolutions[index];
    const hasCandidate = !!resolution?.candidateUrl;
    const outcome = byRowId.get(row.rowId) ?? null;
    const robots = robotsClass(outcome, hasCandidate);
    const fetch = fetchClass(outcome, hasCandidate, robots);
    const eligible = fetch === "http_2xx_html" && ["allowed", "not_found"].includes(robots);
    const extraction = eligible ? outcome?.extraction : null;
    if (eligible && (!extraction || !ELIGIBLE_OUTCOMES.has(extraction.status) || !TERMINAL_PHASES.has(extraction.terminalPhase)))
      throw new Error("eligible_row_missing_terminal");
    if (!eligible && extraction) throw new Error("ineligible_row_has_extraction");
    const timing = extraction?.timing ?? { startupMs: null, importMs: null, extractMs: null, resultDeliveryMs: null, workerExitMs: null };
    return {
      cellId: row.cell,
      candidateClass: hasCandidate ? "resolved" : "not_resolved",
      robotsClass: robots,
      fetchClass: fetch,
      eligible,
      gateSignal: eligible && typeof outcome?.challengeLike === "boolean" ? outcome.challengeLike : null,
      terminalPhase: extraction?.terminalPhase ?? "not_attempted",
      outcome: extraction?.status ?? "not_attempted",
      prefixBytes: eligible ? outcome.responseBytes ?? 0 : 0,
      timing: {
        startup: timing.startupMs,
        import: timing.importMs,
        extract: timing.extractMs,
        resultDelivery: timing.resultDeliveryMs,
        workerExit: timing.workerExitMs,
      },
    };
  });
}

export async function persistAggregateOnly(observations, pushData) {
  const aggregate = aggregatePhaseRows(observations);
  validateAggregateOnly(aggregate);
  await pushData(aggregate);
  return aggregate;
}
