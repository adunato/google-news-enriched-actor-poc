/* global URL, console, fetch, process */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const queries = ["world news", "politics", "business", "technology", "health"];
const editions = [
  { id: "GB", language: "en-GB", country: "GB" },
  { id: "US", language: "en-US", country: "US" },
];
const dateRanges = new Set(["any", "1h", "6h", "1d", "7d", "30d"]);
const targetPerCell = 10;
const minimumSuccesses = 95;

export function createMatrix() {
  return queries.flatMap((query) => editions.map((edition) => ({ query, edition })));
}

export function isMatrixComplete(cells) {
  return cells.length === 10 && cells.every((cell) => cell.records.length === targetPerCell);
}

function parseArgs(args) {
  const options = { dateRange: "7d", output: undefined };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--date-range") options.dateRange = args[++index];
    else if (args[index] === "--output") options.output = args[++index];
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (!dateRanges.has(options.dateRange)) {
    throw new Error("--date-range must be any, 1h, 6h, 1d, 7d, or 30d.");
  }
  return options;
}

function gitValue(...args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

export function hostClass(url) {
  const host = url.hostname.toLowerCase();
  if (/(^|[.-])(consent|captcha|recaptcha|interstitial|sorry)([.-]|$)/i.test(host)) {
    return "interstitial";
  }
  if (
    host === "g.co" ||
    host.endsWith(".g.co") ||
    /(?:^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host) ||
    host === "googleusercontent.com" ||
    host.endsWith(".googleusercontent.com") ||
    host === "gstatic.com" ||
    host.endsWith(".gstatic.com")
  ) {
    return "google";
  }
  if (/\.(?:avif|css|gif|ico|jpe?g|js|png|svg|webp|woff2?)$/i.test(url.pathname)) {
    return "asset";
  }
  if (url.pathname === "/" || url.pathname === "") return "ambiguous";
  return "publisher";
}

export function successPredicate(original, result) {
  if (
    result?.urlResolved !== true ||
    result.urlResolutionStatus !== "success" ||
    result.googleNewsUrl !== original.googleNewsUrl ||
    typeof result.publisherUrl !== "string" ||
    typeof result.publisherDomain !== "string"
  )
    return { valid: false, category: undefined, hostClass: "unknown" };

  let url;
  try {
    url = new URL(result.publisherUrl);
  } catch {
    return { valid: false, category: "invalid_publisher_url", hostClass: "unknown" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, category: "invalid_publisher_url", hostClass: hostClass(url) };
  }
  const classification = hostClass(url);
  if (classification === "interstitial") {
    return { valid: false, category: "consent_or_interstitial", hostClass: classification };
  }
  if (classification === "google") {
    return { valid: false, category: "google_host", hostClass: classification };
  }
  if (classification !== "publisher" || result.publisherDomain !== url.hostname.toLowerCase()) {
    return { valid: false, category: "invalid_publisher_url", hostClass: classification };
  }
  return { valid: true, category: undefined, hostClass: classification };
}

function safeHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 240);
}

function aggregateCell(cell, rowAudits) {
  const failures = {};
  for (const row of rowAudits) {
    if (!row.validSuccess) {
      const category = row.failureCategory ?? "other";
      failures[category] = (failures[category] ?? 0) + 1;
    }
  }
  return {
    query: cell.query,
    edition: cell.edition.id,
    language: cell.edition.language,
    country: cell.edition.country,
    retainedCount: cell.records.length,
    successCount: rowAudits.filter((row) => row.validSuccess).length,
    failureCount: rowAudits.filter((row) => !row.validSuccess).length,
    failuresByCategory: failures,
    collectionError: cell.collectionError,
    rows: rowAudits,
  };
}

export function aggregateFailures(cells) {
  const failures = {};
  for (const cell of cells) {
    for (const [category, count] of Object.entries(cell.failuresByCategory)) {
      failures[category] = (failures[category] ?? 0) + count;
    }
  }
  return failures;
}

export function redirectDestinationClass(diagnostic) {
  if (!diagnostic) return undefined;
  const pageRequests = diagnostic.requests.filter((request) => request.stage === "google_page");
  let lastRedirectIndex = -1;
  for (let index = 0; index < pageRequests.length; index += 1) {
    const status = pageRequests[index].status;
    if (status !== undefined && status >= 300 && status < 400) lastRedirectIndex = index;
  }
  if (lastRedirectIndex < 0) return undefined;

  // The resolver follows redirects only while the destination remains news.google.com.
  if (lastRedirectIndex < pageRequests.length - 1) return "google_news";
  return diagnostic.resultHostClass ?? "unknown";
}

