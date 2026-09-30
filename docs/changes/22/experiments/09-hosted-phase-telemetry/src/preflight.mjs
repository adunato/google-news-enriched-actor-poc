import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { runWorkerAttempt, EXTRACTION_DEADLINE_MS } from "./worker-extraction.mjs";
import { observationsFromProbe, persistAggregateOnly } from "./run-core.mjs";
import { CELLS, validateAggregateOnly } from "./aggregate.mjs";
import { verifyRunOptions } from "./verify-run-options.mjs";
import { configureHtmlParser } from "./readability-proxy.mjs";

const experimentDir = dirname(dirname(fileURLToPath(import.meta.url)));
const worktree = resolve(experimentDir, "../../../../..");
const i7Dir = resolve(experimentDir, "../07-hosted-eligibility");
const startedAt = Date.now();
const CHECK_LIMIT_MS = 90000;
const checks = [];
let networkAttempts = 0;
const sentinel = "PRIVATE-I9-SENTINEL-DO-NOT-RETAIN";
let peakRssBytes = process.memoryUsage().rss;
const rssSampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 10);

function blockedNetwork() {
  networkAttempts += 1;
  throw new Error("offline_preflight_network_blocked");
}
const http = (await import("node:http")).default;
const https = (await import("node:https")).default;
const net = (await import("node:net")).default;
const dns = (await import("node:dns")).default;
const dnsPromises = dns.promises;
const dnsResolveNames = ["resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"];
const originals = {
  fetch: globalThis.fetch,
  httpRequest: http.request,
  httpGet: http.get,
  httpsRequest: https.request,
  httpsGet: https.get,
  connect: net.connect,
  createConnection: net.createConnection,
  socketConnect: net.Socket.prototype.connect,
  dnsLookup: dns.lookup,
  dnsLookupService: dns.lookupService,
  dnsResolve: Object.fromEntries(dnsResolveNames.map((key) => [key, dns[key]])),
  dnsPromiseFns: Object.fromEntries(["lookup", "lookupService", ...dnsResolveNames].map((key) => [key, dnsPromises[key]])),
};
globalThis.fetch = blockedNetwork;
http.request = blockedNetwork; http.get = blockedNetwork;
https.request = blockedNetwork; https.get = blockedNetwork;
net.connect = blockedNetwork; net.createConnection = blockedNetwork; net.Socket.prototype.connect = blockedNetwork;
dns.lookup = blockedNetwork; dns.lookupService = blockedNetwork;
for (const key of Object.keys(originals.dnsResolve)) dns[key] = blockedNetwork;
for (const key of Object.keys(originals.dnsPromiseFns)) dnsPromises[key] = blockedNetwork;

function fakeClass(events) {
  return class FakeWorker extends EventEmitter {
    static terminateCount = 0;
    constructor(_url, { workerData }) {
      super();
      this.scenario = workerData.html;
      for (const event of events[this.scenario] ?? []) {
        const emit = () => this.emit(event.type, event.value);
        if (event.delayMs) setTimeout(emit, event.delayMs);
        else queueMicrotask(emit);
      }
    }
    async terminate() {
      FakeWorker.terminateCount += 1;
      return 1;
    }
  };
}

function phase(name, extra = {}) { return { type: "message", value: { kind: "phase", phase: name, ...extra } }; }
function event(type, value = undefined, delayMs = 0) { return { type, value, delayMs }; }
const fullPhases = [
  phase("worker_ready"),
  phase("import_complete", { durationMs: 2 }),
  phase("extract_started"),
  phase("extract_complete", { durationMs: 3 }),
];
const resultMessage = { kind: "result", content: "authored synthetic content", outputChars: 26 };
const successful = [...fullPhases, event("message", resultMessage), event("exit", 0)];
const checksStartedAt = Date.now();

async function check(id, fn) {
  const checkStarted = Date.now();
  await fn();
  checks.push({ id, status: "passed", elapsedMs: Date.now() - checkStarted });
  if (peakRssBytes > 256 * 1024 * 1024) throw new Error("preflight_rss_limit_exceeded");
  if (Date.now() - checksStartedAt > CHECK_LIMIT_MS) throw new Error("preflight_total_deadline_exceeded");
}

