import assert from "node:assert/strict";
import {
  createSignalBridgeObserver,
  restoreObserverForExit,
} from "./actor/r6-signal-bridge-observer.mjs";

function createFakeObserver(getter, options = {}) {
  const prototype = {};
  Object.defineProperty(prototype, "signal", {
    get: getter,
    enumerable: false,
    configurable: true,
  });
  const originalDescriptor = Object.getOwnPropertyDescriptor(prototype, "signal");
  const observer = createSignalBridgeObserver({ requestPrototype: prototype, ...options });
  assert.equal(observer.install(), true, "observer installs on the approved descriptor");
  return { observer, prototype, originalDescriptor, receiver: Object.create(prototype) };
}

{
  const signal = { aborted: false };
  const source = { aborted: false };
  let seenReceiver;
  const { observer, prototype, originalDescriptor, receiver } = createFakeObserver(function getter() {
    seenReceiver = this;
    return signal;
  });
  const promise = Promise.resolve("same-promise");
  const returned = observer.withCapture("q1", 1, source, () => {
    assert.strictEqual(Reflect.get(receiver, "signal"), signal);
    return promise;
  });
  assert.strictEqual(returned, promise, "original fetch Promise is returned unchanged");
  assert.strictEqual(seenReceiver, receiver, "original getter receiver is preserved");
  assert.deepEqual(observer.captureState("q1", 1, source), {
    status: "captured",
    reads: 1,
    unique: 1,
    overflow: false,
    weak: true,
    sourceAborted: false,
    dependentAborted: false,
  });
  const wrappedDescriptor = Object.getOwnPropertyDescriptor(prototype, "signal");
  assert.equal(wrappedDescriptor.enumerable, originalDescriptor.enumerable);
  assert.equal(wrappedDescriptor.configurable, originalDescriptor.configurable);
  assert.strictEqual(wrappedDescriptor.set, originalDescriptor.set);
  assert.equal(observer.restore(), true);
  assert.equal(observer.restore(), true, "repeated cleanup after successful restore remains successful");
  assert.deepEqual(Object.getOwnPropertyDescriptor(prototype, "signal"), originalDescriptor);
  console.log("PASS: descriptor preservation, getter receiver/return, Promise identity, capture, restoration");
}

{
  const signal = { aborted: false };
  const source = { aborted: false };
  const { observer, receiver } = createFakeObserver(() => signal);
  observer.withCapture("q2", 1, source, () => {
    Reflect.get(receiver, "signal");
    Reflect.get(receiver, "signal");
    return Promise.resolve();
  });
  assert.equal(observer.captureState("q2", 1, source).status, "captured");
  assert.equal(observer.captureState("q2", 1, source).reads, 2);
  observer.withCapture("q2", 2, source, () => Promise.resolve());
  assert.equal(observer.captureState("q2", 2, source).status, "unknown", "zero reads fail closed");
  console.log("PASS: one/two getter reads capture; zero reads are Unknown");
}

{
  const source = { aborted: false };
  const signals = [{ aborted: false }, { aborted: false }];
  let index = 0;
  const { observer, receiver } = createFakeObserver(() => signals[index++]);
  observer.withCapture("q3", 1, source, () => {
    Reflect.get(receiver, "signal");
    Reflect.get(receiver, "signal");
  });
  assert.equal(observer.captureState("q3", 1, source).status, "unknown", "two unique signals fail closed");
  console.log("PASS: non-unique dependent signal is Unknown");
}

{
  const source = { aborted: false };
  let originalCalls = 0;
  const signal = { aborted: false };
  const { observer, receiver } = createFakeObserver(() => {
    originalCalls += 1;
    return signal;
  });
  observer.withCapture("q4", 1, source, () => {
    Reflect.get(receiver, "signal");
    Reflect.get(receiver, "signal");
    Reflect.get(receiver, "signal");
    Reflect.get(receiver, "signal");
  });
  const state = observer.captureState("q4", 1, source);
  assert.equal(originalCalls, 4, "getter always forwards even after overflow");
  assert.equal(state.status, "unknown");
  assert.equal(state.reads, "3+");
  assert.equal(state.overflow, true);
  assert.equal(observer.runSummary().unknown, 1);
  assert.equal(observer.runSummary().overflow, 1);
  console.log("PASS: 3+ is Unknown with a separate overflow flag and forwards every getter call");
}

