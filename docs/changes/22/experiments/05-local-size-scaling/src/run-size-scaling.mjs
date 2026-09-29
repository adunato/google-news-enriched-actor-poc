import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { classifyExtractedContent } from "../../04-hosted-readability/src/readability-proxy.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const outputDir = dirname(root);
const lockRoot = join(outputDir, "..", "04-hosted-readability");
const lockPath = join(lockRoot, "package-lock.json");
const maxCaseMs = 5000;
const maxOverallMs = 90_000;
const maxInputBytes = 256 * 1024;
const maxOutputChars = 1_048_576;
const maxRssBytes = 256 * 1024 * 1024;
const workerOldSpaceMb = 128;
const targetSizesKiB = [16, 32, 64, 128, 192, 256];
const markupShapes = ["semantic_article", "generic_nested_div"];
const lockText = await readFile(lockPath, "utf8");
const lock = JSON.parse(lockText);
const lockedVersion = lock.packages?.["node_modules/@extractus/article-extractor"]?.version;
if (lockedVersion !== "9.0.1") throw new Error("dependency_lock_mismatch");
const requireFromLock = createRequire(pathToFileURL(join(lockRoot, "package.json")));
const installedEntry = requireFromLock.resolve("@extractus/article-extractor");
let installedPackageDir = dirname(installedEntry);
while (installedPackageDir !== dirname(installedPackageDir)) {
  try {
    const candidate = join(installedPackageDir, "package.json");
    const candidateJson = JSON.parse(await readFile(candidate, "utf8"));
    if (candidateJson.name === "@extractus/article-extractor") break;
  } catch {
    // Continue upward until the package root is found.
  }
  installedPackageDir = dirname(installedPackageDir);
}
const installedPackagePath = join(installedPackageDir, "package.json");
const installedPackage = JSON.parse(await readFile(installedPackagePath, "utf8"));
if (installedPackage.name !== "@extractus/article-extractor" || installedPackage.version !== lockedVersion)
  throw new Error("installed_package_mismatch");

function wrappers(shape) {
  if (shape === "semantic_article") {
    return {
      prefix: "<!doctype html><html><head><title>Synthetic size test</title></head><body><article><h1>Synthetic size test</h1>",
      paragraph: (index) => `<p>Local report ${index} describes a planned community service improvement, timing, public review, and next steps for residents.</p>`,
      fillerOpen: "<p>",
      fillerClose: "</p>",
      suffix: "</article></body></html>",
    };
  }
  return {
    prefix: "<!doctype html><html><head><title>Synthetic size test</title></head><body><div class=\"story\"><div class=\"copy\"><div class=\"headline\">Synthetic size test</div>",
    paragraph: (index) => `<div class=\"entry\"><p>Local report ${index} describes a planned community service improvement, timing, public review, and next steps for residents.</p></div>`,
    fillerOpen: "<div class=\"entry\"><p>",
    fillerClose: "</p></div>",
    suffix: "</div></div></body></html>",
  };
}

function makeInput(shape, targetBytes) {
  const layout = wrappers(shape);
  const blocks = [];
  let index = 0;
  const fixedTailBytes = Buffer.byteLength(layout.fillerOpen + layout.fillerClose + layout.suffix);
  while (true) {
    const next = layout.paragraph(index++);
    const nextBytes = Buffer.byteLength(layout.prefix + blocks.join("") + next) + fixedTailBytes;
    if (nextBytes > targetBytes) break;
    blocks.push(next);
  }
  const beforeFiller = layout.prefix + blocks.join("");
  const remaining = targetBytes - Buffer.byteLength(beforeFiller + layout.fillerOpen + layout.fillerClose + layout.suffix);
  if (remaining < 0) throw new Error("fixture_generation_over_target");
  const html = `${beforeFiller}${layout.fillerOpen}${"x".repeat(remaining)}${layout.fillerClose}${layout.suffix}`;
  const bytes = Buffer.byteLength(html);
  if (bytes !== targetBytes || bytes > maxInputBytes) throw new Error("fixture_size_assertion_failed");
  return html;
}

