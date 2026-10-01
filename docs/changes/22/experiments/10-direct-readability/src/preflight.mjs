import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import process from "node:process";
import { LIMITS, NETWORK_RETRIES, addressIsPublic, boundedPrefix, dedupeFirst, mayFollowRedirect, paceHost, pinnedLookup, resolvePublicTarget, robotsAllows } from "./network.mjs";
import { extractBounded } from "./extract.mjs";
import { buildAggregate, persistAggregateOnly, validateAggregate } from "./aggregate.mjs";
import { verifyFutureRunGates } from "./verify-run-options.mjs";
import { mapLimit } from "./probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const started = Date.now(), checks = [];
let peakRssBytes = process.memoryUsage().rss;
const rssSampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 10);
rssSampler.unref();
async function check(id, fn) { await fn(); checks.push({ id, status: "passed" }); }
function row(cellIndex, slot) {
  return { cellId: `q${Math.floor(cellIndex / 2) + 1}-${cellIndex % 2 ? "us" : "gb"}`, slot, candidate: "resolved", robots: "allowed", fetch: "http_2xx_html", readability: "success", structured: "present", prefix: "not_capped", elapsed: "100_to_lt_500ms", dom: "lt_1k", workerTime: "100_to_lt_500ms" };
}
function cohort() { return Array.from({ length: 100 }, (_, i) => row(Math.floor(i / 10), i % 10 + 1)); }
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
  assert.deepEqual(LIMITS, { timeoutMs: 10000, maxRedirects: 5, prefixBytes: 524288, structuredBytes: 65536, maxDomElements: 10000, maxOutputChars: 100000, concurrency: 4, perHostDelayMs: 250, workerDeadlineMs: 5000, softStopMs: 780000, maxRows: 100 });
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
await check("robots_allow_deny_and_disallow_unknown", async () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/a"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/public/a"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow:", "/article"), true);
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
  const belowSignal = cohort().map((item) => ({ ...item, readability: "empty" }));
  assert.equal(buildAggregate(belowSignal).decision, "signal_threshold_not_met");
  const short = cohort(); short[1] = { ...short[1], candidate: "duplicate", robots: "not_checked", fetch: "not_attempted", readability: "not_attempted", structured: "not_attempted", prefix: "unavailable", elapsed: "unavailable", dom: "unavailable", workerTime: "unavailable" };
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
  const good = { buildNumber: "i10.1", options: { build: "i10.1", maxTotalChargeUsd: 1, isMaxTotalChargeUsdSetByUser: true, memoryMbytes: 256, timeoutSecs: 900, restartOnError: false } };
  const privateActor = { visibility: "PRIVATE", permissionLevel: "LIMITED_PERMISSIONS" };
  assert.equal(verifyFutureRunGates({ actor: privateActor, run: good }, "i10.1").valid, true);
  assert.equal(verifyFutureRunGates({ actor: { ...privateActor, visibility: "PUBLIC" }, run: good }, "i10.1").valid, false);
  assert.equal(verifyFutureRunGates({ actor: privateActor, run: { ...good, options: { ...good.options, isMaxTotalChargeUsdSetByUser: false } } }, "i10.1").valid, false);
});

assert.equal(checks.length, 15);
const elapsedMs = Date.now() - started;
assert.ok(elapsedMs <= 90000, "preflight exceeded 90 seconds");
clearInterval(rssSampler);
assert.ok(peakRssBytes <= 256 * 1024 * 1024, "preflight exceeded 256 MiB RSS");
const pkg = JSON.parse(await readFile(join(here, "../package.json"), "utf8"));
assert.equal(pkg.dependencies["@mozilla/readability"], "0.6.0");
assert.equal(pkg.dependencies.linkedom, "0.18.13");
const sourcePaths = ["../Dockerfile", "../package.json", "../package-lock.json", "./aggregate.mjs", "./extract-worker.mjs", "./extract.mjs", "./network.mjs", "./probe.mjs", "./preflight.mjs", "./verify-run-options.mjs"];
const sourceParts = [];
for (const path of sourcePaths) sourceParts.push(`${path}\0${createHash("sha256").update(await readFile(join(here, path))).digest("hex")}\n`);
const sourceManifestSha256 = createHash("sha256").update(sourceParts.join("")).digest("hex");
const lockSha256 = createHash("sha256").update(await readFile(join(here, "../package-lock.json"))).digest("hex");
const report = {
  schemaVersion: "issue22-iteration10-offline-preflight-v1", status: "passed", nodeVersion: process.version,
  readabilityVersion: "0.6.0", domAdapter: "linkedom@0.18.13", plannedCheckCount: 15,
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
