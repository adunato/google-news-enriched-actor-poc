const validId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
const validMarker = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validBuildNumber = (value) => typeof value === "string" && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value);

export function inspectLaunchTuple({ input, actorEnv, processEnv }) {
  const checks = {
    inputObject: !!input && typeof input === "object" && !Array.isArray(input),
    marker: validMarker(input?.i10LaunchMarker),
    actorId: validId(input?.expectedActorId) && input?.expectedActorId === processEnv?.ACTOR_ID,
    runId: validId(actorEnv?.actorRunId) && actorEnv.actorRunId === processEnv?.ACTOR_RUN_ID,
    buildId: validId(input?.expectedBuildId) && input.expectedBuildId === actorEnv?.actorBuildId && input.expectedBuildId === processEnv?.ACTOR_BUILD_ID,
    buildNumber: validBuildNumber(input?.expectedBuildNumber) && input.expectedBuildNumber === actorEnv?.actorBuildNumber && input.expectedBuildNumber === processEnv?.ACTOR_BUILD_NUMBER,
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

export function approvalRecordMatches(record, expected) {
  return !!record && record.schemaVersion === "i10-run-approval-v1" &&
    record.marker === expected.marker && record.actorId === expected.actorId &&
    record.buildId === expected.buildId && record.buildNumber === expected.buildNumber && record.runId === expected.runId;
}

export async function waitForRunApproval({ getRecord, expected, timeoutMs = 30000, pollMs = 500, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), clock = Date.now }) {
  if (typeof getRecord !== "function" || !validMarker(expected?.marker) || !validId(expected?.actorId) ||
    !validId(expected?.buildId) || !validBuildNumber(expected?.buildNumber) || !validId(expected?.runId)) throw new Error("run_approval_expectation_invalid");
  const deadline = clock() + timeoutMs;
  while (clock() < deadline) {
    const record = await getRecord();
    if (record !== null && record !== undefined) {
      if (!approvalRecordMatches(record, expected)) throw new Error("run_approval_record_mismatch");
      return true;
    }
    await sleep(Math.min(pollMs, Math.max(0, deadline - clock())));
  }
  throw new Error("run_approval_record_timeout");
}
