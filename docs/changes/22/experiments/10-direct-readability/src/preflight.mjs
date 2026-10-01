import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough, Readable } from "node:stream";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import process from "node:process";
import { LIMITS, NETWORK_RETRIES, addressIsPublic, boundedPrefix, createRunBudget, dedupeFirst, mayFollowRedirect, paceHost, pinnedLookup, requestPinned, resolvePublicTarget, robotsAllows } from "./network.mjs";
import { extractBounded } from "./extract.mjs";
import { buildAggregate, persistAggregateOnly, validateAggregate } from "./aggregate.mjs";
import { verifyFutureRunGates } from "./verify-run-options.mjs";
import { mapLimit, readabilityOutcome } from "./probe.mjs";
import { assertHostedRunGate, inspectHostedRunGate } from "./runtime-gate.mjs";
import { approvalRecordMatches, inspectLaunchTuple, waitForRunApproval } from "./run-approval.mjs";
import { createHostedRunPlan, executeHostedRunPlan, hashSourceFiles, sourceSnapshotsEqual } from "./hosted-run-controller.mjs";
import { createApifyCliAdapter, runApifyCli } from "./apify-cli-adapter.mjs";
import { safeFailure } from "./launch-hosted-run.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const started = Date.now(), checks = [];
let peakRssBytes = process.memoryUsage().rss;
const rssSampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 10);
rssSampler.unref();
async function check(id, fn) { await fn(); checks.push({ id, status: "passed" }); }
function row(cellIndex, slot) {
  return { cellId: `q${Math.floor(cellIndex / 2) + 1}-${cellIndex % 2 ? "us" : "gb"}`, slot, candidate: "resolved", robots: "allowed", fetch: "http_2xx_html", readability: "success", readabilityWords: 20, structured: "present", structuredWords: 12, prefix: "not_capped", elapsed: "100_to_lt_500ms", dom: "lt_1k", workerTime: "100_to_lt_500ms" };
}
function cohort() { return Array.from({ length: 100 }, (_, i) => row(Math.floor(i / 10), i % 10 + 1)); }
function planlessSnapshot(content) { return [{ name: "src/test.mjs", format: "TEXT", content }]; }
const fixture = `<!doctype html><html><head><title>Fixture article</title><script type="application/ld+json">{"@type":"NewsArticle","articleBody":"Structured fixture body with enough meaningful words to be detected."}</script></head><body><nav>Home World Business Technology</nav><article><h1>Fixture article title</h1><p>This synthetic article contains enough readable prose for Mozilla Readability to identify the article and return normalized text safely.</p><p>It has no real publisher data and exists only to prove direct parsing and aggregate measurement.</p></article></body></html>`;
const sentinelUrl = "https://private-sentinel.invalid/story";
const sentinelText = "forbidden sentinel article text";
let networkAttempts = 0;
function blockNetwork() { networkAttempts++; throw new Error("preflight_network_disabled"); }
globalThis.fetch = blockNetwork;
http.request = blockNetwork; http.get = blockNetwork; https.request = blockNetwork; https.get = blockNetwork;
net.connect = blockNetwork; net.createConnection = blockNetwork; net.Socket.prototype.connect = blockNetwork;
dns.lookup = blockNetwork; dns.lookupService = blockNetwork;
for (const key of ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"]) {
  dns[key] = blockNetwork; dnsPromises[key] = blockNetwork;
}

if (!/^v20\./.test(process.version)) throw new Error(`expected Node 20 runtime; received ${process.version}`);
if (Date.now() - started > 90000) throw new Error("preflight_startup_over_90_seconds");