export function buildRowAudit(row, result, diagnostic, matrixComplete) {
  const record = row.candidate.record;
  const predicate = matrixComplete
    ? successPredicate(record, result)
    : { valid: false, category: undefined, hostClass: "unknown" };
  const failureCategory = predicate.valid
    ? undefined
    : (predicate.category ?? diagnostic?.failureCategory ?? (matrixComplete ? "other" : undefined));
  const redirectClass = redirectDestinationClass(diagnostic);
  return {
    ordinal: row.ordinal,
    sourceHash: safeHash(record.googleNewsUrl),
    outcome: result?.urlResolutionStatus ?? "not_run_incomplete_matrix",
    validSuccess: predicate.valid,
    ...(failureCategory ? { failureCategory } : {}),
    publisherHostClass: predicate.valid
      ? predicate.hostClass
      : (diagnostic?.resultHostClass ?? predicate.hostClass),
    publisherDomain: predicate.valid ? result.publisherDomain : undefined,
    elapsedMs: diagnostic?.elapsedMs,
    rpcContext: diagnostic?.rpcContext,
    outsideTestedGbUsEnglish: diagnostic?.outsideTestedGbUsEnglish,
    ...(redirectClass ? { redirectDestinationClass: redirectClass } : {}),
    requests: diagnostic?.requests ?? [],
  };
}

async function writeManifest(manifest, outputPath) {
  const path = resolve(root, outputPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return path;
}

async function main() {
  const { retrieveGoogleNewsArticles } = await import("../dist/google-news.js");
  const { resolvePublisherUrls } = await import("../dist/publisher-url.js");
  const options = parseArgs(process.argv.slice(2));
  const collectedAt = new Date().toISOString();
  const cells = createMatrix().map((cell) => ({
    ...cell,
    records: [],
    collectionError: undefined,
  }));

  for (const cell of cells) {
    try {
      cell.records = await retrieveGoogleNewsArticles({
        queries: [cell.query],
        maxItemsPerQuery: targetPerCell,
        language: cell.edition.language,
        country: cell.edition.country,
        dateRange: options.dateRange,
        dedupe: false,
        resolvePublisherUrls: true,
        includeFullText: false,
      });
    } catch (error) {
      cell.collectionError = sanitizeError(error);
    }
  }

  const matrixComplete = isMatrixComplete(cells);
  const rows = cells.flatMap((cell, cellIndex) =>
    cell.records.map((candidate, ordinal) => ({
      cellIndex,
      ordinal: ordinal + 1,
      cell: `${cell.query}|${cell.edition.id}`,
      candidate,
    })),
  );
  const diagnostics = new Array(rows.length);
  let resolved = [];
  if (matrixComplete) {
    resolved = await resolvePublisherUrls(
      rows.map((row) => row.candidate),
      true,
      fetch,
      (index, diagnostic) => {
        diagnostics[index] = diagnostic;
      },
    );
  }

  const rowAuditsByCell = cells.map(() => []);
  let totalSuccesses = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const result = resolved[index];
    const diagnostic = diagnostics[index];
    const audit = buildRowAudit(row, result, diagnostic, matrixComplete);
    if (audit.validSuccess) totalSuccesses += 1;
    rowAuditsByCell[row.cellIndex].push(audit);
  }

  const perCell = cells.map((cell, index) => aggregateCell(cell, rowAuditsByCell[index]));
  const status = !matrixComplete
    ? "incomplete"
    : totalSuccesses >= minimumSuccesses
      ? "pass"
      : "hold";
  const manifest = {
    issue: 4,
    status,
    collectedAtUtc: collectedAt,
    commitSha: gitValue("rev-parse", "HEAD"),
    workingTreeDirty: gitValue("status", "--porcelain") !== "",
    nodeVersion: process.version,
    configuration: {
      queries,
      editions,
      maxItemsPerQuery: targetPerCell,
      dateRange: options.dateRange,
      dedupe: false,
      resolvePublisherUrls: true,
      includeFullText: false,
      expectedCells: 10,
      rowsPerCell: targetPerCell,
      denominator: rows.length,
      requiredDenominator: 100,
      minimumSuccesses,
    },
    denominator: rows.length,
    resolvedDenominator: matrixComplete ? rows.length : 0,
    retainedRows: rows.length,
    successfulRows: totalSuccesses,
    failuresByCategory: aggregateFailures(perCell),
    cells: perCell,
  };

  const timestamp = collectedAt.replaceAll(/[-:.]/g, "").replace("Z", "Z");
  const outputPath = options.output ?? `docs/changes/4/live-sample-${timestamp}.json`;
  const written = await writeManifest(manifest, outputPath);
  console.log(
    JSON.stringify({
      status,
      denominator: manifest.denominator,
      successfulRows: totalSuccesses,
      manifest: written,
    }),
  );
  if (status !== "pass") process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Capability sample harness failed: ${sanitizeError(error)}`);
    process.exitCode = 1;
  });
}
