import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyRunOptions } from "./verify-run-options.mjs";

const evidence = JSON.parse(await readFile(new URL("../run-options-verification.json", import.meta.url), "utf8"));
const expectedBuildNumber = "0.7.1";

const actualSanitizedShape = verifyRunOptions(evidence.run, expectedBuildNumber);
assert.equal(actualSanitizedShape.valid, true);

const syntheticValid = {
  buildNumber: expectedBuildNumber,
  options: {
    build: expectedBuildNumber,
    maxTotalChargeUsd: 1,
    isMaxTotalChargeUsdSetByUser: true,
    memoryMbytes: 256,
    timeoutSecs: 900,
    restartOnError: false,
  },
};
assert.equal(verifyRunOptions(syntheticValid, expectedBuildNumber).valid, true);

const rootFlagOnly = {
  buildNumber: expectedBuildNumber,
  isMaxTotalChargeUsdSetByUser: true,
  options: {
    build: expectedBuildNumber,
    maxTotalChargeUsd: 1,
    memoryMbytes: 256,
    timeoutSecs: 900,
    restartOnError: false,
  },
};
const rootFlagResult = verifyRunOptions(rootFlagOnly, expectedBuildNumber);
assert.equal(rootFlagResult.valid, false);
assert.equal(rootFlagResult.checks.isMaxTotalChargeUsdSetByUser, false);
assert.equal(verifyRunOptions(syntheticValid, "different-build").valid, false);

const report = {
  actualSanitizedShapePassed: actualSanitizedShape.valid,
  actualBuildMatchedExactly: actualSanitizedShape.checks.runBuild && actualSanitizedShape.checks.optionBuild,
  syntheticValidShapePassed: true,
  rootLevelOnlyFlagRejected: true,
  wrongBuildRejected: true,
  runOptionsRequireNestedUserSetFlag: true,
};
console.log(JSON.stringify(report));
