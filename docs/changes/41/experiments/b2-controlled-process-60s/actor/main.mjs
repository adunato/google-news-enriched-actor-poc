import { Actor } from "apify";
import { mapWithConcurrency, runRowInChild } from "./parent.mjs";

const MAX_ROWS = 100;
const CONCURRENCY = 2;
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
      input.rows.length < 1 || input.rows.length > MAX_ROWS || input.rows.some((row) => !validRow(row)) ||
      input.rowCount !== input.rows.length || input.uniqueRowIds !== new Set(input.rows.map((row) => row.rowId)).size) {
    throw Object.assign(new Error("Input does not match the bounded sample contract"), { code: "INVALID_INPUT" });
  }
  const ids = input.rows.map((row) => row.rowId);
  if (new Set(ids).size !== ids.length ||
      (input.sampleId === "smoke" && JSON.stringify(ids) !== JSON.stringify(EXPECTED_SMOKE_ROWS)) ||
      (input.sampleId === "acceptance" && input.rows.length !== MAX_ROWS)) {
    throw Object.assign(new Error("Input rows must be unique resolved publisher records"), { code: "INVALID_ROWS" });
  }

  console.log(`ISSUE41_B2_CONTROLLED stage=run_start sample=${input.sampleId} rows=${input.rows.length} concurrency=${CONCURRENCY} nodeVersion=${process.version} undiciVersion=${process.versions.undici ?? "unknown"}`);
  let writeFailures = 0;
  const outcomes = await mapWithConcurrency(input.rows, CONCURRENCY, async (row) => {
    const child = await runRowInChild(row, input.sampleId);
    let outcome;
    if (child.status === "success") {
      outcome = {
        evidenceType: "issue41_b2_controlled_process_row",
        ...child.result,
        childPid: child.pid,
        childReaped: child.reaped,
        processTiming: child.timing,
      };
    } else {
      outcome = {
        evidenceType: "issue41_b2_controlled_process_row",
        ...row,
        rowId: row.rowId,
        publisherFetchStatus: child.status,
        fullTextStatus: "not_attempted_child_failure",
        processErrorClass: child.errorClass,
        childPid: child.pid,
        childReaped: child.reaped,
        processTiming: child.timing,
      };
    }
    try {
      await Actor.pushData(outcome);
    } catch (error) {
      writeFailures += 1;
      console.error(`ISSUE41_B2_CONTROLLED stage=row_write_failed rowId=${row.rowId} errorClass=${error instanceof Error ? error.name : "UnknownError"}`);
    }
    return outcome;
  });
  const counts = {};
  for (const outcome of outcomes) counts[outcome.publisherFetchStatus] = (counts[outcome.publisherFetchStatus] || 0) + 1;
  console.log(`ISSUE41_B2_CONTROLLED stage=run_summary inputRows=${input.rows.length} rowsWritten=${outcomes.length - writeFailures} writeFailures=${writeFailures} fetchCounts=${JSON.stringify(counts)}`);
  if (writeFailures > 0 || outcomes.some((outcome) => outcome.childReaped !== true)) exitCode = 1;
} catch (error) {
  console.error(`ISSUE41_B2_CONTROLLED stage=run_failure errorClass=${error instanceof Error ? error.name : "UnknownError"} errorCode=${error?.code || "none"}`);
  exitCode = 1;
} finally {
  await Actor.exit({ exitCode });
}