try {
  assert.equal(process.version, "v20.19.0", "exact Node 20.19.0 runtime required");
  assert.equal(EXTRACTION_DEADLINE_MS, 5000, "hosted worker deadline must remain 5000 ms");
  const localLock = await readFile(join(experimentDir, "package-lock.json"));
  const baselineLock = await readFile(join(i7Dir, "package-lock.json"));
  const localLockJson = JSON.parse(localLock.toString("utf8").replace(/^\uFEFF/, ""));
  const baselineLockJson = JSON.parse(baselineLock.toString("utf8").replace(/^\uFEFF/, ""));
  assert.deepEqual(localLockJson.packages[""].dependencies, baselineLockJson.packages[""].dependencies);
  assert.deepEqual(
    Object.fromEntries(Object.entries(localLockJson.packages).filter(([key]) => key !== "")),
    Object.fromEntries(Object.entries(baselineLockJson.packages).filter(([key]) => key !== "")),
  );
  assert.equal(localLockJson.packages[""].dependencies["@extractus/article-extractor"], "9.0.1");
  const pkg = JSON.parse((await readFile(join(i7Dir, "node_modules/@extractus/article-extractor/package.json"), "utf8")).replace(/^\uFEFF/, ""));
  assert.equal(pkg.version, "9.0.1");
  const requireFromI7 = createRequire(join(i7Dir, "package.json"));
  configureHtmlParser(requireFromI7("linkedom").parseHTML);
  const extractorSpecifier = pathToFileURL(join(i7Dir, "node_modules/@extractus/article-extractor/esm/mod.js")).href;

  await check("stage_success", async () => {
    const WorkerClass = fakeClass({ success: successful });
    const got = await runWorkerAttempt("success", "https://fixture.invalid/article", { WorkerClass, deadlineMs: 100, classify: () => ({ status: "quality_rejected" }) });
    assert.equal(got.status, "quality_rejected"); assert.equal(got.terminalPhase, "worker_exit");
  });
  await check("stall_startup", async () => {
    const got = await runWorkerAttempt("startup", "https://fixture.invalid/a", { WorkerClass: fakeClass({}), deadlineMs: 25 });
    assert.equal(got.status, "timeout"); assert.equal(got.terminalPhase, "startup");
  });
  await check("stall_import", async () => {
    const got = await runWorkerAttempt("import", "https://fixture.invalid/a", { WorkerClass: fakeClass({ import: [phase("worker_ready")] }), deadlineMs: 25 });
    assert.equal(got.terminalPhase, "import");
  });
  await check("stall_extract", async () => {
    const got = await runWorkerAttempt("extract", "https://fixture.invalid/a", { WorkerClass: fakeClass({ extract: fullPhases.slice(0, 3) }), deadlineMs: 25 });
    assert.equal(got.terminalPhase, "extract");
  });
  await check("stall_result_delivery", async () => {
    const got = await runWorkerAttempt("delivery", "https://fixture.invalid/a", { WorkerClass: fakeClass({ delivery: fullPhases }), deadlineMs: 25 });
    assert.equal(got.terminalPhase, "result_delivery");
  });
  await check("stall_worker_exit", async () => {
    const got = await runWorkerAttempt("worker_exit", "https://fixture.invalid/a", { WorkerClass: fakeClass({ worker_exit: [...fullPhases, event("message", resultMessage)] }), deadlineMs: 25, classify: () => ({ status: "quality_rejected" }) });
    assert.equal(got.status, "worker_exit_timeout"); assert.equal(got.terminalPhase, "worker_exit");
  });

  await check("fixed_worker_error_result", async () => {
    const events = [phase("worker_ready"), event("message", { kind: "result_error", errorClass: "extractor_error", failurePhase: "import" }), event("exit", 0)];
    const got = await runWorkerAttempt("error_result", "https://fixture.invalid/a", { WorkerClass: fakeClass({ error_result: events }), deadlineMs: 100 });
    assert.equal(got.status, "worker_error"); assert.equal(got.terminalPhase, "import");
  });
  await check("worker_error_event", async () => {
    const got = await runWorkerAttempt("worker_error", "https://fixture.invalid/a", { WorkerClass: fakeClass({ worker_error: [event("error", new Error(sentinel))] }), deadlineMs: 100 });
    assert.equal(got.status, "worker_error");
  });
  await check("premature_exit_before_ready", async () => {
    const got = await runWorkerAttempt("early_exit", "https://fixture.invalid/a", { WorkerClass: fakeClass({ early_exit: [event("exit", 0)] }), deadlineMs: 100 });
    assert.equal(got.status, "worker_exit_error"); assert.equal(got.terminalPhase, "worker_exit");
  });
  await check("exit_after_ready_without_result", async () => {
    const got = await runWorkerAttempt("exit_after_ready", "https://fixture.invalid/a", { WorkerClass: fakeClass({ exit_after_ready: [phase("worker_ready"), event("exit", 0)] }), deadlineMs: 100 });
    assert.equal(got.status, "worker_exit_error");
  });
  await check("messageerror_event", async () => {
    const got = await runWorkerAttempt("message_error", "https://fixture.invalid/a", { WorkerClass: fakeClass({ message_error: [event("messageerror", new Error(sentinel))] }), deadlineMs: 100 });
    assert.equal(got.status, "message_error");
  });
  await check("timeout_cleans_worker", async () => {
    const WorkerClass = fakeClass({});
    const got = await runWorkerAttempt("cleanup", "https://fixture.invalid/a", { WorkerClass, deadlineMs: 25 });
    assert.equal(got.status, "timeout"); assert.equal(WorkerClass.terminateCount, 1);
  });

  await check("malformed_phase", async () => {
    const got = await runWorkerAttempt("malformed", "https://fixture.invalid/a", { WorkerClass: fakeClass({ malformed: [{ type: "message", value: { kind: "phase", phase: "worker_ready", extra: sentinel } }] }), deadlineMs: 100 });
    assert.equal(got.status, "protocol_error");
  });
  await check("duplicate_phase", async () => {
    const got = await runWorkerAttempt("duplicate_phase", "https://fixture.invalid/a", { WorkerClass: fakeClass({ duplicate_phase: [phase("worker_ready"), phase("worker_ready")] }), deadlineMs: 100 });
    assert.equal(got.status, "protocol_error");
  });
  await check("late_phase", async () => {
    const got = await runWorkerAttempt("late_phase", "https://fixture.invalid/a", { WorkerClass: fakeClass({ late_phase: [...fullPhases, phase("import_complete", { durationMs: 1 })] }), deadlineMs: 100 });
    assert.equal(got.status, "protocol_error");
  });
  await check("out_of_order_phase", async () => {
    const got = await runWorkerAttempt("out_of_order", "https://fixture.invalid/a", { WorkerClass: fakeClass({ out_of_order: [phase("worker_ready"), phase("extract_started")] }), deadlineMs: 100 });
    assert.equal(got.status, "protocol_error");
  });
  await check("duplicate_result", async () => {
    const got = await runWorkerAttempt("duplicate_result", "https://fixture.invalid/a", { WorkerClass: fakeClass({ duplicate_result: [...fullPhases, event("message", resultMessage), event("message", resultMessage)] }), deadlineMs: 100, classify: () => ({ status: "quality_rejected" }) });
    assert.equal(got.status, "protocol_error");
  });
  await check("timeout_exit_result_race", async () => {
    const WorkerClass = fakeClass({ timeout_race: [event("message", phase("worker_ready"), 10), event("exit", 0, 11), event("message", resultMessage, 12)] });
    const got = await runWorkerAttempt("timeout_race", "https://fixture.invalid/a", { WorkerClass, deadlineMs: 2 });
    assert.equal(got.status, "timeout"); assert.equal(got.terminalPhase, "startup");
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(WorkerClass.terminateCount, 1);
  });
  await check("construction_delay_late_message_deadline", async () => {
    class BlockedConstructorWorker extends EventEmitter {
      static terminateCount = 0;
      constructor() {
        super();
        for (const item of successful) {
          const emit = () => this.emit(item.type, item.value);
          if (item.delayMs) setTimeout(emit, item.delayMs);
          else queueMicrotask(emit);
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30);
      }
      async terminate() { BlockedConstructorWorker.terminateCount += 1; return 1; }
    }
    const got = await runWorkerAttempt("blocked-construction", "https://fixture.invalid/a", {
      WorkerClass: BlockedConstructorWorker, deadlineMs: 10, classify: () => ({ status: "quality_rejected" }),
    });
    assert.equal(got.status, "timeout"); assert.equal(got.terminalPhase, "startup");
    assert.equal(BlockedConstructorWorker.terminateCount, 1);
  });
  await check("result_then_worker_terminal_precedence", async () => {
    const run = async (key, trailing, expectedStatus, expectedPhase) => {
      const got = await runWorkerAttempt(key, "https://fixture.invalid/a", {
        WorkerClass: fakeClass({ [key]: [...fullPhases, event("message", resultMessage), ...trailing] }),
        deadlineMs: 100, classify: () => ({ status: "quality_rejected" }),
      });
      assert.equal(got.status, expectedStatus); assert.equal(got.terminalPhase, expectedPhase);
    };
    await run("result_error_after", [event("error", new Error(sentinel)), event("exit", 0)], "worker_error", "worker_exit");
    await run("result_messageerror_after", [event("messageerror", new Error(sentinel)), event("exit", 0)], "message_error", "worker_exit");
    await run("result_nonzero_exit_after", [event("exit", 1)], "worker_exit_error", "worker_exit");
    await run("result_duplicate_phase_after", [phase("worker_ready"), event("exit", 0)], "protocol_error", "protocol");
  });

  await check("real_extractor_semantic_smoke", async () => {
    const html = `<article><h1>Fixture heading</h1><p>${"Synthetic prose held only in memory. ".repeat(100)}</p></article>`;
    const got = await runWorkerAttempt(html, "https://fixture.invalid/article", { extractorSpecifier, deadlineMs: EXTRACTION_DEADLINE_MS });
    assert.equal(got.terminalPhase, "worker_exit");
    assert.ok(["empty", "too_short", "quality_rejected", "accepted_proxy", "oversize"].includes(got.status));
  });
  await check("real_extractor_nested_smoke", async () => {
    const html = `<div><div><p>${"Authored nested fixture prose. ".repeat(100)}</p></div></div>`;
    const got = await runWorkerAttempt(html, "https://fixture.invalid/nested", { extractorSpecifier, deadlineMs: EXTRACTION_DEADLINE_MS });
    assert.equal(got.terminalPhase, "worker_exit");
    assert.ok(["empty", "too_short", "quality_rejected", "accepted_proxy", "oversize"].includes(got.status));
  });

  const makeCohort = () => {
    const rows = [];
    const resolutions = [];
    const checkedRows = [];
    let index = 0;
    for (const cell of CELLS) {
      for (let n = 0; n < 10; n++, index++) {
        const rowId = `synthetic-${index}`;
        const eligible = n < 2;
        rows.push({ rowId, cell });
        resolutions.push({ candidateUrl: eligible ? "https://fixture.invalid/article" : null });
        if (eligible) checkedRows.push({
          rowId,
          accessStatus: "http_2xx_html",
          robotsSignal: "allowed",
          challengeLike: n % 2 === 0,
          httpStatus: 200,
          responseBytes: 8192 + n,
          extraction: {
            status: "quality_rejected", terminalPhase: "worker_exit",
            timing: { startupMs: 12, importMs: 200, extractMs: 42, resultDeliveryMs: 3, workerExitMs: 4 },
          },
        });
      }
    }
    return { rows, resolutions, checkedRows };
  };
  await check("complete_cohort_single_sink", async () => {
    const expectedBuild = "review-only-build-placeholder";
    const validFutureOptions = verifyRunOptions({
      buildNumber: expectedBuild,
      options: { build: expectedBuild, maxTotalChargeUsd: 1, isMaxTotalChargeUsdSetByUser: true, memoryMbytes: 256, timeoutSecs: 900, restartOnError: false },
    }, expectedBuild);
    const invalidFutureOptions = verifyRunOptions({
      buildNumber: expectedBuild,
      options: { build: expectedBuild, maxTotalChargeUsd: 1, memoryMbytes: 256, timeoutSecs: 900, restartOnError: false },
    }, expectedBuild);
    assert.equal(validFutureOptions.valid, true); assert.equal(invalidFutureOptions.valid, false);
    const cohort = makeCohort();
    const observations = observationsFromProbe(cohort.rows, cohort.resolutions, cohort.checkedRows);
    let sinks = 0;
    const aggregate = await persistAggregateOnly(observations, async (payload) => { sinks += 1; validateAggregateOnly(payload); });
    assert.equal(sinks, 1); assert.equal(aggregate.denominator, 100); assert.equal(aggregate.eligibleRows, 20);
  });
  await check("partial_cohort_zero_sink", async () => {
    const cohort = makeCohort(); cohort.rows.pop();
    let sinks = 0;
    await assert.rejects(async () => persistAggregateOnly(observationsFromProbe(cohort.rows, cohort.resolutions.slice(0, 99), cohort.checkedRows), async () => { sinks += 1; }));
    assert.equal(sinks, 0);
  });
  await check("missing_checked_candidate_zero_sink", async () => {
    const cohort = makeCohort(); cohort.checkedRows.pop();
    let sinks = 0;
    await assert.rejects(async () => {
      const observations = observationsFromProbe(cohort.rows, cohort.resolutions, cohort.checkedRows);
      await persistAggregateOnly(observations, async () => { sinks += 1; });
    }, /checked_candidate_results_incomplete/);
    assert.equal(sinks, 0);
  });
  await check("inconsistent_terminal_zero_sink", async () => {
    const cohort = makeCohort();
    cohort.checkedRows[0].extraction.terminalPhase = "not_attempted";
    let sinks = 0;
    await assert.rejects(async () => persistAggregateOnly(observationsFromProbe(cohort.rows, cohort.resolutions, cohort.checkedRows), async () => { sinks += 1; }));
    assert.equal(sinks, 0);
  });
  await check("privacy_unknown_field_zero_sink", async () => {
    const cohort = makeCohort();
    const observations = observationsFromProbe(cohort.rows, cohort.resolutions, cohort.checkedRows);
    observations[0].url = sentinel;
    let sinks = 0;
    await assert.rejects(async () => persistAggregateOnly(observations, async () => { sinks += 1; }));
    assert.equal(sinks, 0);
  });

  assert.equal(checks.length, 27);
  assert.equal(networkAttempts, 0);
  assert.ok(peakRssBytes <= 256 * 1024 * 1024);
  const elapsedMs = Date.now() - startedAt;
  assert.ok(elapsedMs <= CHECK_LIMIT_MS);

  const files = ["Dockerfile", "package.json", "package-lock.json", "src/aggregate.mjs", "src/extract-worker.mjs", "src/probe-network.mjs", "src/probe.mjs", "src/readability-proxy.mjs", "src/run-core.mjs", "src/verify-run-options.mjs", "src/worker-extraction.mjs"];
  const manifestParts = [];
  for (const file of files) {
    const content = await readFile(join(experimentDir, file));
    manifestParts.push(`${file}\0${createHash("sha256").update(content).digest("hex")}\n`);
  }
  const sourceManifestSha256 = createHash("sha256").update(manifestParts.join("")).digest("hex");
  const preflightBaseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: worktree, encoding: "utf8" }).trim();
  const report = {
    schemaVersion: "issue22-iteration9-offline-preflight-v1",
    status: "passed",
    nodeVersion: process.version,
    extractorVersion: pkg.version,
    packageLockSha256: createHash("sha256").update(localLock).digest("hex"),
    baselinePackageLockSha256: createHash("sha256").update(baselineLock).digest("hex"),
    transitiveLockRecordsMatch: true,
    futureRunOptionsValidShapeChecked: true,
    sourceManifestSha256,
    preflightBaseCommit,
    plannedCheckCount: 27,
    completedCheckCount: checks.length,
    totalElapsedMs: elapsedMs,
    totalDeadlineMs: CHECK_LIMIT_MS,
    maxRssBytes: 268435456,
    peakRssBytes,
    configuredHostedWorkerDeadlineMs: EXTRACTION_DEADLINE_MS,
    networkAttempts: 0,
    aggregateSinkChecks: { completeCohortWrites: 1, partialCohortWrites: 0, inconsistentWrites: 0, privacyViolationWrites: 0 },
    checks: checks.map(({ id, status }) => ({ id, status })),
  };
  assert.ok(!JSON.stringify(report).includes(sentinel));
  await writeFile(join(experimentDir, "preflight-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`I9 offline preflight passed: 27 checks, ${elapsedMs}ms, zero network attempts, sink gating verified.`);
} finally {
  clearInterval(rssSampler);
  globalThis.fetch = originals.fetch;
  http.request = originals.httpRequest; http.get = originals.httpGet;
  https.request = originals.httpsRequest; https.get = originals.httpsGet;
  net.connect = originals.connect; net.createConnection = originals.createConnection; net.Socket.prototype.connect = originals.socketConnect;
  dns.lookup = originals.dnsLookup; dns.lookupService = originals.dnsLookupService;
  for (const [key, value] of Object.entries(originals.dnsResolve)) dns[key] = value;
  for (const [key, value] of Object.entries(originals.dnsPromiseFns)) dnsPromises[key] = value;
}
