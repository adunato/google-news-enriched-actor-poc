const REQUIRED = Object.freeze({ memoryMbytes: 256, timeoutSecs: 180, maxTotalChargeUsd: 0.1, restartOnError: false, maxRetries: 0 });

export function verifyRuntimeGate({ actorEnv, processEnv, run, sdkApiMaxRetries }) {
  const started = actorEnv?.startedAt instanceof Date ? actorEnv.startedAt.getTime() : Date.parse(processEnv?.ACTOR_STARTED_AT ?? "");
  const timeout = actorEnv?.timeoutAt instanceof Date ? actorEnv.timeoutAt.getTime() : Date.parse(processEnv?.ACTOR_TIMEOUT_AT ?? "");
  const options = run?.options ?? {};
  const checks = {
    hostedRuntime: actorEnv?.isAtHome === "1" && processEnv?.APIFY_IS_AT_HOME === "1",
    runIdentityPresent: typeof actorEnv?.actorRunId === "string" && actorEnv.actorRunId === processEnv?.ACTOR_RUN_ID,
    buildIdentityPresent: typeof actorEnv?.actorBuildId === "string" && actorEnv.actorBuildId === processEnv?.ACTOR_BUILD_ID && actorEnv.actorBuildNumber === processEnv?.ACTOR_BUILD_NUMBER,
    limitedPermissions: processEnv?.ACTOR_PERMISSION_LEVEL === "LIMITED_PERMISSIONS",
    memory: actorEnv?.memoryMbytes === REQUIRED.memoryMbytes && Number(processEnv?.ACTOR_MEMORY_MBYTES) === REQUIRED.memoryMbytes && options.memoryMbytes === REQUIRED.memoryMbytes,
    timeout: Number.isFinite(started) && timeout - started === REQUIRED.timeoutSecs * 1000 && options.timeoutSecs === REQUIRED.timeoutSecs,
    chargeCap: Number(processEnv?.ACTOR_MAX_TOTAL_CHARGE_USD) === REQUIRED.maxTotalChargeUsd && options.maxTotalChargeUsd === REQUIRED.maxTotalChargeUsd,
    restartDisabled: processEnv?.ACTOR_RESTART_ON_ERROR === "0" && options.restartOnError === REQUIRED.restartOnError,
    sdkRetriesDisabled: sdkApiMaxRetries === REQUIRED.maxRetries,
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}
