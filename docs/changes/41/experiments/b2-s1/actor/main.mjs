import { createHash } from "node:crypto";
import { Actor } from "apify";

const EXPERIMENT = "B2-S1";
const SOURCE_STORE_ID = "C1KYtogOgGpkRyF2H";
const SOURCE_RUN_ID = "g7ndwu3G1M4orPt2h";
const WITNESS_ROW_ID = "q1-gb-01";
const WITNESS_KEY = "B1_HTML_q1-gb-01";
const EXPECTED_BYTES = 435577;
const EXPECTED_SHA256 = "6f8d86bc1f95de5b118a55e4d4d89c39cf38a94c3ca9f5319e135dd357841dd9";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_MS = 10000;
const CLIENT_TIMEOUT_SECS = 5;

const safeToken = (value, fallback = null) =>
  typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/u.test(value) ? value : fallback;

function safeError(error) {
  const statusValue = error?.statusCode ?? error?.status ?? error?.response?.statusCode;
  const httpStatus =
    Number.isInteger(statusValue) && statusValue >= 100 && statusValue <= 599 ? statusValue : null;
  return {
    errorClass: safeToken(error?.name, "UnknownError"),
    errorCode: safeToken(error?.code),
    apiType: safeToken(error?.type),
    httpStatus,
  };
}

function safeContentType(value) {
  if (typeof value !== "string") return null;
  if (
    /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:\s*;\s*charset=[A-Za-z0-9._-]+)?$/iu.test(
      value,
    )
  ) {
    return value.slice(0, 128);
  }
  return "unrecognized";
}

function emit(stage, fields = {}) {
  console.log(`${EXPERIMENT} ${JSON.stringify({ stage, ...fields })}`);
}

const env = Actor.getEnv();
const requestTimings = [];
let sourceReadRequestCount = 0;
let stage = "actor_init";
let outcome = "actor_startup_error";
let observed = null;
let apiError = null;
const startedAt = Date.now();
let resultEmitted = false;

function finish(finalOutcome) {
  outcome = finalOutcome;
  const result = {
    experiment: EXPERIMENT,
    stage,
    outcome,
    actorId: env.actorId,
    runId: env.actorRunId,
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memoryMbytes: env.memoryMbytes,
    },
    sourceRunId: SOURCE_RUN_ID,
    sourceStoreId: SOURCE_STORE_ID,
    sourceReadRequestCount,
    requestTimings,
    requestElapsedTotalMs: requestTimings.reduce((sum, item) => sum + item.elapsedMs, 0),
    clientTimeoutSecsPerRequest: CLIENT_TIMEOUT_SECS,
    requestElapsedLimitMs: MAX_REQUEST_MS,
    witness: {
      rowId: WITNESS_ROW_ID,
      key: WITNESS_KEY,
      expectedBytes: EXPECTED_BYTES,
      expectedSha256: EXPECTED_SHA256,
      observedBytes: observed?.bytes ?? null,
      observedSha256: observed?.sha256 ?? null,
      contentType: observed?.contentType ?? null,
    },
    apiError,
    elapsedMs: Date.now() - startedAt,
  };
  resultEmitted = true;
  emit("result", result);
}

async function run() {
  await Actor.init();
  stage = "client_setup";
  const client = Actor.newClient({ maxRetries: 0, timeoutSecs: CLIENT_TIMEOUT_SECS });

  stage = "store_metadata_read";
  emit("store_metadata_read_start", { sourceStoreId: SOURCE_STORE_ID });
  sourceReadRequestCount += 1;
  const metadataStartedAt = Date.now();
  let store;
  try {
    store = await client.keyValueStore(SOURCE_STORE_ID).get();
  } catch (error) {
    const timing = { operation: "store_metadata_get", elapsedMs: Date.now() - metadataStartedAt };
    requestTimings.push(timing);
    apiError = safeError(error);
    if (apiError.httpStatus === 401 || apiError.httpStatus === 403) return finish("access_denied");
    if (apiError.httpStatus === 404) return finish("store_absent");
    return finish("metadata_error");
  }
  const metadataElapsedMs = Date.now() - metadataStartedAt;
  requestTimings.push({ operation: "store_metadata_get", elapsedMs: metadataElapsedMs });
  emit("store_metadata_read_complete", {
    sourceStoreId: SOURCE_STORE_ID,
    found: Boolean(store),
    elapsedMs: metadataElapsedMs,
  });

  if (!store) return finish("store_absent");
  if (store.id !== SOURCE_STORE_ID) return finish("metadata_error");
  if (metadataElapsedMs >= MAX_REQUEST_MS || metadataElapsedMs >= CLIENT_TIMEOUT_SECS * 1000) {
    return finish("request_budget_exhausted");
  }

  stage = "record_read";
  emit("record_read_start", { sourceStoreId: SOURCE_STORE_ID, key: WITNESS_KEY });
  sourceReadRequestCount += 1;
  const recordStartedAt = Date.now();
  let record;
  try {
    record = await client.keyValueStore(SOURCE_STORE_ID).getRecord(WITNESS_KEY, { buffer: true });
  } catch (error) {
    const timing = { operation: "record_get_buffer", elapsedMs: Date.now() - recordStartedAt };
    requestTimings.push(timing);
    apiError = safeError(error);
    if (apiError.httpStatus === 401 || apiError.httpStatus === 403) return finish("access_denied");
    if (apiError.httpStatus === 404) return finish("record_missing");
    return finish("record_error");
  }
  const recordElapsedMs = Date.now() - recordStartedAt;
  requestTimings.push({ operation: "record_get_buffer", elapsedMs: recordElapsedMs });

  if (!record) return finish("record_missing");
  if (record.key !== WITNESS_KEY || !Buffer.isBuffer(record.value)) return finish("record_error");
  const contentType = safeContentType(record.contentType);
  if (record.value.length > MAX_BODY_BYTES) {
    observed = { bytes: record.value.length, sha256: null, contentType };
    return finish("body_over_limit");
  }

  const observedSha256 = createHash("sha256").update(record.value).digest("hex");
  observed = { bytes: record.value.length, sha256: observedSha256, contentType };
  emit("record_read_complete", {
    sourceStoreId: SOURCE_STORE_ID,
    key: WITNESS_KEY,
    elapsedMs: recordElapsedMs,
    bytes: observed.bytes,
    sha256: observed.sha256,
    contentType: observed.contentType,
  });

  if (requestTimings.reduce((sum, item) => sum + item.elapsedMs, 0) > MAX_REQUEST_MS) {
    return finish("request_budget_exceeded");
  }
  if (observed.bytes !== EXPECTED_BYTES || observed.sha256 !== EXPECTED_SHA256)
    return finish("hash_mismatch");
  return finish("read_witness");
}

let exitCode = 1;
try {
  await run();
  exitCode = outcome === "read_witness" ? 0 : 1;
} catch (error) {
  apiError = safeError(error);
  if (!resultEmitted) finish(stage === "actor_init" ? "actor_startup_error" : "diagnostic_error");
} finally {
  await Actor.exit({ exitCode });
}