await check("fixed_configuration_and_no_retries", async () => {
  assert.deepEqual(LIMITS, { timeoutMs: 10000, maxRedirects: 5, prefixBytes: 524288, structuredBytes: 65536, maxDomElements: 10000, maxOutputChars: 100000, concurrency: 4, perHostDelayMs: 250, workerDeadlineMs: 5000, softStopMs: 780000, flushDeadlineMs: 840000, maxRows: 100 });
  assert.equal(NETWORK_RETRIES, 0); assert.equal(mayFollowRedirect(0), true); assert.equal(mayFollowRedirect(4), true); assert.equal(mayFollowRedirect(5), false); assert.equal(mayFollowRedirect(-1), false);
});
await check("public_dns_validation_and_pinning", async () => {
  assert.equal(addressIsPublic("8.8.8.8"), true); assert.equal(addressIsPublic("127.0.0.1"), false); assert.equal(addressIsPublic("::1"), false);
  const publicTarget = await resolvePublicTarget("https://publisher.example.org/a", async () => [{ address: "93.184.216.34", family: 4 }]);
  assert.equal(publicTarget.ok, true);
  const privateTarget = await resolvePublicTarget("https://publisher.example.org/a", async () => [{ address: "10.0.0.2", family: 4 }]);
  assert.equal(privateTarget.ok, false); assert.equal(privateTarget.reason, "non_public_dns_address");
  const lookup = pinnedLookup(publicTarget); await new Promise((resolve, reject) => lookup("attacker.invalid", {}, (error) => error ? resolve() : reject(new Error("wrong host was pinned"))));
});
await check("robots_allow_deny_unknown_and_specific_agent_precedence", async () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/a"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/public/a"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow:", "/article"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private/*/preview$", "/private/a/preview"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private/*/preview$", "/private/a/preview/more"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /page\nAllow: /page", "/page"), true);
  const rules = "User-agent: *\nDisallow: /world\nUser-agent: GoogleNewsAccessSpike\nAllow: /world\nDisallow: /blocked\nUser-agent: OtherBot\nDisallow: /";
  const actualAgent = "GoogleNewsAccessSpike/0.1 (+https://example.org)";
  assert.equal(robotsAllows(rules, "/world/article", actualAgent), true);
  assert.equal(robotsAllows(rules, "/blocked/article", actualAgent), false);
  assert.equal(robotsAllows(rules, "/blocked/article", "UnmatchedBot/1.0"), true);
});
await check("request_wall_clock_bounds_stalled_dns_and_response_body", async () => {
  const startedAt = Date.now();
  await assert.rejects(() => requestPinned("https://publisher.example.org/a", { timeoutMs: 15, resolver: () => new Promise(() => {}) }), { name: "TimeoutError" });
  assert.ok(Date.now() - startedAt < 500, "stalled DNS exceeded the request wall-clock deadline");

  class StalledResponse extends EventEmitter {
    headers = { "content-encoding": "identity" };
    destroy(error) { if (error) queueMicrotask(() => this.emit("error", error)); return this; }
  }
  class FakeRequest extends EventEmitter {
    constructor(callback) { super(); this.callback = callback; }
    end() { queueMicrotask(() => this.callback(new StalledResponse())); }
    destroy(error) { if (error) queueMicrotask(() => this.emit("error", error)); return this; }
  }
  const responseTransport = { request: (_options, callback) => new FakeRequest(callback) };
  const opened = await requestPinned("https://publisher.example.org/a", {
    timeoutMs: 15, resolver: async () => [{ address: "93.184.216.34", family: 4 }],
    transports: { http: responseTransport, https: responseTransport },
  });
  await assert.rejects(() => boundedPrefix(opened.response, 1024), { name: "TimeoutError" });
  opened.close();
});
await check("global_monotonic_soft_stop_aborts_active_work", async () => {
  const budget = createRunBudget({ softStopMs: 20, flushDeadlineMs: 80 });
  const startedAt = Date.now();
  await assert.rejects(() => requestPinned("https://publisher.example.org/a", { resolver: () => new Promise(() => {}), signal: budget.signal }), { name: "TimeoutError" });
  assert.ok(Date.now() - startedAt < 500);
  assert.equal(budget.aborted, true);
  assert.ok(budget.flushRemainingMs() > 0);
  budget.dispose();
  let terminated = false;
  class AbortedWorker extends EventEmitter { async terminate() { terminated = true; } }
  const workerBudget = createRunBudget({ softStopMs: 20, flushDeadlineMs: 80 });
  const extraction = await extractBounded(fixture, "https://fixture.invalid/article", { WorkerClass: AbortedWorker, signal: workerBudget.signal });
  assert.equal(extraction.status, "timeout");
  assert.equal(terminated, true);
  workerBudget.dispose();
});
await check("startup_error_is_worker_error", async () => {
  assert.equal(readabilityOutcome({ status: "startup_error" }), "worker_error");
  assert.equal(readabilityOutcome({ status: "worker_error" }), "worker_error");
  assert.equal(readabilityOutcome({ status: "complete", readabilityStatus: "empty" }), "empty");
});
await check("redirect_limit_and_no_backfill_dedupe", async () => {
  assert.equal(mayFollowRedirect(5), false);
  const result = dedupeFirst([{ googleNewsUrl: "a" }, { googleNewsUrl: "a" }, { googleNewsUrl: "b" }]);
  assert.equal(result.duplicateCount, 1); assert.deepEqual(result.unique, [{ googleNewsUrl: "a" }, { googleNewsUrl: "b" }]);
});
await check("per_host_pacing_reserves_250ms", async () => {
  const waits = [];
  assert.equal(await paceHost("pace-fixture.invalid", 1000, 250, async (ms) => waits.push(ms)), 0);
  assert.equal(await paceHost("pace-fixture.invalid", 1000, 250, async (ms) => waits.push(ms)), 250);
  assert.deepEqual(waits, [250]);
});
await check("four_worker_concurrency_ceiling", async () => {
  let active = 0, peak = 0;
  await mapLimit(Array.from({ length: 16 }), LIMITS.concurrency, async () => { active++; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 2)); active--; });
  assert.equal(peak, 4);
});
await check("streamed_prefix_cap", async () => {
  const stream = Readable.from([Buffer.alloc(LIMITS.prefixBytes + 1, 97)]);
  stream.headers = { "content-length": String(LIMITS.prefixBytes + 1), "content-encoding": "identity" };
  const result = await boundedPrefix(stream, LIMITS.prefixBytes);
  assert.equal(result.capped, true); assert.equal(result.bytes, LIMITS.prefixBytes); assert.equal(result.html.length, LIMITS.prefixBytes);
});
await check("direct_mozilla_readability_and_structured_fixture", async () => {
  const result = await extractBounded(fixture, "https://fixture.invalid/article");
  assert.equal(result.status, "complete"); assert.equal(result.readabilityStatus, "success"); assert.ok(result.readabilityWords >= 20);
  assert.notEqual(result.status, "network_attempt");
  assert.equal(result.structuredStatus, "present"); assert.ok(result.structuredWords > 0); assert.ok(result.elapsedMs < LIMITS.workerDeadlineMs);
});
await check("cumulative_structured_script_cap", async () => {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({ "@type": "NewsArticle", articleBody: "x".repeat(LIMITS.structuredBytes + 1) })}</script></head><body><article><h1>Long fixture</h1><p>${"word ".repeat(200)}</p></article></body></html>`;
  assert.ok(Buffer.byteLength(html) < LIMITS.prefixBytes);
  const result = await extractBounded(html, "https://fixture.invalid/article");
  assert.equal(result.structuredStatus, "cap");
});
await check("dom_element_cap", async () => {
  const html = `<html><body>${"<i></i>".repeat(LIMITS.maxDomElements)}</body></html>`;
  const result = await extractBounded(html, "https://fixture.invalid/article");
  assert.equal(result.status, "dom_limit");
});
await check("readability_output_cap", async () => {
  const html = `<html><body><article><h1>Large article</h1><p>${"x ".repeat(50001)}</p></article></body></html>`;
  const result = await extractBounded(html, "https://fixture.invalid/article");
  assert.equal(result.status, "output_limit"); assert.equal(result.outputChars, LIMITS.maxOutputChars);
});
await check("worker_deadline_terminates", async () => {
  class HungWorker extends EventEmitter { terminated = false; async terminate() { this.terminated = true; } }
  let instance;
  class WorkerClass extends HungWorker { constructor() { super(); instance = this; } }
  const result = await extractBounded(fixture, "https://fixture.invalid/article", { WorkerClass, deadlineMs: 20 });
  assert.equal(result.status, "timeout"); assert.equal(instance.terminated, true);
});
await check("aggregate_complete_and_threshold", async () => {
  const aggregate = buildAggregate(cohort());
  assert.equal(aggregate.uniqueRows, 100); assert.equal(aggregate.eligibleRows, 100); assert.equal(aggregate.readabilitySuccesses, 100); assert.equal(aggregate.decision, "signal_threshold_met");
  const noRobotsFile = cohort(); noRobotsFile[0] = { ...noRobotsFile[0], robots: "not_found" };
  assert.equal(buildAggregate(noRobotsFile).eligibleRows, 100);
  const belowSignal = cohort().map((item) => ({ ...item, readability: "empty", readabilityWords: 0 }));
  assert.equal(buildAggregate(belowSignal).decision, "signal_threshold_not_met");
  const contradictoryWords = cohort(); contradictoryWords[0] = { ...contradictoryWords[0], readabilityWords: 0 };
  assert.throws(() => buildAggregate(contradictoryWords), /word_count_mismatch/);
  const ineligibleStructured = cohort(); ineligibleStructured[0] = { ...ineligibleStructured[0], robots: "unavailable", readability: "empty", readabilityWords: 0 };
  assert.throws(() => buildAggregate(ineligibleStructured), /structured_success_without_eligible/);
  const malformedSuccess = cohort(); malformedSuccess[0] = { ...malformedSuccess[0], robots: "unavailable" };
  assert.throws(() => buildAggregate(malformedSuccess), /success_without_eligible/);
  const short = cohort(); short[1] = { ...short[1], candidate: "duplicate", robots: "not_checked", fetch: "not_attempted", readability: "not_attempted", readabilityWords: 0, structured: "not_attempted", structuredWords: 0, prefix: "unavailable", elapsed: "unavailable", dom: "unavailable", workerTime: "unavailable" };
  assert.equal(buildAggregate(short).decision, "inconclusive_short_cohort");
});
await check("aggregate_privacy_and_reconciliation_before_sink", async () => {
  let writes = 0;
  const aggregate = await persistAggregateOnly(cohort(), async () => { writes++; }); assert.equal(writes, 1); validateAggregate(aggregate);
  writes = 0; await assert.rejects(() => persistAggregateOnly(cohort().slice(0, 99), async () => { writes++; })); assert.equal(writes, 0);
  const tainted = cohort(); tainted[0].googleNewsUrl = sentinelUrl; await assert.rejects(() => persistAggregateOnly(tainted, async () => { writes++; })); assert.equal(writes, 0);
  const taintedText = cohort(); taintedText[0].title = sentinelText; await assert.rejects(() => persistAggregateOnly(taintedText, async () => { writes++; })); assert.equal(writes, 0);
  const broken = buildAggregate(cohort()); broken.uniqueRows--;
  assert.throws(() => validateAggregate(broken), /reconciliation/);
});
await check("hosted_run_gate_values_are_exact", async () => {
  const good = { buildNumber: "10.0.7", options: { build: "10.0.7", maxTotalChargeUsd: 1, memoryMbytes: 256, timeoutSecs: 900, restartOnError: false } };
  const privateActor = { isPublic: false, actorPermissionLevel: "LIMITED_PERMISSIONS" };
  assert.equal(verifyFutureRunGates({ actor: privateActor, run: good }, "10.0.7").valid, true);
  assert.equal(verifyFutureRunGates({ actor: { ...privateActor, isPublic: true }, run: good }, "10.0.7").valid, false);
  assert.equal(verifyFutureRunGates({ actor: privateActor, run: { ...good, options: { ...good.options, maxTotalChargeUsd: 2 } } }, "10.0.7").valid, false);
});
await check("hosted_runtime_environment_gate_fails_closed", async () => {
  const processEnv = { APIFY_IS_AT_HOME: "1", ACTOR_RUN_ID: "run_12345678", ACTOR_BUILD_ID: "build_12345678", ACTOR_BUILD_NUMBER: "1.2.34", ACTOR_PERMISSION_LEVEL: "LIMITED_PERMISSIONS", ACTOR_MEMORY_MBYTES: "256", ACTOR_STARTED_AT: "2026-10-01T00:00:00.000Z", ACTOR_TIMEOUT_AT: "2026-10-01T00:15:00.000Z", ACTOR_MAX_TOTAL_CHARGE_USD: "1", ACTOR_RESTART_ON_ERROR: "0" };
  const actorEnv = { isAtHome: "1", actorRunId: processEnv.ACTOR_RUN_ID, actorBuildId: processEnv.ACTOR_BUILD_ID, actorBuildNumber: processEnv.ACTOR_BUILD_NUMBER, memoryMbytes: 256, startedAt: new Date(processEnv.ACTOR_STARTED_AT), timeoutAt: new Date(processEnv.ACTOR_TIMEOUT_AT) };
  assert.equal(inspectHostedRunGate({ actorEnv, processEnv }).valid, true);
  assert.doesNotThrow(() => assertHostedRunGate({ actorEnv, processEnv }));
  for (const key of ["APIFY_IS_AT_HOME", "ACTOR_RUN_ID", "ACTOR_BUILD_ID", "ACTOR_BUILD_NUMBER", "ACTOR_PERMISSION_LEVEL", "ACTOR_MEMORY_MBYTES", "ACTOR_STARTED_AT", "ACTOR_TIMEOUT_AT", "ACTOR_MAX_TOTAL_CHARGE_USD", "ACTOR_RESTART_ON_ERROR"]) {
    const absent = { ...processEnv }; delete absent[key];
    assert.equal(inspectHostedRunGate({ actorEnv, processEnv: absent }).valid, false, `missing ${key} must fail closed`);
  }
  assert.equal(inspectHostedRunGate({ actorEnv: { ...actorEnv, actorRunId: "run_87654321" }, processEnv }).checks.runIdMatchesEnvironment, false);
  assert.equal(inspectHostedRunGate({ actorEnv: { ...actorEnv, actorBuildId: "build_87654321" }, processEnv }).checks.buildIdMatchesEnvironment, false);
  assert.throws(() => assertHostedRunGate({ actorEnv: {}, processEnv: {} }), (error) => error.code === "HOSTED_RUN_GATE_FAILED" && !error.message.includes(processEnv.ACTOR_RUN_ID));
});
await check("runtime_gate_precedes_actor_initialization_and_probe", async () => {
  let initialized = 0, executed = 0;
  const { runActorSafely } = await import("./probe.mjs");
  const result = await runActorSafely({ getEnv: () => ({}), env: {}, init: async () => { initialized++; }, execute: async () => { executed++; return {}; }, exit: async () => {} });
  assert.equal(result, false); assert.equal(initialized, 0); assert.equal(executed, 0);
});
await check("runtime_launch_and_approval_finish_before_probe_execution", async () => {
  const processEnv = { APIFY_IS_AT_HOME: "1", ACTOR_ID: "actor_12345678", ACTOR_RUN_ID: "run_12345678", ACTOR_BUILD_ID: "build_12345678", ACTOR_BUILD_NUMBER: "1.2.34", ACTOR_PERMISSION_LEVEL: "LIMITED_PERMISSIONS", ACTOR_MEMORY_MBYTES: "256", ACTOR_STARTED_AT: "2026-10-01T00:00:00.000Z", ACTOR_TIMEOUT_AT: "2026-10-01T00:15:00.000Z", ACTOR_MAX_TOTAL_CHARGE_USD: "1", ACTOR_RESTART_ON_ERROR: "0" };
  const actorEnv = { isAtHome: "1", actorId: processEnv.ACTOR_ID, actorRunId: processEnv.ACTOR_RUN_ID, actorBuildId: processEnv.ACTOR_BUILD_ID, actorBuildNumber: processEnv.ACTOR_BUILD_NUMBER, memoryMbytes: 256, startedAt: new Date(processEnv.ACTOR_STARTED_AT), timeoutAt: new Date(processEnv.ACTOR_TIMEOUT_AT) };
  const input = { i10LaunchMarker: "123e4567-e89b-42d3-a456-426614174000", expectedActorId: processEnv.ACTOR_ID, expectedBuildId: processEnv.ACTOR_BUILD_ID, expectedBuildNumber: processEnv.ACTOR_BUILD_NUMBER };
  const gate = { schemaVersion: "i10-run-approval-v1", marker: input.i10LaunchMarker, actorId: input.expectedActorId, buildId: input.expectedBuildId, buildNumber: input.expectedBuildNumber, runId: processEnv.ACTOR_RUN_ID };
  const { runActorSafely } = await import("./probe.mjs");
  const calls = []; let executed = 0;
  const result = await runActorSafely({ getEnv: () => { calls.push("env"); return actorEnv; }, env: processEnv, init: async () => calls.push("init"), getInput: async () => { calls.push("input"); return input; }, getApprovalRecord: async () => { calls.push("approval"); return gate; }, execute: async () => { calls.push("execute"); executed++; return {}; }, exit: async () => calls.push("exit"), log: () => {} });
  assert.equal(result, true); assert.equal(executed, 1); assert.deepEqual(calls, ["env", "init", "input", "env", "approval", "execute", "exit"]);
  calls.length = 0; executed = 0;
  const failed = await runActorSafely({ getEnv: () => { calls.push("env"); return actorEnv; }, env: processEnv, init: async () => calls.push("init"), getInput: async () => { calls.push("input"); return input; }, getApprovalRecord: async () => { calls.push("approval"); return null; }, approvalWait: async ({ getRecord, expected }) => waitForRunApproval({ getRecord, expected, timeoutMs: 2, pollMs: 1, clock: (() => { let now = 0; return () => now; })(), sleep: async () => { throw new Error("approval_wait_interrupted"); } }), execute: async () => { calls.push("execute"); executed++; return {}; }, exit: async () => calls.push("exit"), log: () => {} });
  assert.equal(failed, false); assert.equal(executed, 0); assert.deepEqual(calls, ["env", "init", "input", "env", "approval", "exit"]);
});
await check("launch_tuple_and_approval_gate_fail_closed_and_wait_for_delayed_record", async () => {
  const processEnv = { ACTOR_ID: "actor_12345678", ACTOR_RUN_ID: "run_12345678", ACTOR_BUILD_ID: "build_12345678", ACTOR_BUILD_NUMBER: "10.0.7" };
  const actorEnv = { actorRunId: processEnv.ACTOR_RUN_ID, actorBuildId: processEnv.ACTOR_BUILD_ID, actorBuildNumber: processEnv.ACTOR_BUILD_NUMBER };
  const input = { i10LaunchMarker: "123e4567-e89b-42d3-a456-426614174000", expectedActorId: processEnv.ACTOR_ID, expectedBuildId: processEnv.ACTOR_BUILD_ID, expectedBuildNumber: processEnv.ACTOR_BUILD_NUMBER };
  assert.equal(inspectLaunchTuple({ input, actorEnv, processEnv }).valid, true);
  assert.equal(inspectLaunchTuple({ input: { ...input, expectedBuildNumber: "10.0.6" }, actorEnv, processEnv }).valid, false);
  const expected = { marker: input.i10LaunchMarker, actorId: processEnv.ACTOR_ID, buildId: processEnv.ACTOR_BUILD_ID, buildNumber: processEnv.ACTOR_BUILD_NUMBER, runId: processEnv.ACTOR_RUN_ID };
  const approved = { schemaVersion: "i10-run-approval-v1", marker: expected.marker, actorId: expected.actorId, buildId: expected.buildId, buildNumber: expected.buildNumber, runId: expected.runId };
  assert.equal(approvalRecordMatches(approved, expected), true);
  assert.equal(approvalRecordMatches({ ...approved, runId: "run_87654321" }, expected), false);
  let polls = 0;
  assert.equal(await waitForRunApproval({ getRecord: async () => ++polls < 3 ? null : approved, expected, timeoutMs: 1000, pollMs: 1 }), true);
  let fakeNow = 0;
  await assert.rejects(() => waitForRunApproval({ getRecord: async () => null, expected, timeoutMs: 2, pollMs: 1, clock: () => fakeNow, sleep: async (ms) => { fakeNow += ms; } }), /run_approval_record_timeout/);
  await assert.rejects(() => waitForRunApproval({ getRecord: async () => ({ ...approved, marker: "123e4567-e89b-42d3-a456-426614174001" }), expected, timeoutMs: 1000, pollMs: 1 }), /run_approval_record_mismatch/);
});
await check("hosted_controller_exact_build_readback_gate_and_delayed_visibility", async () => {
  const plan = await createHostedRunPlan({ sourceRoot: resolve(here, "..") });
  assert.equal(plan.actor.isPublic, false); assert.equal(Object.hasOwn(plan.actor, "actorPermissionLevel"), false);
  assert.deepEqual(plan.actor.versions, [plan.version]);
  assert.equal(plan.actor.defaultRunOptions.forcePermissionLevel, "LIMITED_PERMISSIONS");
  assert.equal(plan.actor.defaultRunOptions.memoryMbytes, 256); assert.equal(plan.actor.defaultRunOptions.timeoutSecs, 900);
  assert.equal(plan.run.maxTotalChargeUsd, 1); assert.equal(plan.actor.defaultRunOptions.restartOnError, false);
  assert.equal(plan.run.build, null); assert.ok(plan.sourcePaths.includes("src/runtime-gate.mjs"));
  assert.equal(hashSourceFiles(plan.version.sourceFiles), plan.sourceManifestSha256);
  const calls = []; let startAttempts = 0, gateReads = 0, submittedInput;
  const actor = { id: "actor_12345678", isPublic: false, actorPermissionLevel: "LIMITED_PERMISSIONS" };
  const build = { id: "build_12345678", buildNumber: "10.0.7", status: "SUCCEEDED", actVersion: plan.version };
  const run = { id: "run_12345678", buildId: build.id, buildNumber: build.buildNumber, options: { ...plan.run, build: build.buildNumber } };
  const api = {
    createPrivateActor: async (settings) => {
      calls.push("createActor"); assert.equal(settings.isPublic, false);
      assert.deepEqual(settings.versions, [plan.version]);
      assert.equal(Object.hasOwn(settings, "actorPermissionLevel"), false);
      assert.equal(settings.defaultRunOptions.forcePermissionLevel, "LIMITED_PERMISSIONS");
      return actor;
    },
    getVersion: async () => { calls.push("getVersion"); return plan.version; },
    buildVersion: async (_id, versionNumber) => { calls.push("buildVersion"); assert.equal(versionNumber, plan.version.versionNumber); return { id: build.id }; },
    waitForBuild: async (_id, buildId) => { calls.push("waitForBuild"); assert.equal(buildId, build.id); return build; },
    getActor: async () => { calls.push("getActor"); return actor; },
    startRun: async (_id, options) => { calls.push("startRun"); startAttempts++; const { input, ...runOptions } = options; submittedInput = input; assert.deepEqual(runOptions, { ...plan.run, build: build.buildNumber }); return run; },
    findRunsSince: async () => [],
    getRun: async () => { calls.push("getRun"); return run; },
    getRunInput: async () => { calls.push("getRunInput"); return submittedInput; },
    putRunGate: async (_runId, record) => { calls.push("putGate"); assert.equal(record.runId, run.id); },
    getRunGate: async () => { calls.push("getGate"); return ++gateReads < 2 ? null : { schemaVersion: "i10-run-approval-v1", marker: submittedInput.i10LaunchMarker, actorId: submittedInput.expectedActorId, buildId: submittedInput.expectedBuildId, buildNumber: submittedInput.expectedBuildNumber, runId: run.id }; },
    abortRun: async () => { calls.push("abortRun"); },
  };
  const outcome = await executeHostedRunPlan(plan, api, { sourceCheck: async () => ({ valid: true, sourceManifestSha256: plan.sourceManifestSha256 }) });
  assert.deepEqual(calls, ["createActor", "getVersion", "buildVersion", "waitForBuild", "getActor", "startRun", "getRun", "getRunInput", "getActor", "putGate", "getGate", "getGate"]);
  assert.equal(startAttempts, 1); assert.equal(outcome.status, "run_approved_after_readback"); assert.equal(outcome.buildNumber, build.buildNumber);
});
await check("hosted_controller_mismatch_no_gate_and_abort_confirmed", async () => {
  const plan = await createHostedRunPlan({ sourceRoot: resolve(here, "..") });
  const actor = { id: "actor_12345678", isPublic: false, actorPermissionLevel: "LIMITED_PERMISSIONS" };
  const build = { id: "build_12345678", buildNumber: "10.0.7", status: "SUCCEEDED", actVersion: plan.version };
  const run = { id: "run_12345678", buildId: "build_87654321", buildNumber: build.buildNumber, status: "RUNNING", options: { ...plan.run, build: build.buildNumber } };
  const calls = [];
  const api = {
    createPrivateActor: async () => actor, getVersion: async () => plan.version,
    buildVersion: async () => ({ id: build.id }), waitForBuild: async () => build, getActor: async () => actor,
    startRun: async () => run, getRun: async () => ({ ...run, status: "ABORTED" }), getRunInput: async () => ({}),
    findRunsSince: async () => [],
    putRunGate: async () => { calls.push("put"); }, getRunGate: async () => null, abortRun: async () => { calls.push("abort"); },
  };
  await assert.rejects(() => executeHostedRunPlan(plan, api, { sourceCheck: async () => ({ valid: true, sourceManifestSha256: plan.sourceManifestSha256 }) }), /run_readback_gate_failed/);
  assert.deepEqual(calls, ["abort"]);
});
await check("hosted_controller_ambiguous_post_never_retries_and_aborts_candidate", async () => {
  const plan = await createHostedRunPlan({ sourceRoot: resolve(here, "..") });
  const actor = { id: "actor_12345678", isPublic: false, actorPermissionLevel: "LIMITED_PERMISSIONS" };
  const build = { id: "build_12345678", buildNumber: "10.0.7", status: "SUCCEEDED", actVersion: plan.version };
  const run = { id: "run_12345678", status: "RUNNING" }, calls = []; let starts = 0, launchInput;
  const api = {
    createPrivateActor: async () => actor, getVersion: async () => plan.version,
    buildVersion: async () => ({ id: build.id }), waitForBuild: async () => build, getActor: async () => actor,
    startRun: async (_actorId, options) => { starts++; launchInput = options.input; throw new Error("ambiguous"); }, findRunsSince: async () => [run],
    abortRun: async () => { calls.push("abort"); }, getRun: async () => ({ ...run, status: "ABORTED" }),
    getRunInput: async () => { calls.push("reconcileMarker"); return launchInput; }, putRunGate: async () => calls.push("put"), getRunGate: async () => null,
  };
  await assert.rejects(() => executeHostedRunPlan(plan, api, { sourceCheck: async () => ({ valid: true, sourceManifestSha256: plan.sourceManifestSha256 }) }), /run_start_ambiguous_aborted_no_retry/);
  assert.equal(starts, 1); assert.deepEqual(calls, ["reconcileMarker", "abort"]);
});

await check("hosted_controller_reports_sanitized_actor_create_failure_context", async () => {
  const plan = await createHostedRunPlan({ sourceRoot: resolve(here, "..") });
  const failure = new Error("apify_http_request_failed");
  failure.diagnostic = { kind: "http_error", status: 400, apifyErrorType: "invalid-request", requestId: "request_123", requestTimestamp: "2026-10-01T00:00:00.000Z", endpoint: "acts" };
  const calls = [];
  await assert.rejects(() => executeHostedRunPlan(plan, {
    createPrivateActor: async () => { calls.push("create"); throw failure; },
    getVersion: async () => { calls.push("version"); },
    buildVersion: async () => {}, waitForBuild: async () => {}, getActor: async () => {}, startRun: async () => {},
    getRun: async () => {}, findRunsSince: async () => [], getRunInput: async () => {}, putRunGate: async () => {},
    getRunGate: async () => {}, abortRun: async () => {},
  }, { sourceCheck: async () => ({ valid: true, sourceManifestSha256: plan.sourceManifestSha256 }) }), (error) => {
    assert.equal(error.message, "actor_create_failed");
    assert.deepEqual(error.diagnostic, { stage: "actor_create", ...failure.diagnostic });
    assert.equal(JSON.stringify(error).includes("apify_http_request_failed"), false);
    assert.deepEqual(safeFailure(error), {
      status: "failed", error: "actor_create_failed",
      diagnostic: { stage: "actor_create", kind: "http_error", status: 400, apifyErrorType: "invalid-request", requestId: "request_123", requestTimestamp: "2026-10-01T00:00:00.000Z", endpoint: "acts" },
    });
    return true;
  });
  assert.deepEqual(calls, ["create"]);
});

await check("source_snapshot_byte_equality_and_gate_before_api", async () => {
  assert.equal(sourceSnapshotsEqual(planlessSnapshot("a\n"), planlessSnapshot("a\n")), true);
  assert.equal(sourceSnapshotsEqual(planlessSnapshot("a\n"), planlessSnapshot("a\r\n")), false);
  const calls = [];
  await assert.rejects(() => executeHostedRunPlan({ sourceManifestSha256: "expected" }, {
    createPrivateActor: async () => { calls.push("create"); },
  }, { sourceCheck: async () => ({ valid: false, sourceManifestSha256: "wrong" }) }), /source_continuity_gate_failed/);
  assert.deepEqual(calls, []);
});

await check("apify_cli_adapter_create_payload_includes_reviewed_version_and_supported_permission_fields", async () => {
  const calls = [];
  const adapter = await createApifyCliAdapter({ commandPath: "fixture-apify-cli", execute: async (command, args, input) => {
    calls.push({ command, args, input });
    return JSON.stringify({ data: { id: "actor_12345678", isPublic: false, actorPermissionLevel: "LIMITED_PERMISSIONS", token: "must-not-escape" } });
  } });
  const version = { versionNumber: "10.0", sourceType: "SOURCE_FILES", sourceFiles: [{ name: "src/main.js", format: "TEXT", content: "export {};" }] };
  const actorSettings = { name: "test", isPublic: false, versions: [version], defaultRunOptions: { build: "10.0", memoryMbytes: 256, timeoutSecs: 900, restartOnError: false, forcePermissionLevel: "LIMITED_PERMISSIONS" } };
  const actor = await adapter.createPrivateActor(actorSettings);
  assert.deepEqual(actor, { id: "actor_12345678", isPublic: false, actorPermissionLevel: "LIMITED_PERMISSIONS" });
  assert.deepEqual(calls[0].args, ["api", "POST", "acts", "-d", "-"]);
  assert.deepEqual(JSON.parse(calls[0].input), actorSettings);
  assert.equal(Object.hasOwn(JSON.parse(calls[0].input), "actorPermissionLevel"), false);
  assert.equal(JSON.stringify(actor).includes("must-not-escape"), false);
});
await check("apify_cli_adapter_passes_run_input_and_gate_record_endpoints", async () => {
  const calls = [];
  const adapter = await createApifyCliAdapter({ commandPath: "fixture-apify-cli", execute: async (_command, args, input) => {
    calls.push({ args, input });
    if (args[2].endsWith("/runs")) return JSON.stringify({ data: { id: "run_12345678" } });
    return JSON.stringify({ data: {} });
  } });
  const payload = { i10LaunchMarker: "123e4567-e89b-42d3-a456-426614174000", expectedActorId: "actor_12345678", expectedBuildId: "build_12345678", expectedBuildNumber: "10.0.7" };
  await adapter.startRun("actor_12345678", { build: "10.0.7", memoryMbytes: 256, timeoutSecs: 900, maxTotalChargeUsd: 1, restartOnError: false, forcePermissionLevel: "LIMITED_PERMISSIONS", input: payload });
  await adapter.putRunGate("run_12345678", { schemaVersion: "i10-run-approval-v1" });
  assert.deepEqual(calls[0].args, ["api", "POST", "acts/actor_12345678/runs", "-p", JSON.stringify({ build: "10.0.7", memoryMbytes: 256, timeoutSecs: 900, maxTotalChargeUsd: 1, restartOnError: false, forcePermissionLevel: "LIMITED_PERMISSIONS" }), "-d", "-"]);
  assert.deepEqual(JSON.parse(calls[0].input), payload);
  assert.deepEqual(calls[1].args, ["api", "PUT", "actor-runs/run_12345678/key-value-store/records/I10_GATE", "-d", "-"]);
});

await check("apify_child_is_shell_free_and_stderr_is_discarded", async () => {
  let options, received = "";
  class FakeChild extends EventEmitter { constructor() { super(); this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); } kill() {} }
  const child = new FakeChild();
  child.stdin.on("data", (chunk) => { received += chunk.toString("utf8"); });
  child.stdin.once("finish", () => {
    child.stdout.end('{"ok":true}');
    child.stderr.end("APIFY_TOKEN=credential-sentinel");
    setTimeout(() => child.emit("close", 0), 5);
  });
  const output = await runApifyCli("apify-cli", ["api", "GET", "users/me"], "safe-body", { spawnProcess: (_command, _args, spawnOptions) => { options = spawnOptions; return child; } });
  assert.equal(options.shell, false);
  assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
  assert.equal(received, "safe-body");
  assert.equal(output, '{"ok":true}');
  assert.equal(output.includes("credential-sentinel"), false);
});

await check("apify_process_and_http_diagnostics_are_sanitized", async () => {
  await assert.rejects(() => runApifyCli("fixture", [], undefined, {
    spawnProcess: () => { const error = new Error("private command path"); error.code = "ENOENT"; throw error; },
  }), (error) => {
    assert.deepEqual(error.diagnostic, { kind: "local_process_error", code: "ENOENT" });
    assert.equal(error.message, "apify_process_ENOENT");
    assert.equal(error.message.includes("private command path"), false);
    return true;
  });

  class FailedChild extends EventEmitter { constructor() { super(); this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); } kill() {} }
  const child = new FailedChild();
  const failed = runApifyCli("fixture", [], undefined, { spawnProcess: () => child });
  child.stdin.once("finish", () => {
    child.stderr.end('HTTP 404 Not Found {"error":{"type":"NotFound","message":"private response"},"token":"credential-sentinel"}');
    setTimeout(() => child.emit("close", 1), 5);
  });
  await assert.rejects(failed, (error) => {
    assert.deepEqual(error.diagnostic, { kind: "http_error", status: 404, exitCode: 1, apifyErrorType: "NotFound" });
    assert.equal(error.message, "apify_http_request_failed");
    assert.equal(JSON.stringify(error).includes("credential-sentinel"), false);
    return true;
  });
});

await check("apify_error_metadata_is_allowlisted_and_sanitized", async () => {
  class FailedChild extends EventEmitter { constructor() { super(); this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); } kill() {} }
  const child = new FailedChild();
  const failed = runApifyCli("fixture", [], undefined, { spawnProcess: () => child });
  child.stdin.once("finish", () => {
    child.stderr.end('HTTP 400 Bad Request {"error":{"type":"invalid-request","message":"APIFY_TOKEN=credential-sentinel"},"requestId":"request_123","timestamp":"2026-10-01T00:00:00.000Z"}');
    setTimeout(() => child.emit("close", 1), 5);
  });
  await assert.rejects(failed, (error) => {
    assert.deepEqual(error.diagnostic, { kind: "http_error", status: 400, exitCode: 1, apifyErrorType: "invalid-request", requestId: "request_123", apifyTimestamp: "2026-10-01T00:00:00.000Z" });
    assert.equal(JSON.stringify(error).includes("credential-sentinel"), false);
    assert.equal(JSON.stringify(error).includes("message"), false);
    return true;
  });
});

await check("apify_create_schema_validation_paths_are_sanitized_and_survive_launch_formatting", async () => {
  class FailedChild extends EventEmitter { constructor() { super(); this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); } kill() {} }
  const child = new FailedChild();
  const failed = runApifyCli("fixture", [], undefined, { spawnProcess: () => child });
  child.stdin.once("finish", () => {
    child.stderr.end('HTTP 400 Bad Request {"error":{"type":"schema-validation","message":"defaultRunOptions.timeoutSecs is invalid; APIFY_TOKEN=credential-sentinel","details":[{"field":"versions.0.sourceType","code":"invalid_enum","message":"private sourceType details"},{"path":"defaultRunOptions.timeoutSecs","code":"invalid_type","message":"private type details"},{"path":"secret.token","code":"required","message":"must stay private"}]},"requestId":"request_789"}');
    setTimeout(() => child.emit("close", 1), 5);
  });
  await assert.rejects(failed, (error) => {
    assert.deepEqual(error.diagnostic.validationIssues, [
      { fieldPath: "versions.0.sourceType", reasonCategory: "invalid_choice" },
      { fieldPath: "defaultRunOptions.timeoutSecs", reasonCategory: "invalid_type" },
    ]);
    assert.equal(JSON.stringify(error.diagnostic).includes("credential-sentinel"), false);
    assert.equal(JSON.stringify(error.diagnostic).includes("private"), false);
    assert.equal(JSON.stringify(error.diagnostic).includes("secret.token"), false);

    const formatted = safeFailure(Object.assign(new Error("actor_create_failed"), {
      diagnostic: { stage: "actor_create", ...error.diagnostic, method: "POST", endpoint: "acts" },
    }));
    assert.deepEqual(formatted.diagnostic.validationIssues, error.diagnostic.validationIssues);
    assert.equal(JSON.stringify(formatted).includes("credential-sentinel"), false);
    return true;
  });
});

await check("apify_schema_validation_free_text_returns_only_known_field_path_and_category", async () => {
  class FailedChild extends EventEmitter { constructor() { super(); this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); } kill() {} }
  const child = new FailedChild();
  const failed = runApifyCli("fixture", [], undefined, { spawnProcess: () => child });
  child.stdin.once("finish", () => {
    child.stdout.end(JSON.stringify({ statusCode: 400, error: { type: "schema-validation", message: "Property defaultRunOptions.timeoutSecs must be a number. Input APIFY_TOKEN=credential-sentinel" } }));
    setTimeout(() => child.emit("close", 1), 5);
  });
  await assert.rejects(failed, (error) => {
    assert.deepEqual(error.diagnostic.validationIssues, [{ fieldPath: "defaultRunOptions.timeoutSecs", reasonCategory: "invalid_type" }]);
    assert.equal(JSON.stringify(error.diagnostic).includes("credential-sentinel"), false);
    return true;
  });
});

await check("apify_cli_nonzero_stdout_json_error_is_sanitized_and_survives_launch_formatting", async () => {
  class FailedChild extends EventEmitter { constructor() { super(); this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); } kill() {} }
  const child = new FailedChild();
  const failed = runApifyCli("fixture", [], "{\"safe\":true}", { spawnProcess: () => child });
  child.stdin.once("finish", () => {
    child.stdout.end(JSON.stringify({ statusCode: 400, error: { type: "invalid-request", code: "INVALID_INPUT", message: "private response APIFY_TOKEN=credential-sentinel" }, requestId: "request_456", timestamp: "2026-10-01T00:00:00.000Z" }));
    child.stderr.end("private stderr APIFY_TOKEN=stderr-sentinel");
    setTimeout(() => child.emit("close", 2, null), 5);
  });
  await assert.rejects(failed, (error) => {
    assert.deepEqual(error.diagnostic, { kind: "http_error", status: 400, exitCode: 2, apifyErrorType: "invalid-request", apifyErrorCode: "INVALID_INPUT", requestId: "request_456", apifyTimestamp: "2026-10-01T00:00:00.000Z" });
    assert.equal(error.message, "apify_http_request_failed");
    assert.equal(JSON.stringify(error).includes("credential-sentinel"), false);
    assert.equal(JSON.stringify(error).includes("private response"), false);
    return true;
  });

  const api = await createApifyCliAdapter({ commandPath: "fixture", execute: async () => { const error = new Error("apify_http_request_failed"); error.diagnostic = { kind: "http_error", status: 400, exitCode: 2, apifyErrorType: "invalid-request", apifyErrorCode: "INVALID_INPUT", requestId: "request_456" }; throw error; } });
  await assert.rejects(() => api.createPrivateActor({ name: "fixture" }), (error) => {
    assert.equal(error.message, "apify_http_request_failed");
    assert.equal(error.diagnostic.kind, "http_error");
    assert.equal(error.diagnostic.status, 400);
    assert.equal(error.diagnostic.apifyErrorCode, "INVALID_INPUT");
    assert.equal(error.diagnostic.endpoint, "acts");
    const formatted = safeFailure(Object.assign(new Error("actor_create_failed"), { diagnostic: { stage: "actor_create", ...error.diagnostic } }));
    assert.equal(formatted.diagnostic.apifyErrorCode, "INVALID_INPUT");
    assert.equal(formatted.diagnostic.endpoint, "acts");
    return true;
  });

  const apiFailureChild = new FailedChild();
  const apiFailure = runApifyCli("fixture", [], undefined, { spawnProcess: () => apiFailureChild });
  apiFailureChild.stdin.once("finish", () => {
    apiFailureChild.stdout.end(JSON.stringify({ error: { type: "page-not-found", code: "ROUTE_ABSENT", message: "discard this" }, token: "credential-sentinel" }));
    setTimeout(() => apiFailureChild.emit("close", 1, null), 5);
  });
  await assert.rejects(apiFailure, (error) => {
    assert.equal(error.message, "apify_api_error");
    assert.deepEqual(error.diagnostic, { kind: "api_error", exitCode: 1, apifyErrorType: "page-not-found", apifyErrorCode: "ROUTE_ABSENT" });
    assert.equal(JSON.stringify(error).includes("credential-sentinel"), false);
    return true;
  });
});

await check("apify_timeout_waits_for_child_close_before_settling", async () => {
  class SlowTerminationChild extends EventEmitter { constructor() { super(); this.stdin = new PassThrough(); this.stdout = new PassThrough(); this.stderr = new PassThrough(); } kill() { setTimeout(() => this.emit("close", null), 20); } }
  const child = new SlowTerminationChild(), startedAt = Date.now();
  await assert.rejects(() => runApifyCli("fixture", [], undefined, { spawnProcess: () => child, timeoutMs: 1 }), /apify_cli_timeout/);
  assert.ok(Date.now() - startedAt >= 15, "timeout settled before the child close event");
});

assert.equal(checks.length, 36);
const elapsedMs = Date.now() - started;
assert.ok(elapsedMs <= 90000, "preflight exceeded 90 seconds");
clearInterval(rssSampler);
assert.ok(peakRssBytes <= 256 * 1024 * 1024, "preflight exceeded 256 MiB RSS");
const pkg = JSON.parse(await readFile(join(here, "../package.json"), "utf8"));
assert.equal(pkg.dependencies["@mozilla/readability"], "0.6.0");
assert.equal(pkg.dependencies.linkedom, "0.18.13");
const sourcePlan = await createHostedRunPlan({ sourceRoot: resolve(here, "..") });
const sourceManifestSha256 = sourcePlan.sourceManifestSha256;
const lockSha256 = createHash("sha256").update(await readFile(join(here, "../package-lock.json"))).digest("hex");
const report = {
  schemaVersion: "issue22-iteration10-offline-preflight-v1", status: "passed", nodeVersion: process.version,
  readabilityVersion: "0.6.0", domAdapter: "linkedom@0.18.13", plannedCheckCount: 36,
  completedCheckCount: checks.length, totalElapsedMs: elapsedMs, totalDeadlineMs: 90000,
  configured: { ...LIMITS, networkRetries: NETWORK_RETRIES, runtimeImage: "apify/actor-node:20", hostedRunStarted: false },
  packageLockSha256: lockSha256, sourceManifestSha256,
  peakRssBytes, networkProbeAttempts: networkAttempts, aggregateSinkChecks: { completeWrites: 1, partialWrites: 0, privacyViolationWrites: 0 },
  checks,
};
const raw = JSON.stringify(report);
assert.ok(!raw.includes(sentinelUrl) && !raw.includes(sentinelText));
assert.equal(networkAttempts, 0);
await writeFile(join(here, "../preflight-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`I10 offline preflight passed: ${checks.length} checks in ${elapsedMs} ms; no probe network attempts; no hosted run.`);
