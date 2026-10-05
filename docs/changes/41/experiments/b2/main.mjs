/* global Buffer:readonly, console:readonly, process:readonly, URL:readonly */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Readability } from "@mozilla/readability";
import { Actor } from "apify";
import { JSDOM } from "jsdom";

const EXPECTED_SAMPLE_SHA256 = "8bb9facc14fd7a5755c9337f7d9864ba6fb7958a44d6ae654b8e17ee84f63c8c";
const MAX_ROWS = 100;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_RUNTIME_MS = 10 * 60 * 1000;
const EXPECTED_B1_HTML_ROWS = 53;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function wordCount(value) {
  return (value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length;
}

function findArticleBodies(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) findArticleBodies(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  const isArticle = types.some((type) =>
    /(?:^|\/)(?:Article|NewsArticle|BlogPosting|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle)$/i.test(
      String(type || ""),
    ),
  );
  if (isArticle && typeof value.articleBody === "string") {
    const text = normalizeText(value.articleBody);
    if (text) output.push(text);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "@graph" || Array.isArray(child)) findArticleBodies(child, output);
  }
  return output;
}

function structuredArticleText(document) {
  const candidates = [];
  for (const element of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      findArticleBodies(JSON.parse(element.textContent || ""), candidates);
    } catch {
      // Ignore malformed JSON-LD and let the generic parser handle the document.
    }
  }
  return candidates.sort((a, b) => b.length - a.length)[0] || null;
}

function bytesFromCache(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  return null;
}

function safeErrorClass(error) {
  const name =
    error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,39}$/u.test(error.name)
      ? error.name
      : "UnknownError";
  const code =
    error && typeof error.code === "string" && /^[A-Z0-9_]{1,40}$/u.test(error.code)
      ? error.code
      : null;
  return { name, code };
}

function resultBase(row) {
  return {
    rowId: row.rowId,
    query: row.query,
    country: row.country,
    language: row.language,
    sourceName: row.sourceName,
    sourceHost: row.sourceHost,
    googleNewsUrl: row.googleNewsUrl,
    googleNewsUrlHash: row.googleNewsUrlHash,
    publisherUrl: row.publisherUrl,
    publisherHost: row.publisherHost,
    publisherUrlHash: row.publisherUrlHash,
    b1AccessClass: row.b1AccessClass,
  };
}

function failure(row, outcome, startedAt) {
  return {
    ...resultBase(row),
    outcome,
    readableTextSuccess: false,
    extractionMethod: null,
    wordCount: 0,
    textCharacterCount: 0,
    elapsedMs: Date.now() - startedAt,
  };
}

async function extractRow(row, cache) {
  const startedAt = Date.now();
  if (!row.b1UsableHtml || !row.htmlKey) {
    return failure(row, "access_not_eligible", startedAt);
  }
  try {
    const cached = await cache.getValue(row.htmlKey);
    const htmlBytes = bytesFromCache(cached);
    if (!htmlBytes) return failure(row, "cache_missing_or_unsupported_value", startedAt);
    if (htmlBytes.length > MAX_HTML_BYTES) return failure(row, "input_limit_exceeded", startedAt);
    const inputSha256 = sha256(htmlBytes);
    if (htmlBytes.length !== row.bodyBytes || inputSha256 !== row.bodySha256) {
      return {
        ...failure(row, "cache_hash_mismatch", startedAt),
        expectedBodyBytes: row.bodyBytes,
        actualBodyBytes: htmlBytes.length,
        expectedBodySha256: row.bodySha256,
        actualBodySha256: inputSha256,
      };
    }

    const dom = new JSDOM(htmlBytes, {
      url: row.publisherUrl,
      contentType: row.contentType || "text/html",
    });
    try {
      let extractionMethod = "structured_article_body";
      let text = structuredArticleText(dom.window.document);
      if (!text) {
        extractionMethod = "mozilla_readability";
        const article = new Readability(dom.window.document, { disableJSONLD: true }).parse();
        text = normalizeText(article?.textContent);
      }
      const words = wordCount(text || "");
      if (!text || words === 0) {
        return {
          ...failure(row, "no_readable_article_text", startedAt),
          inputBodyBytes: htmlBytes.length,
          inputBodySha256: inputSha256,
          extractionMethod,
        };
      }
      const textKey = `B2_TEXT_${row.rowId}`;
      await Actor.setValue(textKey, text, { contentType: "text/plain; charset=utf-8" });
      return {
        ...resultBase(row),
        outcome: "readable_text_success",
        readableTextSuccess: true,
        extractionMethod,
        wordCount: words,
        textCharacterCount: text.length,
        textSha256: sha256(text),
        textKey,
        inputBodyBytes: htmlBytes.length,
        inputBodySha256: inputSha256,
        elapsedMs: Date.now() - startedAt,
      };
    } finally {
      dom.window.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...failure(row, `extraction_error:${message.slice(0, 120)}`, startedAt),
    };
  }
}

