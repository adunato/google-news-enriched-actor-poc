import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const result = JSON.parse(await readFile(path.join(here, 'results.json'), 'utf8'));
const expectedSizes = [8192, 32768, 98304, 196608, 262144];
const expectedShapes = ['semantic_article', 'generic_nested_div'];
const allowedKeys = new Set([
  'caseId', 'shape', 'targetBytes', 'inputBytes', 'status', 'lastStage', 'timeoutStage',
  'startupMs', 'importMs', 'extractMs', 'resultDeliveryMs', 'parentScoringMs',
  'exitAfterResultMs', 'totalMs', 'exitClass', 'outputChars', 'proxyStatus',
  'proxyWordCount', 'proxySegmentCount', 'proxyFivegramUniqueness', 'networkAttempts',
  'rssBytes', 'stopReason',
]);

assert.equal(result.schemaVersion, 'issue22-iteration8-worker-lifecycle-v1');
assert.equal(result.nodeVersion, 'v20.19.0');
assert.equal(result.extractorVersion, '9.0.1');
assert.equal(result.status, 'completed');
assert.equal(result.plannedCaseCount, 10);
assert.equal(result.cases.length, 10);
assert.ok(result.elapsedMs <= result.overallDeadlineMs);
assert.ok(result.peakRssBytes <= result.maxRssBytes);
assert.equal(result.networkRequestsMade, 0);

for (const shape of expectedShapes) {
  for (const targetBytes of expectedSizes) {
    const caseId = `${shape}-${targetBytes / 1024}kib`;
    const item = result.cases.find((candidate) => candidate.caseId === caseId);
    assert.ok(item, `missing case ${caseId}`);
    assert.equal(item.shape, shape);
    assert.equal(item.targetBytes, targetBytes);
    assert.equal(item.inputBytes, targetBytes);
    assert.equal(item.networkAttempts, 0);
    assert.ok(item.rssBytes <= result.maxRssBytes);
    for (const key of Object.keys(item)) assert.ok(allowedKeys.has(key), `unexpected retained field ${key}`);
    if (item.status === 'timeout') {
      assert.equal(item.timeoutStage, 'extract');
      assert.equal(item.exitClass, 'terminated');
      assert.equal(item.extractMs, null);
      assert.equal(item.proxyStatus, null);
    } else {
      assert.equal(item.status, 'quality_rejected');
      assert.equal(item.timeoutStage, null);
      assert.equal(item.exitClass, 'normal');
      assert.ok(item.extractMs >= 0);
      assert.ok(item.resultDeliveryMs >= 0);
      assert.ok(item.parentScoringMs >= 0);
      assert.equal(item.proxyStatus, 'quality_rejected');
    }
  }
}

const text = JSON.stringify(result);
assert.ok(!/fixture\.invalid|https?:\/\/|<html|<article|password|cookie|exception|stack/i.test(text));
console.log('Iteration 8 sanitized result validation passed: 10/10 cases, bounds, phase classes, zero network counters, and retained-field allowlist.');
