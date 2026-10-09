/* global process */
import { Actor } from "apify";
import { processRows } from "./parent.mjs";

const MAX_ROWS = 100;
const MAX_CONCURRENCY = 2;
const EXPECTED_SMOKE_ROWS = ["q1-gb-01", "q1-gb-02", "q1-gb-05"];

function validRow(row) {
  return row &&
    typeof row.rowId === "string" && /^[a-z0-9-]{1,32}$/iu.test(row.rowId) &&
    typeof row.googleNewsUrl === "string" && row.googleNewsUrl.length > 0 &&
    typeof row.publisherUrl === "string" && row.publisherUrl.length > 0 &&
    row.urlResolved === true;
}

await Actor.init();
let exitCode = 0;
try {
  const input = await Actor.getInput();
  if (!input || !["smoke", "acceptance"].includes(input.sampleId) || !Array.isArray(input.rows) ||
      input.rows.length < 1 || input.rows.length > MAX_ROWS || input.rows.some((row) => !validRow(row))) {
    throw Object.assign(new Error("Input does not match the bounded sample contract"), { code: "INVALID_INPUT" });
  }
  const rowIds = input.rows.map((row) => row.rowId);
  if (new Set(rowIds).size !== rowIds.length || input.rowCount !== input.rows.length || input.uniqueRowIds !== rowIds.length) {
    throw Object.assign(new Error("Input row identifiers must be unique and complete"), { code: "INVALID_ROWS" });
  }
  const synthetic = input.rows.filter((row) => row.synthetic === true);
  const realSmokeRows = input.rows.filter((row) => row.synthetic !== true);
  if (input.sampleId === "smoke" && (
    input.rows.length !== (input.includeSyntheticHang === true ? 4 : 3) ||
    synthetic.length !== (input.includeSyntheticHang === true ? 1 : 0) ||
    JSON.stringify(realSmokeRows.map((row) => row.rowId)) !== JSON.stringify(EXPECTED_SMOKE_ROWS) ||
    (input.includeSyntheticHang === true && !synthetic.every((row) =>
      row.rowId === "i2-synthetic-hang" && row.control === "hang" && row.publisherUrl.startsWith("https://example.invalid/")))
  )) {
    throw Object.assign(new Error("Smoke input must contain the approved real rows and optional labelled hang control"), { code: "INVALID_SMOKE_ROWS" });
  }
  if (input.sampleId === "acceptance" && (input.rows.length !== MAX_ROWS || synthetic.length !== 0)) {
    throw Object.assign(new Error("Acceptance input must contain exactly 100 real rows"), { code: "INVALID_ACCEPTANCE_ROWS" });
  }

  console.log(`ISSUE41_B2_I stage=run_start sample=${input.sampleId} rows=${input.rows.length} nodeVersion=${process.version} undiciVersion=${process.versions.undici ?? "unknown"} concurrency=${MAX_CONCURRENCY}`);
  const { outcomes } = await processRows(input.rows, {
    concurrency: MAX_CONCURRENCY,
    controlForRow: (row) => row.synthetic === true ? row.control : undefined,
    writeOutcome: (outcome) => Actor.pushData({ evidenceType: "issue41_b2_process_isolation", ...outcome }),
  });
  const counts = {};
  for (const outcome of outcomes) counts[outcome.publisherFetchStatus] = (counts[outcome.publisherFetchStatus] || 0) + 1;
  console.log(`ISSUE41_B2_I stage=run_summary inputRows=${input.rows.length} rowsWritten=${outcomes.length} fetchCounts=${JSON.stringify(counts)}`);
  if (outcomes.length !== input.rows.length) exitCode = 1;
} catch (error) {
  const errorClass = error instanceof Error ? error.name : "UnknownError";
  const errorCode = error && typeof error.code === "string" ? error.code : "none";
  console.error(`ISSUE41_B2_I stage=run_failure errorClass=${errorClass} errorCode=${errorCode}`);
  exitCode = 1;
} finally {
  await Actor.exit({ exitCode });
}
