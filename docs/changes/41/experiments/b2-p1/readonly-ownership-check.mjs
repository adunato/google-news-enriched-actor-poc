import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, openSync, closeSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const DIRECTORY = dirname(fileURLToPath(import.meta.url));
const S1_PACKAGE_JSON = join(DIRECTORY, "..", "b2-s1", "actor", "package.json");
const RESULT_PATH = join(DIRECTORY, "b2-p1-results.json");
const ATTEMPT_PATH = join(DIRECTORY, "b2-p1-attempt-started.json");
const RUN_ID = "hr2WzjPcLnZgHQYmZ";
const EXPECTED_ACTOR_ID = "JIogcgdHyCqAMHQ1P";
const STORE_ID = "C1KYtogOgGpkRyF2H";
const B1_CREATOR_RUN_ID = "g7ndwu3G1M4orPt2h";
const PINNED_APIFY_CLIENT_VERSION = "2.25.0";
const MAX_API_REQUESTS = 2;
const REQUEST_TIMEOUT_SECS = 5;
const MAX_TOTAL_REQUEST_TIMEOUT_MS = 10_000;

const writeResult = (result) => {
  const tempPath = `${RESULT_PATH}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "w", mode: 0o600 });
  renameSync(tempPath, RESULT_PATH);
};

const hashUserId = (value) =>
  typeof value === "string" && value.length > 0
    ? createHash("sha256").update(value, "utf8").digest("hex")
    : null;

const safeEnumField = (object, fieldName) => {
  if (!Object.hasOwn(object, fieldName)) return { state: "not_exposed" };
  const value = object[fieldName];
  if (value === null) return { state: "explicit_null", value: null };
  if (["string", "number", "boolean"].includes(typeof value)) return { state: "observed", value };
  return { state: "unknown_type" };
};

const safeError = (error) => ({
  errorClass: typeof error?.constructor?.name === "string" ? error.constructor.name : "Error",
  httpStatus: Number.isInteger(error?.statusCode) ? error.statusCode : null,
  apiType: typeof error?.type === "string" ? error.type : null,
});

const loadClient = () => {
  const requireFromPinnedPackage = createRequire(S1_PACKAGE_JSON);
  const clientPackagePath = requireFromPinnedPackage.resolve("apify-client");
  const clientPackage = JSON.parse(
    readFileSync(join(dirname(clientPackagePath), "..", "package.json"), "utf8"),
  );
  const { ApifyClient } = requireFromPinnedPackage("apify-client");
  return { ApifyClient, packageVersion: clientPackage.version };
};

const makeClient = (ApifyClient, token) => {
  const client = new ApifyClient({ token, maxRetries: 0, timeoutSecs: REQUEST_TIMEOUT_SECS });
  // Suppress SDK retry diagnostics so raw exception messages/stacks are never logged.
  client.logger.warning = () => {};
  client.logger.error = () => {};
  return client;
};

const captureConfiguredCliToken = () => {
  const commandProcessor = process.env.ComSpec || "cmd.exe";
  const token = execFileSync(commandProcessor, ["/d", "/s", "/c", "apify auth token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
    timeout: 10_000,
  }).trim();
  if (token.length === 0 || /\s/.test(token)) throw new Error("configured_cli_token_unavailable");
  return token;
};

const validateOnly = () => {
  const { ApifyClient, packageVersion } = loadClient();
  const client = makeClient(ApifyClient, "local-validation-placeholder");
  const checks = {
    authCategory: "existing_configured_apify_cli_account_token_captured_in_memory_at_execution",
    apifyClientVersion: packageVersion,
    maxRetries: client.httpClient.maxRetries,
    timeoutMillisPerRequest: client.httpClient.timeoutMillis,
    maxApiRequests: MAX_API_REQUESTS,
    maxCombinedRequestTimeoutMs: MAX_TOTAL_REQUEST_TIMEOUT_MS,
    runGetAvailable: typeof client.run(RUN_ID).get === "function",
    storeGetAvailable: typeof client.keyValueStore(STORE_ID).get === "function",
    noRequestExecuted: true,
  };
  client.token = undefined;
  client.httpClient.token = undefined;
  if (
    checks.maxRetries !== 0 ||
    checks.timeoutMillisPerRequest !== REQUEST_TIMEOUT_SECS * 1000 ||
    checks.apifyClientVersion !== PINNED_APIFY_CLIENT_VERSION ||
    !checks.runGetAvailable ||
    !checks.storeGetAvailable
  ) {
    throw new Error("local_sdk_conformance_failed");
  }
  process.stdout.write(`${JSON.stringify(checks)}\n`);
};

const checkConfiguredAuthOnly = () => {
  let token;
  try {
    token = captureConfiguredCliToken();
  } catch {
    process.stdout.write(
      `${JSON.stringify({ authCategory: "existing_configured_apify_cli_account_token_captured_in_memory", available: false })}\n`,
    );
    process.exitCode = 1;
    return;
  }
  const available = token.length > 0;
  token = "";
  process.stdout.write(
    `${JSON.stringify({ authCategory: "existing_configured_apify_cli_account_token_captured_in_memory", available })}\n`,
  );
};

const recordAttemptStart = () => {
  const fd = openSync(ATTEMPT_PATH, "wx", 0o600);
  try {
    writeFileSync(
      fd,
      `${JSON.stringify(
        {
          experiment: "B2-P1",
          startedAtUtc: new Date().toISOString(),
          apiRequestsStarted: 0,
          repeatPrevented: true,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    closeSync(fd);
  }
};

const stop = (result, outcome, extra = {}) => {
  result.outcome = outcome;
  Object.assign(result, extra);
  result.finishedAtUtc = new Date().toISOString();
  writeResult(result);
  process.stdout.write(
    `${JSON.stringify({ experiment: result.experiment, outcome, apiRequestsAttempted: result.apiRequestsAttempted })}\n`,
  );
};

const executeOnce = async () => {
  if (existsSync(ATTEMPT_PATH) || existsSync(RESULT_PATH)) {
    process.stdout.write(
      `${JSON.stringify({ experiment: "B2-P1", outcome: "prior_attempt_artifact_present", apiRequestsAttempted: 0 })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  recordAttemptStart();
  const result = {
    experiment: "B2-P1",
    authorizationDate: "2026-10-06",
    authCategory: "existing_configured_apify_cli_account_token_captured_in_memory",
    actorIdExpected: EXPECTED_ACTOR_ID,
    runIdExpected: RUN_ID,
    storeIdExpected: STORE_ID,
    b1CreatorRunIdExpected: B1_CREATOR_RUN_ID,
    requestPolicy: {
      maxRetries: 0,
      timeoutSecsPerRequest: REQUEST_TIMEOUT_SECS,
      maximumApiRequests: MAX_API_REQUESTS,
      maximumCombinedTimeoutMs: MAX_TOTAL_REQUEST_TIMEOUT_MS,
    },
    apiRequestsAttempted: 0,
    requests: [],
    startedAtUtc: new Date().toISOString(),
  };
  writeResult(result);

  let token;
  try {
    token = captureConfiguredCliToken();
  } catch {
    stop(result, "configured_auth_unavailable");
    process.exitCode = 1;
    return;
  }

  let ApifyClient;
  let apifyClientVersion;
  try {
    ({ ApifyClient, packageVersion: apifyClientVersion } = loadClient());
    if (apifyClientVersion !== PINNED_APIFY_CLIENT_VERSION)
      throw new Error("pinned_client_version_mismatch");
  } catch {
    token = "";
    stop(result, "pinned_client_unavailable");
    process.exitCode = 1;
    return;
  }

  const client = makeClient(ApifyClient, token);
  token = "";
  result.apifyClientVersion = apifyClientVersion;
  const combinedStart = performance.now();

  let run;
  const runStart = performance.now();
  result.apiRequestsAttempted += 1;
  try {
    run = await client.run(RUN_ID).get();
    result.requests.push({
      endpoint: `/v2/actor-runs/${RUN_ID}`,
      method: "GET",
      elapsedMs: Math.round(performance.now() - runStart),
      outcome: run ? "response" : "empty_response",
    });
  } catch (error) {
    result.requests.push({
      endpoint: `/v2/actor-runs/${RUN_ID}`,
      method: "GET",
      elapsedMs: Math.round(performance.now() - runStart),
      outcome: "error",
      error: safeError(error),
    });
    stop(
      result,
      Number.isInteger(error?.statusCode) && [401, 403].includes(error.statusCode)
        ? "run_metadata_access_denied"
        : "run_metadata_unavailable",
    );
    client.token = undefined;
    client.httpClient.token = undefined;
    process.exitCode = 1;
    return;
  }

  const runUserHash = hashUserId(run?.userId);
  result.run = {
    id: typeof run?.id === "string" ? run.id : null,
    actorId: typeof run?.actId === "string" ? run.actId : null,
    userIdSha256: runUserHash,
    status: typeof run?.status === "string" ? run.status : null,
    permissionLevel: safeEnumField(run ?? {}, "permissionLevel"),
    generalAccess: safeEnumField(run ?? {}, "generalAccess"),
  };

  if (
    !run ||
    run.id !== RUN_ID ||
    run.actId !== EXPECTED_ACTOR_ID ||
    runUserHash === null ||
    typeof run.status !== "string"
  ) {
    stop(result, "unexpected_run_metadata");
    client.token = undefined;
    client.httpClient.token = undefined;
    process.exitCode = 1;
    return;
  }
  writeResult(result);

  let store;
  const storeStart = performance.now();
  if (
    result.apiRequestsAttempted >= MAX_API_REQUESTS ||
    performance.now() - combinedStart >= MAX_TOTAL_REQUEST_TIMEOUT_MS
  ) {
    stop(result, "request_budget_stop");
    client.token = undefined;
    client.httpClient.token = undefined;
    process.exitCode = 1;
    return;
  }
  result.apiRequestsAttempted += 1;
  try {
    store = await client.keyValueStore(STORE_ID).get();
    result.requests.push({
      endpoint: `/v2/key-value-stores/${STORE_ID}`,
      method: "GET",
      elapsedMs: Math.round(performance.now() - storeStart),
      outcome: store ? "response" : "empty_response",
    });
  } catch (error) {
    result.requests.push({
      endpoint: `/v2/key-value-stores/${STORE_ID}`,
      method: "GET",
      elapsedMs: Math.round(performance.now() - storeStart),
      outcome: "error",
      error: safeError(error),
    });
    stop(
      result,
      Number.isInteger(error?.statusCode) && [401, 403].includes(error.statusCode)
        ? "store_metadata_access_denied"
        : "store_metadata_unavailable",
    );
    client.token = undefined;
    client.httpClient.token = undefined;
    process.exitCode = 1;
    return;
  }

  const storeOwnerHash = hashUserId(store?.userId);
  result.store = {
    id: typeof store?.id === "string" ? store.id : null,
    ownerUserIdSha256: storeOwnerHash,
    ownerMatchesS1RunUser: storeOwnerHash === null ? null : storeOwnerHash === runUserHash,
    actorId: typeof store?.actId === "string" ? store.actId : null,
    actorRunId: typeof store?.actRunId === "string" ? store.actRunId : null,
    generalAccess: safeEnumField(store ?? {}, "generalAccess"),
  };

  if (!store || store.id !== STORE_ID) {
    stop(result, "unexpected_store_metadata");
    client.token = undefined;
    client.httpClient.token = undefined;
    process.exitCode = 1;
    return;
  }

  result.elapsedRequestTimeoutMs = Math.round(performance.now() - combinedStart);
  result.finishedAtUtc = new Date().toISOString();
  result.outcome = "metadata_comparison_complete";
  result.interpretationLimit =
    "This reports only metadata exposed to the configured account. Missing ACL fields or an unknown/null generalAccess value do not prove that no individual grant exists. It does not explain the prior Actor-run 403 or prove record/body access.";
  writeResult(result);
  process.stdout.write(
    `${JSON.stringify({ experiment: result.experiment, outcome: result.outcome, apiRequestsAttempted: result.apiRequestsAttempted, ownerMatchesS1RunUser: result.store.ownerMatchesS1RunUser })}\n`,
  );
  client.token = undefined;
  client.httpClient.token = undefined;
};

if (process.argv.includes("--validate-only")) {
  validateOnly();
} else if (process.argv.includes("--check-auth")) {
  checkConfiguredAuthOnly();
} else if (process.argv.includes("--execute-approved")) {
  await executeOnce();
} else {
  process.stdout.write(
    "Use --validate-only or --check-auth for local checks; live requests require --execute-approved after the Main readiness gate.\n",
  );
}
