import assert from "node:assert/strict";
import { createServer } from "node:http";
import { processRows } from "./parent.mjs";
import { CHILD_DEADLINE_MS, CHILD_KILL_CONFIRM_MS } from "./parent.mjs";

const articleText = Array.from({ length: 45 }, (_, index) =>
  `The controlled local article contains a stable readable sentence ${index + 1}.`,
).join(" ");
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><head><title>Local I1 article</title></head><body><article><h1>Controlled local article</h1><p>${articleText}</p></article></body></html>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const now = () => new Date().toISOString();
const rows = [
  { rowId: "i1-hang", googleNewsUrl: "https://news.google.com/articles/i1-hang", publisherUrl: "http://127.0.0.1/never-requested", urlResolved: true },
  { rowId: "i1-success", googleNewsUrl: "https://news.google.com/articles/i1-success", publisherUrl: `http://127.0.0.1:${port}/article`, urlResolved: true },
  { rowId: "i1-error", googleNewsUrl: "https://news.google.com/articles/i1-error", publisherUrl: `http://127.0.0.1:${port}/error`, urlResolved: true },
];
const written = [];
const startedAt = Date.now();
console.log(JSON.stringify({ event: "i1_start", at: now(), nodeVersion: process.version, deadlineMs: CHILD_DEADLINE_MS, killConfirmMs: CHILD_KILL_CONFIRM_MS, cases: rows.map((row) => row.rowId) }));
let result;
try {
  result = await processRows(rows, {
    concurrency: 1,
    controlForRow: (row) => row.rowId === "i1-hang" ? "hang" : row.rowId === "i1-error" ? "error" : undefined,
    writeOutcome: async (outcome) => { written.push(outcome); },
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}
const elapsedMs = Date.now() - startedAt;
const byId = Object.fromEntries(result.outcomes.map((outcome) => [outcome.rowId, outcome]));
const evidenceById = Object.fromEntries(rows.map((row, index) => [row.rowId, result.processEvidence[index]]));
assert.equal(written.length, 3, "parent writes one outcome for each row");
assert.equal(byId["i1-hang"].publisherFetchStatus, "child_timeout");
assert.equal(byId["i1-hang"].childReaped, true);
assert.ok(evidenceById["i1-hang"].elapsedMs >= CHILD_DEADLINE_MS - 200, "deadline starts near the 12-second maximum");
assert.ok(evidenceById["i1-hang"].elapsedMs <= CHILD_DEADLINE_MS, "kill is requested within the 12-second wall-clock maximum");
assert.ok(evidenceById["i1-hang"].killToExitMs <= CHILD_KILL_CONFIRM_MS, "killed child exited within the confirmation window");
assert.equal(byId["i1-success"].publisherFetchStatus, "eligible_html");
assert.equal(byId["i1-success"].fullTextStatus, "success");
assert.ok(byId["i1-success"].wordCount >= 50, "local article text was extracted by the child");
assert.equal(evidenceById["i1-success"].childReaped, true);
assert.equal(byId["i1-error"].publisherFetchStatus, "child_error");
assert.equal(byId["i1-error"].errorCode, "I1_CONTROLLED_ERROR");
assert.equal(evidenceById["i1-error"].childReaped, true);
console.log(JSON.stringify({
  event: "i1_result",
  at: now(),
  elapsedMs,
  expectedWallClockBoundMs: CHILD_DEADLINE_MS + CHILD_KILL_CONFIRM_MS,
  parentExitedNormally: true,
  rowsWritten: written.length,
  outcomes: result.outcomes.map((outcome) => ({ rowId: outcome.rowId, status: outcome.publisherFetchStatus, fullTextStatus: outcome.fullTextStatus, wordCount: outcome.wordCount ?? 0 })),
  processes: rows.map((row) => ({ rowId: row.rowId, ...evidenceById[row.rowId] })),
}));
