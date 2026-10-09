import assert from "node:assert/strict";
import { processRows, isValidWorkerResult, MAX_IPC_BYTES } from "../actor/parent.mjs";

const validResult = {
  fetchStatus: "eligible_html",
  fullTextStatus: "success",
  requestCount: 1,
  redirectCount: 0,
  wordCount: 12,
  articleText: "A valid child article result.",
  httpStatus: 200,
  contentType: "text/html; charset=utf-8",
  finalUrl: "https://publisher.example/article",
  fetchElapsedMs: 1,
};
assert.equal(isValidWorkerResult(validResult), true);
assert.equal(isValidWorkerResult({ ...validResult, fetchStatus: "unknown_status" }), false);
assert.equal(isValidWorkerResult({ ...validResult, requestCount: 7 }), false);
assert.equal(isValidWorkerResult({ ...validResult, fullTextStatus: "success", articleText: "", wordCount: 0 }), false);
assert.equal(isValidWorkerResult({ ...validResult, body: "raw HTML must not cross IPC" }), false);
assert.equal(isValidWorkerResult({ ...validResult, articleText: "x".repeat(MAX_IPC_BYTES) }), false);
assert.equal(isValidWorkerResult({ fullTextStatus: "success", wordCount: "12" }), false);

const rows = [1, 2, 3].map((index) => ({
  rowId: `i2-ipc-send-error-${index}`,
  googleNewsUrl: `https://news.google.com/articles/i2-ipc-send-error-${index}`,
  publisherUrl: "https://example.invalid/i2-no-request",
  urlResolved: true,
}));
const startedAt = Date.now();
const sendError = Object.assign(new Error("Controlled IPC send callback error"), {
  code: "CONTROLLED_SEND_ERROR",
});
let activeChildren = 0;
let maxActiveChildren = 0;
const result = await processRows(rows, {
  concurrency: 2,
  sendMessage: (child, _message, callback) => {
    activeChildren += 1;
    maxActiveChildren = Math.max(maxActiveChildren, activeChildren);
    child.once("exit", () => { activeChildren -= 1; });
    setTimeout(() => callback(sendError), 75);
    return false;
  },
});
const elapsedMs = Date.now() - startedAt;
assert.equal(result.outcomes.length, 3);
assert.ok(result.outcomes.every((outcome) => outcome.publisherFetchStatus === "ipc_error"));
assert.ok(result.outcomes.every((outcome) => outcome.errorCode === "CONTROLLED_SEND_ERROR"));
assert.ok(result.outcomes.every((outcome) => outcome.childReaped === true));
assert.ok(result.processEvidence.every((evidence) => evidence.signalCode === "SIGKILL"));
assert.ok(result.processEvidence.every((evidence) => evidence.childReaped === true));
assert.ok(result.processEvidence.every((evidence) => evidence.elapsedMs >= 75), "parent must wait through each delayed IPC send error");
assert.ok(result.processEvidence.every((evidence) => evidence.killToExitMs <= 2_000), "each failed-IPC child must be confirmed exited within the TID window");
assert.equal(activeChildren, 0);
assert.equal(maxActiveChildren, 2, "the worker pool fills both slots but does not start a replacement before child exit");
console.log(JSON.stringify({
  event: "i2_prebuild_controls_passed",
  nodeVersion: process.version,
  malformedResultCasesRejected: 6,
  sendErrorCases: result.processEvidence.map((evidence, index) => ({
    rowId: rows[index].rowId,
    outcome: result.outcomes[index].publisherFetchStatus,
    childPid: evidence.childPid,
    signalCode: evidence.signalCode,
    childReaped: evidence.childReaped,
    childElapsedMs: evidence.elapsedMs,
    killToExitMs: evidence.killToExitMs,
  })),
  maxActiveChildren,
  activeChildrenAfterCompletion: activeChildren,
  testElapsedMs: elapsedMs,
}));
