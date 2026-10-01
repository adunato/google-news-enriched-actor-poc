const REQUIRED = Object.freeze({ maxTotalChargeUsd: 1, isMaxTotalChargeUsdSetByUser: true, memoryMbytes: 256, timeoutSecs: 900, restartOnError: false });

export function verifyFutureRunGates({ actor, run }, expectedBuild) {
  const options = run?.options ?? {};
  const checks = {
    actorPrivate: actor?.visibility === "PRIVATE",
    limitedPermissions: actor?.permissionLevel === "LIMITED_PERMISSIONS",
    exactBuild: run?.buildNumber === expectedBuild && options.build === expectedBuild,
    ...Object.fromEntries(Object.entries(REQUIRED).map(([key, expected]) => [key, options[key] === expected])),
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}
