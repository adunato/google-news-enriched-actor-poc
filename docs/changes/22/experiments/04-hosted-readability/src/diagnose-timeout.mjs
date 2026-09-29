import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { classifyExtractedContent } from "./readability-proxy.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const perWorkerTimeoutMs = 5000;
const fixtures = [
  "semantic-article",
  "generic-div",
  "navigation-heavy",
  "malformed-truncated",
];

function createLargeSyntheticFixture() {
  const body = [];
  for (let index = 0; index < 5000; index++) {
    body.push(
      `<p>Local diagnostic paragraph ${index} describes a synthetic public service update with distinct reference ${index}. Researchers reviewed schedules, published findings, explained constraints, and listed practical next steps for residents.</p>`,
    );
  }
  const full = `<html><head><title>Synthetic diagnostic</title></head><body><article><h1>Synthetic diagnostic</h1>${body.join("")}</article></body></html>`;
  let lower = 0;
  let upper = body.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const candidate = `<html><head><title>Synthetic diagnostic</title></head><body><article><h1>Synthetic diagnostic</h1>${body.slice(0, middle).join("")}</article></body></html>`;
    if (Buffer.byteLength(candidate) < 256 * 1024) lower = middle + 1;
    else upper = middle;
  }
  const content = `<html><head><title>Synthetic diagnostic</title></head><body><article><h1>Synthetic diagnostic</h1>${body.slice(0, Math.max(1, lower - 1)).join("")}</article></body></html>`;
  if (Buffer.byteLength(content) > 256 * 1024) throw new Error("synthetic_fixture_over_limit");
  return content || full;
}

function evaluate(id, html) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const worker = new Worker(new URL("./diagnostic-worker.mjs", import.meta.url), {
      workerData: { html, url: `https://fixture.invalid/${id}` },
    });
    let settled = false;
    let resultMessage = null;
    const phases = {};
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await worker.terminate().catch(() => {});
      resolve({
        id,
        inputBytes: Buffer.byteLength(html),
        workerTimeoutMs: perWorkerTimeoutMs,
        totalMs: Number((performance.now() - startedAt).toFixed(1)),
        lastPhase: phases.lastPhase ?? "worker_startup",
        phaseTimings: resultMessage?.timings ?? null,
        workerStartedAtParentMs: phases.workerStartedAtParentMs ?? null,
        postMs: phases.postMs ?? null,
        parentProxyMs: phases.parentProxyMs ?? null,
        outputChars: resultMessage?.outputChars ?? null,
        proxy: resultMessage?.proxy ?? null,
        ...result,
      });
    };
    const timer = setTimeout(
      () => finish({ status: "timeout" }),
      perWorkerTimeoutMs,
    );
    worker.on("message", (message) => {
      if (message.phase) phases.lastPhase = message.phase;
      if (message.phase === "worker_started")
        phases.workerStartedAtParentMs = Number((performance.now() - startedAt).toFixed(1));
      if (message.phase === "content") {
        const proxyStartedAt = performance.now();
        const proxy = classifyExtractedContent(message.content ?? "");
        phases.parentProxyMs = Number((performance.now() - proxyStartedAt).toFixed(1));
        resultMessage = {
          timings: message.timings,
          outputChars: (message.content ?? "").length,
          proxy,
        };
      } else if (message.phase === "post_done") {
        phases.postMs = Number(message.elapsedMs.toFixed(1));
      } else if (message.phase === "error") {
        finish({ status: "error", errorClass: message.errorClass });
      }
      if (message.phase === "post_done" && resultMessage) finish({ status: "completed" });
    });
    worker.once("error", (error) => finish({ status: "error", errorClass: error?.name || "WorkerError" }));
    worker.once("exit", (code) => {
      if (code !== 0 && !settled) finish({ status: "error", errorClass: "WorkerExit" });
    });
  });
}

const results = [];
for (const id of fixtures) {
  const html = await readFile(join(root, "..", "..", "03-local-readability", "fixtures", `${id}.html`), "utf8");
  if (Buffer.byteLength(html) > 256 * 1024) throw new Error("authored_fixture_over_limit");
  results.push(await evaluate(id, html));
}
results.push(await evaluate("large-synthetic-256KiB", createLargeSyntheticFixture()));

const output = {
  purpose: "local synthetic Node 20 worker-timeout diagnosis; no publisher requests",
  nodeVersion: process.version,
  package: "@extractus/article-extractor@9.0.1",
  dependencyLock: "package-lock.json in this experiment directory",
  perWorkerTimeoutMs,
  fixtureCount: results.length,
  results,
};
await writeFile(join(root, "..", "timeout-diagnosis.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output));
