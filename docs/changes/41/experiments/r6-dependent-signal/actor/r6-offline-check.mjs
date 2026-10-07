import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createSignalBridgeObserver } from "./r6-signal-bridge-observer.mjs";

const EXPECTED_NODE = "v20.20.2";
const EXPECTED_UNDICI = "6.24.1";
const DATA_URL = "data:text/plain,issue41-r6-signal-observer";
const CALLS_PER_VARIANT = 1000;
const WARMUP_CALLS = 100;

if (process.version !== EXPECTED_NODE || process.versions.undici !== EXPECTED_UNDICI) {
  throw new Error(
    `R6 exact-runtime gate failed: node=${process.version}; undici=${process.versions.undici ?? "unknown"}`,
  );
}

const observer = createSignalBridgeObserver();
const originalDescriptor = Object.getOwnPropertyDescriptor(Request.prototype, "signal");
assert.equal(observer.install(), true, "Request.prototype.signal observer installs");

let nativeBrandError;
try {
  Reflect.apply(originalDescriptor.get, {}, []);
} catch (error) {
  nativeBrandError = error;
}
assert.ok(nativeBrandError instanceof TypeError, "native getter rejects an invalid receiver");
let wrappedBrandError;
const brandCheckSourceSignal = new AbortController().signal;
observer.withCapture("r6-invalid-receiver", 1, brandCheckSourceSignal, () => {
  try {
    Reflect.get(Request.prototype, "signal", {});
  } catch (error) {
    wrappedBrandError = error;
  }
  return Promise.resolve();
});
assert.ok(wrappedBrandError instanceof TypeError, "wrapped native getter preserves the brand failure");
assert.equal(wrappedBrandError.name, nativeBrandError.name);
assert.equal(wrappedBrandError.message, nativeBrandError.message);
assert.equal(observer.captureState("r6-invalid-receiver", 1, brandCheckSourceSignal).status, "unknown");
observer.clearRow("r6-invalid-receiver");

const pending = [];
const readDistribution = { 0: 0, 1: 0, 2: 0, "3+": 0 };
let maximumGetterReads = 0;

function issueDataFetch(rowId, attemptOrdinal, instrumented) {
  const sourceSignal = new AbortController().signal;
  const started = performance.now();
  const promise = instrumented
    ? observer.withCapture(rowId, attemptOrdinal, sourceSignal, () =>
        fetch(DATA_URL, { method: "GET", signal: sourceSignal }),
      )
    : fetch(DATA_URL, { method: "GET", signal: sourceSignal });
  const elapsedMs = performance.now() - started;
  if (instrumented) {
    const capture = observer.captureState(rowId, attemptOrdinal, sourceSignal);
    assert.equal(capture.status, "captured", "data: fetch has a correlated dependent signal");
    assert.equal(capture.unique, 1, "getter reads identify one unique dependent signal");
    assert.equal(capture.weak, true, "dependent signal WeakRef remains available at fetch return");
    assert.notStrictEqual(capture.dependentAborted, null);
    const bucket = String(capture.reads);
    assert.ok(Object.hasOwn(readDistribution, bucket), `getter-read count ${bucket} is within cap`);
    readDistribution[bucket] += 1;
    maximumGetterReads = Math.max(maximumGetterReads, Number(capture.reads));
  }
  pending.push(promise);
  return elapsedMs;
}

async function drain(rowId) {
  const results = await Promise.allSettled(pending.splice(0));
  assert.ok(results.every((result) => result.status === "fulfilled"), "data: fetches settle normally");
  if (rowId) observer.clearRow(rowId);
}

for (let i = 0; i < WARMUP_CALLS; i += 1) issueDataFetch("r6-warmup-baseline", i + 1, false);
await drain();
for (let i = 0; i < WARMUP_CALLS; i += 1) issueDataFetch("r6-warmup-instrumented", i + 1, true);
await drain("r6-warmup-instrumented");

const baselineDurations = new Array(CALLS_PER_VARIANT);
const instrumentedDurations = new Array(CALLS_PER_VARIANT);
for (let pair = 0; pair < 10; pair += 1) {
  const rowId = `r6-bench-${pair}`;
  const firstIsInstrumented = pair % 2 === 1;
  for (let i = 0; i < 100; i += 1) {
    const index = pair * 100 + i;
    if (firstIsInstrumented) {
      instrumentedDurations[index] = issueDataFetch(rowId, index + 1, true);
      baselineDurations[index] = issueDataFetch(rowId, index + 1001, false);
    } else {
      baselineDurations[index] = issueDataFetch(rowId, index + 1, false);
      instrumentedDurations[index] = issueDataFetch(rowId, index + 1001, true);
    }
  }
  await drain(rowId);
}

const deltas = instrumentedDurations.map((value, index) => value - baselineDurations[index]);
const sorted = [...deltas].sort((left, right) => left - right);
const nearestRank = (percent) => sorted[Math.max(0, Math.ceil(percent * sorted.length) - 1)];
const sumMs = deltas.reduce((sum, value) => sum + value, 0);
const result = {
  node: process.version,
  bundledUndici: process.versions.undici,
  networkMode: "data: only; no publisher or external requests",
  warmupCallsPerVariant: WARMUP_CALLS,
  measuredCallsPerVariant: CALLS_PER_VARIANT,
  pairedAlternatingBatches: 10,
  getterReadDistribution: readDistribution,
  maximumGetterReads,
  nativeInvalidReceiver: {
    forwardedType: wrappedBrandError.name,
    forwardedMessage: wrappedBrandError.message,
    matchesUnwrappedShape: wrappedBrandError.name === nativeBrandError.name && wrappedBrandError.message === nativeBrandError.message,
  },
  addedSynchronousFetchCallMs: {
    p95: nearestRank(0.95),
    p99: nearestRank(0.99),
    mean: sumMs / deltas.length,
    sum: sumMs,
    maximum: Math.max(...deltas),
  },
  grossScreenPass:
    nearestRank(0.95) <= 1 && nearestRank(0.99) <= 5,
  interpretation:
    "Percentiles are a gross overhead screen only; they do not bound the maximum, live row/run tail, or 10-second timeout perturbation.",
};

assert.ok(maximumGetterReads <= 2, "no data: fetch frame exceeds the two-read source maximum");
assert.ok(result.grossScreenPass, "offline paired overhead screen passes approved limits");
assert.equal(observer.restore(), true, "Request.prototype.signal original descriptor restores");
assert.deepEqual(Object.getOwnPropertyDescriptor(Request.prototype, "signal"), originalDescriptor);
console.log(`R6_OFFLINE_OBSERVER_RESULT ${JSON.stringify(result)}`);
