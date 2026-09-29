import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { classifyExtractedContent } from "../../04-hosted-readability/src/readability-proxy.mjs";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const experimentDir = dirname(sourceDir);
const experimentsDir = dirname(experimentDir);
const lockRoot = join(experimentsDir, "04-hosted-readability");
const lockPath = join(lockRoot, "package-lock.json");
const maxCaseMs = 5000;
const maxOverallMs = 90_000;
const maxInputBytes = 256 * 1024;
const maxOutputChars = 1_048_576;
const maxRssBytes = 256 * 1024 * 1024;
const workerOldSpaceMb = 128;
const sizesKiB = [64, 128, 192];
const shapes = ["semantic_article", "generic_nested_div"];
const profiles = ["unique_low_markup", "repeated_high_markup"];

const lockText = await readFile(lockPath, "utf8");
const lock = JSON.parse(lockText);
const lockedVersion = lock.packages?.["node_modules/@extractus/article-extractor"]?.version;
if (lockedVersion !== "9.0.1") throw new Error("dependency_lock_mismatch");
const requireFromLock = createRequire(pathToFileURL(join(lockRoot, "package.json")));
const installedEntry = requireFromLock.resolve("@extractus/article-extractor");
let packageDir = dirname(installedEntry);
while (packageDir !== dirname(packageDir)) {
  try {
    const packageJson = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
    if (packageJson.name === "@extractus/article-extractor") break;
  } catch {
    // Continue upward until the installed package root is found.
  }
  packageDir = dirname(packageDir);
}
const installedPackage = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
if (installedPackage.name !== "@extractus/article-extractor" || installedPackage.version !== lockedVersion)
  throw new Error("installed_package_mismatch");

const subject = ["Residents", "Editors", "Teachers", "Engineers", "Families", "Readers", "Researchers", "Councils"];
const verb = ["review", "compare", "publish", "discuss", "measure", "describe", "explain", "organize"];
const adjective = ["regional", "public", "local", "useful", "current", "shared", "careful", "recent"];
const noun = ["reports", "records", "projects", "services", "meetings", "results", "questions", "proposals"];
const context = ["daily", "weekly", "openly", "fairly", "together", "locally", "clearly", "often"];

function uniqueSentence(index) {
  let value = index;
  const digits = [];
  for (let part = 0; part < 5; part += 1) {
    digits.push(value % 8);
    value = Math.floor(value / 8);
  }
  return `${subject[digits[0]]} ${verb[digits[1]]} ${adjective[digits[2]]} ${noun[digits[3]]} ${context[digits[4]]}.`;
}

function wrapped(shape) {
  if (shape === "semantic_article") {
    return {
      prefix: "<!doctype html><html><head><title>Local complexity test</title></head><body><article><h1>Local complexity test</h1>",
      suffix: "</article></body></html>",
    };
  }
  return {
    prefix: "<!doctype html><html><head><title>Local complexity test</title></head><body><div class=\"story\"><div class=\"copy\"><div class=\"headline\">Local complexity test</div>",
    suffix: "</div></div></body></html>",
  };
}

function makeBlock(profile, index) {
  if (profile === "unique_low_markup") {
    const sentences = Array.from({ length: 8 }, (_, offset) => uniqueSentence(index * 8 + offset));
    return `<p>${sentences.join(" ")}</p>`;
  }
  const phrase = ["Residents", "review", "public", "reports", "during", "planning."]
    .map((word) => `<span>${word}</span>`)
    .join(" ");
  return `<p>${Array.from({ length: 8 }, () => phrase).join(" ")}</p>`;
}

function makeInput(shape, profile, targetBytes) {
  const layout = wrapped(shape);
  const blocks = [];
  let blockIndex = 0;
  while (true) {
    const block = makeBlock(profile, blockIndex++);
    const candidate = `${layout.prefix}${blocks.join("")}${block}${layout.suffix}`;
    if (Buffer.byteLength(candidate) > targetBytes) break;
    blocks.push(block);
  }
  const content = `${layout.prefix}${blocks.join("")}`;
  const remaining = targetBytes - Buffer.byteLength(content + layout.suffix);
  if (remaining < 0) throw new Error("fixture_generation_over_target");
  const html = `${content}${" ".repeat(remaining)}${layout.suffix}`;
  const actualBytes = Buffer.byteLength(html);
  if (actualBytes !== targetBytes || actualBytes > maxInputBytes) throw new Error("fixture_size_assertion_failed");
  return html;
}

