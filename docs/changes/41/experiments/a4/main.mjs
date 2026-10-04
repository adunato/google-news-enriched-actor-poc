/* global console:readonly, process:readonly, URL:readonly */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Actor } from "apify";

const EXPECTED_MANIFEST_SHA256 = "d1ed2bea31efc54358ac24d991a9037ec0f0840ccd50547c01bd794c64389f3c";
const EXPECTED_ROWS_SHA256 = "fdbab474e5764350c547080c0002f042b062e03f157a270d5b9474d846ad2f2a";
const TARGET = 95;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

await Actor.init();
try {
  const manifestText = await readFile(new URL("./input-manifest.json", import.meta.url), "utf8");
  const manifest = JSON.parse(manifestText);
  const manifestSha256 = sha256(manifestText);
  const rowsSha256 = sha256(JSON.stringify(manifest.rows));
  if (manifestSha256 !== EXPECTED_MANIFEST_SHA256 || rowsSha256 !== EXPECTED_ROWS_SHA256) {
    throw new Error("Frozen A4 manifest hash mismatch");
  }
  if (manifest.rows.length !== 100 || new Set(manifest.rows.map((row) => row.rowId)).size !== 100) {
    throw new Error("Frozen A4 manifest must contain 100 unique row IDs");
  }

  const startedAtUtc = new Date().toISOString();
  await writeFile(
    new URL("./probe-results.json", import.meta.url),
    `${JSON.stringify({ issue: 41, manifestSha256, rowsSha256, rows: manifest.rows }, null, 2)}\n`,
  );
  await import("./resolver.mjs");
  const resolverOutput = JSON.parse(
    await readFile(new URL("./probe-results.json", import.meta.url), "utf8"),
  );
  const resolverRows = resolverOutput.rpcProbe?.rows;
  if (!Array.isArray(resolverRows) || resolverRows.length !== manifest.rows.length) {
    throw new Error("Resolver output does not contain one result per manifest row");
  }

  const rows = manifest.rows.map((input, index) => {
    const result = resolverRows[index];
    if (result.articleIdHash !== input.articleIdHash) {
      throw new Error(`Resolver result order/hash mismatch for ${input.rowId}`);
    }
    return {
      rowId: input.rowId,
      query: input.query,
      country: input.country,
      language: input.language,
      sourceName: input.sourceName,
      sourceHost: input.sourceHost,
      googleNewsUrl: input.googleNewsUrl,
      googleNewsUrlHash: input.googleNewsUrlHash,
      resolutionStatus: result.outcome,
      publisherUrlValid: result.publisherUrlValid,
      publisherUrl: result.publisherUrl ?? null,
      publisherHost: result.publisherHost ?? null,
      publisherUrlHash: result.publisherUrlHash ?? null,
      stages: result.stages,
      elapsedMs: result.elapsedMs,
    };
  });
  const outcomeCounts = rows.reduce((counts, row) => {
    counts[row.resolutionStatus] = (counts[row.resolutionStatus] || 0) + 1;
    return counts;
  }, {});
  const completedAtUtc = new Date().toISOString();
  const evidence = {
    evidenceType: "issue41_a4_publisher_url_acceptance",
    startedAtUtc,
    completedAtUtc,
    environment: {
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      actorId: process.env.APIFY_ACTOR_ID || null,
      buildId: process.env.APIFY_ACTOR_BUILD_ID || null,
      buildNumber: process.env.APIFY_ACTOR_BUILD_NUMBER || null,
    },
    sample: {
      source: "docs/changes/18/input-manifest.json",
      issue18ManifestSha256: manifestSha256,
      rowArraySha256: rowsSha256,
      rowCount: rows.length,
      uniqueRowIds: new Set(rows.map((row) => row.rowId)).size,
      uniqueSourceHosts: new Set(rows.map((row) => row.sourceHost)).size,
      duplicateGoogleNewsUrlOccurrences:
        rows.length - new Set(rows.map((row) => row.googleNewsUrl)).size,
      queryEditionCells: 10,
      deduplication: "Disabled; all 100 frozen row occurrences are measured.",
    },
    resolver: {
      source: "docs/changes/14/rpc-probe.mjs",
      boundedClassifierAdaptation:
        "validPublisher additionally excludes Google country/edition domains and retained Google service roots; resolution requests and RPC parsing are unchanged.",
      configuration: resolverOutput.rpcProbe.configuration,
      startedAtUtc: resolverOutput.rpcProbe.startedAtUtc,
      completedAtUtc: resolverOutput.rpcProbe.completedAtUtc,
    },
    totalRows: rows.length,
    validPublisherUrlCount: rows.filter((row) => row.publisherUrlValid).length,
    target: TARGET,
    targetMet: rows.filter((row) => row.publisherUrlValid).length >= TARGET,
    outcomeCounts,
    rows,
  };

  const datasetItems = [
    {
      evidenceType: evidence.evidenceType,
      startedAtUtc: evidence.startedAtUtc,
      completedAtUtc: evidence.completedAtUtc,
      environment: evidence.environment,
      sample: evidence.sample,
      resolver: evidence.resolver,
      totalRows: evidence.totalRows,
      validPublisherUrlCount: evidence.validPublisherUrlCount,
      target: evidence.target,
      targetMet: evidence.targetMet,
      outcomeCounts: evidence.outcomeCounts,
    },
    ...rows.map((row) => ({ evidenceType: "issue41_a4_row", ...row })),
  ];
  await Actor.pushData(datasetItems);

  await writeFile(
    new URL("./a4-results.json", import.meta.url),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(
    `ISSUE41_A4 ${JSON.stringify({
      totalRows: evidence.totalRows,
      validPublisherUrlCount: evidence.validPublisherUrlCount,
      target: evidence.target,
      targetMet: evidence.targetMet,
      outcomeCounts,
    })}`,
  );
} finally {
  await Actor.exit();
}
