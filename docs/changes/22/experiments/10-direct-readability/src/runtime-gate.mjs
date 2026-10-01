const EXPECTED = Object.freeze({
  permissionLevel: "LIMITED_PERMISSIONS",
  memoryMbytes: 256,
  timeoutSecs: 900,
  maxTotalChargeUsd: 1,
  restartOnError: "0",
});

function validId(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 64 && /^[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Check Apify's effective run environment before Actor.init or probe egress.
 * The run ID is allocated by Apify as part of the start request, so it cannot
 * be pinned by the caller before that request. Require it to be present and
 * require the SDK and raw environment representations to agree.
 */
export function inspectHostedRunGate({ actorEnv, processEnv }) {
  const startedMs = actorEnv?.startedAt instanceof Date ? actorEnv.startedAt.getTime() : Date.parse(processEnv?.ACTOR_STARTED_AT ?? "");
  const timeoutMs = actorEnv?.timeoutAt instanceof Date ? actorEnv.timeoutAt.getTime() : Date.parse(processEnv?.ACTOR_TIMEOUT_AT ?? "");
  const timeoutSecs = Number.isFinite(startedMs) && Number.isFinite(timeoutMs) ? (timeoutMs - startedMs) / 1000 : null;
  const rawStartedMs = Date.parse(processEnv?.ACTOR_STARTED_AT ?? "");
  const rawTimeoutMs = Date.parse(processEnv?.ACTOR_TIMEOUT_AT ?? "");
  const buildId = actorEnv?.actorBuildId;
  const buildNumber = actorEnv?.actorBuildNumber;
  const runId = actorEnv?.actorRunId;

  const checks = {
    hostedRuntime: actorEnv?.isAtHome === "1" && processEnv?.APIFY_IS_AT_HOME === "1",
    runIdPresent: validId(runId),
    runIdMatchesEnvironment: !!runId && runId === processEnv?.ACTOR_RUN_ID,
    buildIdPresent: validId(buildId),
    buildIdMatchesEnvironment: !!buildId && buildId === processEnv?.ACTOR_BUILD_ID,
    buildNumberPresent: typeof buildNumber === "string" && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(buildNumber),
    buildNumberMatchesEnvironment: !!buildNumber && buildNumber === processEnv?.ACTOR_BUILD_NUMBER,
    startedAtMatchesEnvironment: Number.isFinite(startedMs) && startedMs === rawStartedMs,
    timeoutAtMatchesEnvironment: Number.isFinite(timeoutMs) && timeoutMs === rawTimeoutMs,
    limitedPermissions: processEnv?.ACTOR_PERMISSION_LEVEL === EXPECTED.permissionLevel,
    memory: actorEnv?.memoryMbytes === EXPECTED.memoryMbytes && Number(processEnv?.ACTOR_MEMORY_MBYTES) === EXPECTED.memoryMbytes,
    timeout: timeoutSecs === EXPECTED.timeoutSecs,
    maxTotalCharge: Number(processEnv?.ACTOR_MAX_TOTAL_CHARGE_USD) === EXPECTED.maxTotalChargeUsd,
    restartDisabled: processEnv?.ACTOR_RESTART_ON_ERROR === EXPECTED.restartOnError,
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

export function assertHostedRunGate(context) {
  const result = inspectHostedRunGate(context);
  if (!result.valid) {
    const failed = Object.entries(result.checks).filter(([, ok]) => !ok).map(([name]) => name);
    const error = new Error("hosted_run_gate_failed");
    error.code = "HOSTED_RUN_GATE_FAILED";
    error.failedChecks = failed;
    throw error;
  }
  return result;
}
