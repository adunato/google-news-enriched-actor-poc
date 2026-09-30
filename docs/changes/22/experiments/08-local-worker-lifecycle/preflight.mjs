import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { caseMatrix, createFixture } from "./fixtures.mjs";
import { CASE_DEADLINE_MS, executeCase } from "./run.mjs";

assert.equal(process.version, "v20.19.0", "node_20_19_required");
const lock = JSON.parse(await readFile(new URL("../07-hosted-eligibility/package-lock.json", import.meta.url), "utf8"));
assert.equal(lock.packages["node_modules/@extractus/article-extractor"].version, "9.0.1");
const matrix = caseMatrix();
assert.equal(matrix.length, 10);
assert.equal(new Set(matrix.map((item) => item.caseId)).size, 10);
for (const item of matrix) {
  const html = createFixture(item.shape, item.targetBytes);
  assert.equal(Buffer.byteLength(html, "utf8"), item.targetBytes);
  assert(item.targetBytes <= 256 * 1024);
}

const sentinel = "AUTHORED_PREVIEW_MUST_NOT_PERSIST";
function alphaWord(value) {
  let result = "";
  for (let i = 0; i < 7; i += 1) {
    result = String.fromCharCode(97 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return `word${result}`;
}
const fakeContent = `<p>${Array.from({ length: 60 }, (_, i) => alphaWord(i)).join(" ")} ${sentinel}</p>` +
  `<p>${Array.from({ length: 60 }, (_, i) => alphaWord(i + 100)).join(" ")}</p>`;
class FakeLifecycleWorker extends EventEmitter {
  constructor(_url, options) {
    super();
    this.workerData = options.workerData;
    queueMicrotask(() => {
      this.emit("message", { kind: "phase", phase: "worker_ready" });
      this.emit("message", { kind: "phase", phase: "import_complete", importMs: 1, networkAttempts: 0 });
      this.emit("message", { kind: "phase", phase: "extract_started" });
      this.emit("message", { kind: "phase", phase: "extract_complete", extractMs: 2, networkAttempts: 0 });
      this.emit("message", { kind: "result", content: fakeContent, outputChars: fakeContent.length, networkAttempts: 0 });
      setImmediate(() => this.emit("exit", 0));
    });
  }
  async terminate() { return 1; }
}

const sampleHtml = createFixture("semantic_article", 8 * 1024);
const success = await executeCase({
  caseId: "preflight-success",
  shape: "semantic_article",
  targetBytes: 8 * 1024,
  html: sampleHtml,
  deadlineMs: 250,
  WorkerClass: FakeLifecycleWorker,
});
assert.equal(success.status, "accepted_proxy");
assert.equal(success.exitClass, "normal");
assert.equal(success.importMs, 1);
assert.equal(success.extractMs, 2);
assert.equal(success.networkAttempts, 0);
assert(!JSON.stringify(success).includes(sentinel));
assert.equal(Object.hasOwn(success, "content"), false);

class NeverLifecycleWorker extends EventEmitter {
  constructor() { super(); NeverLifecycleWorker.terminated = false; }
  async terminate() { NeverLifecycleWorker.terminated = true; return 1; }
}
NeverLifecycleWorker.terminated = false;
const timeoutWorker = NeverLifecycleWorker;
const timeout = await executeCase({
  caseId: "preflight-timeout",
  shape: "semantic_article",
  targetBytes: 8 * 1024,
  html: sampleHtml,
  deadlineMs: 20,
  WorkerClass: timeoutWorker,
});
assert.equal(timeout.status, "timeout");
assert.equal(timeout.timeoutStage, "startup");
assert.equal(timeout.exitClass, "terminated");
assert.equal(timeout.networkAttempts, null);
assert.equal(NeverLifecycleWorker.terminated, true);
assert.equal(CASE_DEADLINE_MS, 5000);

const report = {
  mode: "offline lifecycle state-machine preflight; synthetic fake workers only",
  nodeVersion: process.version,
  extractorVersion: lock.packages["node_modules/@extractus/article-extractor"].version,
  realExtractorInvocations: 0,
  hostedBuildOrRun: false,
  publisherRequests: 0,
  networkRequestsMade: 0,
  plannedMatrixCases: matrix.length,
  shapes: [...new Set(matrix.map((item) => item.shape))],
  targetSizesBytes: [...new Set(matrix.map((item) => item.targetBytes))],
  exactFixtureSizeChecksPassed: true,
  successLifecycleCaptured: true,
  timeoutStageAndTerminationCaptured: true,
  rawSentinelAbsentFromPreflightMetrics: true,
  caseDeadlineMs: CASE_DEADLINE_MS,
  totalDeadlineMs: 90000,
};
await writeFile(new URL("./preflight-report.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report));
