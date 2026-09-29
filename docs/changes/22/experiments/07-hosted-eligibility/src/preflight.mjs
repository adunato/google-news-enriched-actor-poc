import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";
let interceptedNetworkAttempts = 0;
const blockNetwork = () => {
  interceptedNetworkAttempts += 1;
  throw new Error("preflight_network_disabled");
};
globalThis.fetch = blockNetwork;
http.request = blockNetwork;
http.get = blockNetwork;
https.request = blockNetwork;
https.get = blockNetwork;

const { classifyExtractedContent } = await import("../../04-hosted-readability/src/readability-proxy.mjs");
const { aggregateRows, allowedAggregateFields, cellIds } = await import("./aggregate.mjs");

const sentinel = "RAW_SENTINEL_MUST_NOT_PERSIST";
const rows = [];
for (const cellId of cellIds()) {
  for (let slot = 0; slot < 10; slot += 1) {
    const defaults = {
      cellId,
      candidateClass: "resolved",
      robotsClass: "allowed",
      fetchClass: "http_2xx_html",
      gateSignal: false,
      extractionClass: "accepted_proxy",
      proxyClass: "accepted_proxy",
      prefixBytes: 18 * 1024,
      extractMs: 450,
      publisherUrl: `https://${sentinel}.invalid/path`,
      title: sentinel,
      html: sentinel,
      articleText: sentinel,
      cookies: sentinel,
      errorMessage: sentinel,
    };
    const variations = [
      { gateSignal: true },
      { gateSignal: true, extractionClass: "quality_rejected", proxyClass: "quality_rejected" },
      { gateSignal: true, extractionClass: "timeout", proxyClass: "not_scored", extractMs: 5000 },
      { robotsClass: "unavailable", fetchClass: "not_attempted", gateSignal: null, extractionClass: "not_attempted", proxyClass: "not_scored", extractMs: null },
      { robotsClass: "disallowed", fetchClass: "not_attempted", gateSignal: null, extractionClass: "not_attempted", proxyClass: "not_scored", extractMs: null },
      { fetchClass: "http_other", gateSignal: null, extractionClass: "not_attempted", proxyClass: "not_scored", extractMs: null },
      { fetchClass: "transport_error", gateSignal: null, extractionClass: "not_attempted", proxyClass: "not_scored", extractMs: null },
      { robotsClass: "not_found", gateSignal: false, extractionClass: "too_short", proxyClass: "too_short" },
      { candidateClass: "not_resolved", robotsClass: "not_checked", fetchClass: "not_attempted", gateSignal: null, extractionClass: "not_attempted", proxyClass: "not_scored", extractMs: null },
      { gateSignal: false },
    ];
    rows.push({ ...defaults, ...variations[slot] });
  }
}

const aggregate = aggregateRows(rows);
assert.equal(aggregate.denominator, 100);
assert.equal(aggregate.cells.length, 10);
assert(aggregate.cells.every((cell) => cell.plannedRows === 10));
assert.equal(aggregate.cells.reduce((sum, cell) => sum + cell.gateProxyComparison.gate_positive_accepted_proxy, 0), 10);
assert.equal(aggregate.cells.reduce((sum, cell) => sum + cell.extraction.timeout, 0), 10);
const safeFields = allowedAggregateFields();
function assertAllowedKeys(value) {
  if (Array.isArray(value)) return value.forEach(assertAllowedKeys);
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assert(safeFields.has(key), `unexpected persisted field: ${key}`);
      assertAllowedKeys(item);
    }
  }
}
assertAllowedKeys(aggregate);
const aggregateJson = JSON.stringify(aggregate);
assert(!aggregateJson.includes(sentinel));
for (const rawField of ["publisherUrl", "title", "html", "articleText", "cookies", "errorMessage", "rowId", "hostname"])
  assert(!Object.hasOwn(aggregate, rawField));

function alphaCode(value) {
  let number = value;
  let code = "";
  for (let i = 0; i < 7; i += 1) {
    code = String.fromCharCode(97 + (number % 26)) + code;
    number = Math.floor(number / 26);
  }
  return `story${code}`;
}
const navFixture = [];
for (let i = 0; i < 128; i += 1) navFixture.push(`${alphaCode(i)} news world`);
const navMarkup = `<p>${navFixture.slice(0, 64).join(" ")}</p><p>${navFixture.slice(64).join(" ")}</p>`;
const navTokens = navFixture.length * 3;
const navRatio = (navFixture.length * 2) / navTokens;
assert(navRatio > 0.35);
const navProxy = classifyExtractedContent(navMarkup);
assert.equal(navProxy.status, "accepted_proxy");
assert.equal(classifyExtractedContent("").status, "empty");
assert.equal(classifyExtractedContent("<p>one two three four</p>").status, "too_short");
assert.equal(interceptedNetworkAttempts, 0);

const report = {
  mode: "offline synthetic preflight only",
  networkRequestsMade: 0,
  interceptedNetworkAttempts,
  denominator: aggregate.denominator,
  cellCount: aggregate.cells.length,
  rowsPerCell: aggregate.cells.map(({ plannedRows }) => plannedRows),
  aggregateOnlyAllowListPassed: true,
  rawSentinelAbsent: true,
  implementedProxyAcceptedSyntheticNavigationHeavyFixture: true,
  navigationTokenRatioInFixture: navRatio,
  proxyDefinition: aggregate.proxyDefinition,
  aggregateCounts: aggregate.cells.reduce((summary, cell) => {
    summary.eligible2xxHtml += cell.eligible2xxHtml;
    summary.gatePositiveAcceptedProxy += cell.gateProxyComparison.gate_positive_accepted_proxy;
    summary.extractionTimeouts += cell.extraction.timeout;
    return summary;
  }, { eligible2xxHtml: 0, gatePositiveAcceptedProxy: 0, extractionTimeouts: 0 }),
};
const experimentDir = dirname(dirname(fileURLToPath(import.meta.url)));
await writeFile(join(experimentDir, "preflight-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report));