function evaluate(caseId, shape, targetBytes, html, overallStartedAt) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    let activeWorker;
    let settled = false;
    let contentMessage = null;
    let lastPhase = "worker_startup";
    const received = {};
    const remainingOverallMs = maxOverallMs - (performance.now() - overallStartedAt);
    if (remainingOverallMs <= 0) {
      resolve({ caseId, shape, targetBytes, status: "overall_deadline", totalMs: 0 });
      return;
    }
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(caseTimer);
      clearInterval(memoryTimer);
      if (activeWorker) await activeWorker.terminate().catch(() => {});
      resolve({
        caseId,
        shape,
        targetBytes,
        inputBytes: Buffer.byteLength(html),
        status: result.status,
        lastPhase,
        workerStartedAtParentMs: received.workerStartedAtParentMs ?? null,
        importMs: received.importMs ?? null,
        extractMs: received.extractMs ?? null,
        postMs: received.postMs ?? null,
        parentProxyMs: received.parentProxyMs ?? null,
        totalMs: Number((performance.now() - startedAt).toFixed(1)),
        outputChars: contentMessage?.outputChars ?? null,
        proxy: contentMessage?.proxy ?? null,
        networkAttempts: received.networkAttempts ?? null,
        rssBytesAfter: process.memoryUsage().rss,
        ...result,
      });
    };
    activeWorker = new Worker(new URL("./size-scaling-worker.mjs", import.meta.url), {
      workerData: {
        html,
        url: `https://fixture.invalid/${caseId}`,
        lockRoot,
        maxOutputChars,
      },
      resourceLimits: { maxOldGenerationSizeMb: workerOldSpaceMb, maxYoungGenerationSizeMb: 16 },
    });
    const caseTimer = setTimeout(
      () => finish({ status: remainingOverallMs < maxCaseMs ? "overall_deadline" : "timeout" }),
      Math.min(maxCaseMs, remainingOverallMs),
    );
    const memoryTimer = setInterval(() => {
      if (process.memoryUsage().rss > maxRssBytes) finish({ status: "memory_limit" });
    }, 10);
    activeWorker.on("message", (message) => {
      if (message.phase) lastPhase = message.phase;
      if (message.phase === "worker_started")
        received.workerStartedAtParentMs = Number((performance.now() - startedAt).toFixed(1));
      else if (message.phase === "import_done") received.importMs = Number(message.elapsedMs.toFixed(1));
      else if (message.phase === "extract_done") received.extractMs = Number(message.elapsedMs.toFixed(1));
      else if (message.phase === "content") {
        received.networkAttempts = message.networkAttempts;
        if (message.networkAttempts !== 0) return finish({ status: "network_attempt_blocked" });
        if (typeof message.content !== "string" || message.content.length > maxOutputChars)
          return finish({ status: "output_limit" });
        const proxyStartedAt = performance.now();
        const proxy = classifyExtractedContent(message.content);
        received.parentProxyMs = Number((performance.now() - proxyStartedAt).toFixed(1));
        contentMessage = { outputChars: message.content.length, proxy };
      } else if (message.phase === "post_done") received.postMs = Number(message.elapsedMs.toFixed(1));
      else if (message.phase === "output_limit") {
        received.networkAttempts = message.networkAttempts;
        finish({ status: "output_limit" });
      }
      else if (message.phase === "error") {
        received.networkAttempts = message.networkAttempts;
        const status = message.errorClass === "network_attempt_blocked" ? "network_attempt_blocked" : "error";
        finish({ status, errorClass: message.errorClass });
      }
      if (message.phase === "post_done" && contentMessage) finish({ status: "completed" });
    });
    activeWorker.once("error", (error) => finish({ status: "error", errorClass: error?.name || "WorkerError" }));
    activeWorker.once("exit", (code) => {
      if (code !== 0 && !settled) finish({ status: "error", errorClass: "WorkerExit" });
    });
  });
}

const overallStartedAt = performance.now();
const results = [];
let stopReason = null;
for (const shape of markupShapes) {
  for (const sizeKiB of targetSizesKiB) {
    if (performance.now() - overallStartedAt >= maxOverallMs) {
      stopReason = "overall_deadline";
      break;
    }
    const targetBytes = sizeKiB * 1024;
    const html = makeInput(shape, targetBytes);
    const caseId = `${shape}-${sizeKiB}KiB`;
    const result = await evaluate(caseId, shape, targetBytes, html, overallStartedAt);
    results.push(result);
    if (["memory_limit", "network_attempt_blocked", "output_limit", "overall_deadline"].includes(result.status)) {
      stopReason = result.status;
      break;
    }
  }
  if (stopReason) break;
}

const finalRssBytes = process.memoryUsage().rss;
if (!stopReason && finalRssBytes > maxRssBytes) stopReason = "memory_limit";
const summary = {
  purpose: "Iteration 5 local synthetic input-size scaling; no publisher requests",
  nodeVersion: process.version,
  lockedPackage: "@extractus/article-extractor@9.0.1",
  packageLockSha256: createHash("sha256").update(lockText).digest("hex"),
  lockIntegrityVerified: true,
  targetSizesKiB,
  markupShapes,
  maxCaseMs,
  maxOverallMs,
  maxInputBytes,
  maxOutputChars,
  workerOldSpaceMb,
  maxRssBytes,
  finalRssBytes,
  totalElapsedMs: Number((performance.now() - overallStartedAt).toFixed(1)),
  caseCount: results.length,
  stopReason,
  results,
};
const outputPath = join(outputDir, "results.json");
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary));
