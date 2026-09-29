import { aggregateRows, allowedAggregateFields, cellIds } from "./aggregate.mjs";

const EXTRACTION_CLASSES = new Set(["not_attempted", "timeout", "error", "empty", "oversize", "too_short", "quality_rejected", "accepted_proxy"]);
const PROXY_CLASSES = new Set(["not_scored", "empty", "oversize", "too_short", "quality_rejected", "accepted_proxy", "error"]);

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
  if (["no_response", "timeout", "network_error", "row_probe_error"].includes(outcome.accessStatus))
    return "transport_error";
  if (["disallowed", "unavailable", "truncated_unknown"].includes(robots)) return "not_attempted";
  if (Number.isInteger(outcome.httpStatus) || String(outcome.accessStatus ?? "").startsWith("http_")) return "http_other";
  if (["unsafe_destination", "redirect_limit"].includes(outcome.accessStatus)) return "not_attempted";
  return "not_attempted";
}

export function observationsFromProbe(rows, resolutions, checkedRows) {
  if (!Array.isArray(rows) || rows.length !== 100 || resolutions.length !== 100)
    throw new Error("probe_cohort_incomplete");
  const byRowId = new Map(checkedRows.map((row) => [row.rowId, row]));
  return rows.map((row, index) => {
    const resolution = resolutions[index];
    const hasCandidate = !!resolution?.candidateUrl;
    const outcome = byRowId.get(row.rowId) ?? null;
    const robots = robotsClass(outcome, hasCandidate);
    const fetch = fetchClass(outcome, hasCandidate, robots);
    const eligible = fetch === "http_2xx_html" && ["allowed", "not_found"].includes(robots);
    const extraction = eligible ? outcome?.extraction?.status ?? "error" : "not_attempted";
    const extractionClass = EXTRACTION_CLASSES.has(extraction) ? extraction : "error";
    const proxy = eligible && PROXY_CLASSES.has(extractionClass) && !["timeout", "error"].includes(extractionClass)
      ? extractionClass
      : "not_scored";
    return {
      cellId: row.cell,
      candidateClass: hasCandidate ? "resolved" : "not_resolved",
      robotsClass: robots,
      fetchClass: fetch,
      gateSignal: eligible ? !!outcome?.challengeLike : null,
      extractionClass,
      proxyClass: proxy,
      prefixBytes: eligible ? outcome?.responseBytes ?? 0 : 0,
      extractMs: eligible ? outcome?.extraction?.extractMs ?? 5000 : null,
    };
  });
}

function validateAggregateOnly(payload) {
  const allowList = allowedAggregateFields();
  const validCells = new Set(cellIds());
  function visit(value, key = "") {
    if (Array.isArray(value)) return value.forEach((item) => visit(item));
    if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) {
        if (!allowList.has(childKey)) throw new Error("aggregate_field_not_allowlisted");
        visit(child, childKey);
      }
      return;
    }
    if (typeof value === "string") {
      if (key === "cellId" && validCells.has(value)) return;
      if (key === "schemaVersion" && value === "issue22-iteration7-aggregate-v2") return;
      if (key === "proxyDefinition" && value === "implemented_optimistic_structural_proxy_without_navigation_ratio") return;
      throw new Error("aggregate_string_value_not_allowlisted");
    }
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new Error("aggregate_value_not_safe_count");
  }
  visit(payload);
  if (payload.denominator !== 100 || payload.cells.length !== 10) throw new Error("aggregate_shape_invalid");
}

export async function persistAggregateOnly(observations, feeds, pushData) {
  const aggregate = aggregateRows(observations, feeds);
  validateAggregateOnly(aggregate);
  await pushData(aggregate);
  return aggregate;
}