function evaluate(caseId, shape, profile, targetBytes, html, overallStartedAt) {
  return new Promise((resolve) => {
    const caseStartedAt = performance.now();
    const remainingOverallMs = maxOverallMs - (caseStartedAt - overallStartedAt);
    if (remainingOverallMs <= 0) {
      resolve({ caseId, shape, profile, targetBytes, status: "overall_deadline", totalMs: 0 });
      return;
    }
    let activeWorker;
    let settled = false;
    let contentStats = null;
    let lastPhase = "worker_startup";
    const received = {};
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(caseTimer);
      clearInterval(memoryTimer);
      if (activeWorker) await activeWorker.terminate().catch(() => {});
      resolve({
        caseId,
        shape,
        profile,
        targetBytes,
        inputBytes: Buffer.byteLength(html),
        status: result.status,
        lastPhase,
        workerStartedAtParentMs: received.workerStartedAtParentMs ?? null,
        importMs: received.importMs ?? null,
        extractMs: received.extractMs ?? null,
        postMs: received.postMs ?? null,
        parentProxyMs: received.parentProxyMs ?? null,
        totalMs: Number((performance.now() - caseStartedAt).toFixed(1)),
        outputChars: contentStats?.outputChars ?? null,
        proxy: contentStats?.proxy ?? null,
        networkAttempts: received.networkAttempts ?? null,
        rssBytesAfter: process.memoryUsage().rss,
        ...result,
      });
    };

    activeWorker = new Worker(new URL("./complexity-worker.mjs", import.meta.url), {
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
        received.workerStartedAtParentMs = Number((performance.now() - caseStartedAt).toFixed(1));
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
        contentStats = { outputChars: message.content.length, proxy };
      } else if (message.phase === "post_done") received.postMs = Number(message.elapsedMs.toFixed(1));
      else if (message.phase === "output_limit") {
        received.networkAttempts = message.networkAttempts;
        finish({ status: "output_limit" });
      } else if (message.phase === "error") {
        received.networkAttempts = message.networkAttempts;
        finish({ status: message.errorClass === "network_attempt_blocked" ? "network_attempt_blocked" : "error",
          errorClass: message.errorClass });
      }
      if (message.phase === "post_done" && contentStats) finish({ status: "completed" });
    });
    activeWorker.once("error", (error) => finish({ status: "error", errorClass: error?.name || "WorkerError" }));
    activeWorker.once("exit", (code) => {
      if (code !== 0 && !settled) finish({ status: "error", errorClass: "WorkerExit" });
    });
  });
}

if (process.argv.includes("--preflight")) {
  const fixtures = [];
  for (const shape of shapes) {
    for (const sizeKiB of sizesKiB) {
      for (const profile of profiles) {
        const targetBytes = sizeKiB * 1024;
        const html = makeInput(shape, profile, targetBytes);
        fixtures.push({ shape, sizeKiB, profile, inputBytes: Buffer.byteLength(html) });
      }
    }
  }
  console.log(JSON.stringify({ mode: "synthetic fixture preflight only", caseCount: fixtures.length, fixtures }));
  process.exit(0);
}

const overallStartedAt = performance.now();
const results = [];
let stopReason = null;
for (const shape of shapes) {
  for (const sizeKiB of sizesKiB) {
    for (const profile of profiles) {
      if (performance.now() - overallStartedAt >= maxOverallMs) {
        stopReason = "overall_deadline";
        break;
      }
      const targetBytes = sizeKiB * 1024;
      const html = makeInput(shape, profile, targetBytes);
      const caseId = `${shape}-${sizeKiB}KiB-${profile}`;
      const result = await evaluate(caseId, shape, profile, targetBytes, html, overallStartedAt);
      results.push(result);
      if (["memory_limit", "network_attempt_blocked", "output_limit", "overall_deadline"].includes(result.status)) {
        stopReason = result.status;
        break;
      }
    }
    if (stopReason) break;
  }
  if (stopReason) break;
}

const finalRssBytes = process.memoryUsage().rss;
if (!stopReason && finalRssBytes > maxRssBytes) stopReason = "memory_limit";
const summary = {
  purpose: "Iteration 6 local synthetic complexity-control study; no publisher requests",
  nodeVersion: process.version,
  lockedPackage: "@extractus/article-extractor@9.0.1",
  packageLockSha256: createHash("sha256").update(lockText).digest("hex"),
  lockIntegrityVerified: true,
  sizesKiB,
  shapes,
  profiles,
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
await writeFile(join(experimentDir, "results.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary));
