const REQUIRED_OPTIONS = {
  maxTotalChargeUsd: 1,
  isMaxTotalChargeUsdSetByUser: true,
  memoryMbytes: 256,
  timeoutSecs: 900,
  restartOnError: false,
};

export function verifyRunOptions(run, expectedBuildNumber) {
  const options = run?.options ?? {};
  const checks = {
    runBuild: run?.buildNumber === expectedBuildNumber,
    optionBuild: options.build === expectedBuildNumber,
    ...Object.fromEntries(
      Object.entries(REQUIRED_OPTIONS).map(([key, expected]) => [key, options[key] === expected]),
    ),
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}