await Actor.init();
let currentStage = "fixture_read";
try {
  console.log("ISSUE41_B2_D1 stage=fixture_read_start");
  const sampleText = await readFile(new URL("./input-sample.json", import.meta.url), "utf8");
  console.log(`ISSUE41_B2_D1 stage=fixture_read_complete characters=${sampleText.length}`);
  currentStage = "fixture_hash_check";
  console.log("ISSUE41_B2_D1 stage=fixture_hash_check_start");
  const sampleHash = sha256(sampleText);
  if (sampleHash !== EXPECTED_SAMPLE_SHA256) throw new Error("Frozen B2 sample hash mismatch");
  console.log("ISSUE41_B2_D1 stage=fixture_hash_check_complete result=match");
  currentStage = "fixture_parse_and_count_check";
  console.log("ISSUE41_B2_D1 stage=fixture_parse_start");
  const sample = JSON.parse(sampleText);
  console.log("ISSUE41_B2_D1 stage=fixture_parse_complete");
  console.log("ISSUE41_B2_D1 stage=fixture_count_check_start");
  if (
    sample.rows.length !== MAX_ROWS ||
    new Set(sample.rows.map((row) => row.rowId)).size !== MAX_ROWS
  ) {
    throw new Error("B2 sample must contain all 100 unique representative rows");
  }
  const eligibleCount = sample.rows.filter((row) => row.b1UsableHtml && row.htmlKey).length;
  if (eligibleCount !== EXPECTED_B1_HTML_ROWS) {
    throw new Error(
      `B2 expected ${EXPECTED_B1_HTML_ROWS} retained B1 HTML rows; found ${eligibleCount}`,
    );
  }
  console.log(
    `ISSUE41_B2_D1 stage=fixture_count_check_complete totalRows=${sample.rows.length} uniqueRows=${new Set(sample.rows.map((row) => row.rowId)).size} cachedHtmlRows=${eligibleCount}`,
  );
  currentStage = "source_store_open";
  console.log("ISSUE41_B2_D1 stage=source_store_open_start");
  const cache = await Actor.openKeyValueStore(sample.sourceB1KeyValueStoreId);
  console.log("ISSUE41_B2_D1 stage=source_store_open_complete");
  const startedAtUtc = new Date().toISOString();
  const deadline = Date.now() + MAX_TOTAL_RUNTIME_MS;
  const rows = [];
  currentStage = "row_loop";
  console.log(`ISSUE41_B2_D1 stage=row_loop_start totalRows=${sample.rows.length}`);
  for (const row of sample.rows) {
    if (!row.b1UsableHtml) {
      rows.push(failure(row, "access_not_eligible", Date.now()));
      continue;
    }
    if (Date.now() >= deadline) {
      rows.push(failure(row, "runtime_budget_exceeded", Date.now()));
      continue;
    }
    rows.push(await extractRow(row, cache));
  }
  console.log(`ISSUE41_B2_D1 stage=row_loop_complete processedRows=${rows.length}`);

  const outcomeCounts = {};
  const methodCounts = {};
  for (const row of rows) {
    outcomeCounts[row.outcome] = (outcomeCounts[row.outcome] || 0) + 1;
    if (row.extractionMethod) {
      methodCounts[row.extractionMethod] = (methodCounts[row.extractionMethod] || 0) + 1;
    }
  }
  const completedAtUtc = new Date().toISOString();
  const evidence = {
    evidenceType: "issue41_b2_readable_text_extraction",
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
      sourceB1RunId: sample.sourceB1RunId,
      sourceB1DatasetId: sample.sourceB1DatasetId,
      sourceB1KeyValueStoreId: sample.sourceB1KeyValueStoreId,
      b1SampleSha256: sample.sourceB1SampleSha256,
      rowArraySha256: sample.sourceB1RowArraySha256,
      b2SampleSha256: EXPECTED_SAMPLE_SHA256,
      denominator: 100,
      cachedHtmlRows: eligibleCount,
      deduplication: "Disabled; score every one of the 100 original row occurrences.",
    },
    configuration: {
      readabilityVersion: "0.6.0",
      jsdomVersion: "29.0.1",
      maxRows: MAX_ROWS,
      maxHtmlBytesPerRow: MAX_HTML_BYTES,
      totalRuntimeBudgetMs: MAX_TOTAL_RUNTIME_MS,
      htmlSource:
        "Exact B1 key-value-store response bytes; each SHA-256 and byte count must match B1.",
      networkAccess:
        "No publisher refetch, scripts, subresources or other extraction-time network retrieval.",
      structuredData:
        "Use articleBody only for recognized Article/NewsArticle/BlogPosting JSON-LD types when non-empty; otherwise use Readability.",
      successRule:
        "Normalized output contains at least one Unicode letter/number token; no additional minimum word threshold is added because the TID specifies none. Record text hash, character count and whitespace-token count.",
    },
    totalRows: rows.length,
    cachedHtmlRows: eligibleCount,
    readableTextSuccessCount: rows.filter((row) => row.readableTextSuccess).length,
    target: 50,
    targetMet: rows.filter((row) => row.readableTextSuccess).length >= 50,
    outcomeCounts,
    methodCounts,
    rows,
  };
  currentStage = "dataset_write";
  const datasetItemCount = 1 + rows.length;
  console.log(`ISSUE41_B2_D1 stage=dataset_write_start itemCount=${datasetItemCount}`);
  await Actor.pushData([
    {
      evidenceType: evidence.evidenceType,
      startedAtUtc,
      completedAtUtc,
      environment: evidence.environment,
      sample: evidence.sample,
      configuration: evidence.configuration,
      totalRows: evidence.totalRows,
      cachedHtmlRows: evidence.cachedHtmlRows,
      readableTextSuccessCount: evidence.readableTextSuccessCount,
      target: evidence.target,
      targetMet: evidence.targetMet,
      outcomeCounts,
      methodCounts,
    },
    ...rows.map((row) => ({ evidenceType: "issue41_b2_row", ...row })),
  ]);
  console.log(`ISSUE41_B2_D1 stage=dataset_write_complete itemCount=${datasetItemCount}`);
  currentStage = "summary_store_write";
  await Actor.setValue("B2_SUMMARY", evidence, { contentType: "application/json; charset=utf-8" });
  console.log(
    `ISSUE41_B2 ${JSON.stringify({
      denominator: evidence.totalRows,
      cachedHtmlRows: evidence.cachedHtmlRows,
      readableTextSuccessCount: evidence.readableTextSuccessCount,
      target: evidence.target,
      outcomeCounts,
      methodCounts,
    })}`,
  );
} catch (error) {
  process.exitCode = 1;
  const errorClass = safeErrorClass(error);
  console.error(`ISSUE41_B2_D1 fatal ${JSON.stringify({ stage: currentStage, ...errorClass })}`);
  throw new Error(
    `Issue 41 B2 diagnostic failed at ${currentStage} (${errorClass.name}${errorClass.code ? `, ${errorClass.code}` : ""})`,
  );
} finally {
  try {
    await Actor.exit();
  } catch (error) {
    process.exitCode = 1;
    const errorClass = safeErrorClass(error);
    console.error(`ISSUE41_B2_D1 exit_error ${JSON.stringify(errorClass)}`);
  }
}