{
  const source = { aborted: false };
  const error = new TypeError("brand check");
  const { observer, receiver } = createFakeObserver(() => {
    throw error;
  });
  assert.throws(
    () => observer.withCapture("q5", 1, source, () => Reflect.get(receiver, "signal")),
    (caught) => caught === error,
    "the original getter throw is preserved by identity",
  );
  assert.equal(observer.captureState("q5", 1, source).status, "unknown");
  console.log("PASS: original getter throw identity and Unknown state");
}

{
  const target = {};
  const originalGetter = function signal() { return { aborted: false }; };
  Object.defineProperty(target, "signal", {
    get: originalGetter,
    configurable: true,
    enumerable: false,
  });
  let installed = false;
  const prototype = new Proxy(target, {
    defineProperty(object, key, descriptor) {
      if (installed && key === "signal" && descriptor.get === originalGetter) return false;
      const result = Reflect.defineProperty(object, key, descriptor);
      if (result && key === "signal" && descriptor.get !== originalGetter) installed = true;
      return result;
    },
  });
  const observer = createSignalBridgeObserver({ requestPrototype: prototype });
  assert.equal(observer.install(), true);
  const restoreResult = restoreObserverForExit(observer, 0);
  assert.equal(restoreResult.restored, false);
  assert.equal(restoreResult.exitCode, 1, "restore failure cannot keep a successful exit code");
  assert.equal(observer.installationStatus, "restore_failed");
  console.log("PASS: failed descriptor restoration invalidates the final exit status");
}

{
  const source = { aborted: false };
  const signal = { aborted: false };
  const { observer, receiver } = createFakeObserver(() => signal);
  const failure = new Error("fetch throws synchronously");
  assert.throws(
    () => observer.withCapture("q6", 1, source, () => {
      Reflect.get(receiver, "signal");
      throw failure;
    }),
    (caught) => caught === failure,
    "the original fetch throw is preserved by identity",
  );
  assert.equal(observer.captureState("q6", 1, source).status, "unknown");
  console.log("PASS: synchronous fetch throw identity and frame cleanup");
}

{
  const source = { aborted: false };
  const signal = { aborted: false };
  const { observer, receiver } = createFakeObserver(() => signal);
  observer.withCapture("outer", 1, source, () => {
    Reflect.get(receiver, "signal");
    observer.withCapture("inner", 1, source, () => {
      Reflect.get(receiver, "signal");
      return Promise.resolve();
    });
    Reflect.get(receiver, "signal");
  });
  assert.equal(observer.captureState("outer", 1, source).status, "captured");
  assert.equal(observer.captureState("outer", 1, source).reads, 2);
  assert.equal(observer.captureState("inner", 1, source).status, "captured");
  assert.equal(observer.captureState("inner", 1, source).reads, 1);
  assert.equal(observer.captureState("outside", 1, source).status, "unknown");
  console.log("PASS: reentrant frame restoration and no scope leakage");
}

{
  const source = { aborted: false };
  const signal = { aborted: false };
  const { observer, receiver } = createFakeObserver(() => signal, {
    makeWeakRef: () => ({ deref: () => undefined }),
  });
  observer.withCapture("q7", 1, source, () => Reflect.get(receiver, "signal"));
  const state = observer.captureState("q7", 1, source);
  assert.equal(state.status, "unknown", "cleared WeakRef is never reported as false");
  assert.equal(state.weak, false);
  assert.equal(state.dependentAborted, null);
  console.log("PASS: expired WeakRef maps to Unknown, not false");
}

{
  const source = { aborted: false };
  const signal = { aborted: false };
  const { observer, receiver } = createFakeObserver(() => signal, { maxWeakReferences: 1 });
  observer.withCapture("q8", 1, source, () => Reflect.get(receiver, "signal"));
  observer.withCapture("q9", 1, source, () => Reflect.get(receiver, "signal"));
  assert.equal(observer.captureState("q8", 1, source).status, "captured");
  assert.equal(observer.captureState("q9", 1, source).status, "unknown", "retention cap fails closed");
  observer.clearRow("q8");
  observer.withCapture("q10", 1, source, () => Reflect.get(receiver, "signal"));
  assert.equal(observer.captureState("q10", 1, source).status, "captured", "terminal row release frees the cap");
  assert.equal(observer.runSummary().maximumRetainedWeakReferences, 1);
  console.log("PASS: WeakRef retention cap and row-terminal release");
}

console.log("R6 observer unit checks passed; no network access used.");
