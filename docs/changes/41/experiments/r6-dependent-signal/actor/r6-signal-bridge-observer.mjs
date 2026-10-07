const MAX_GETTER_READS = 2;
const MAX_WEAK_REFERENCES = 600;

export function createSignalBridgeObserver({
  requestPrototype = globalThis.Request?.prototype,
  makeWeakRef = (value) => new WeakRef(value),
  maxWeakReferences = MAX_WEAK_REFERENCES,
} = {}) {
  const originalDescriptor = requestPrototype
    ? Object.getOwnPropertyDescriptor(requestPrototype, "signal")
    : undefined;
  const originalGetter = originalDescriptor?.get;
  let activeFrame = null;
  let installed = false;
  let installStatus = "not_installed";
  let retainedWeakReferences = 0;
  let maximumRetainedWeakReferences = 0;
  const capturesByRow = new Map();
  const totals = { attempts: 0, captured: 0, unknown: 0, overflow: 0 };

  function captureGetter() {
    const frame = activeFrame;
    if (!frame) return Reflect.apply(originalGetter, this, []);

    if (frame.reads < MAX_GETTER_READS) {
      frame.reads += 1;
    } else {
      frame.reads = MAX_GETTER_READS + 1;
      frame.overflow = true;
      frame.invalid = true;
    }

    let value;
    try {
      value = Reflect.apply(originalGetter, this, []);
    } catch (error) {
      frame.invalid = true;
      throw error;
    }

    if (!frame.overflow) {
      if (value === null || (typeof value !== "object" && typeof value !== "function")) {
        frame.invalid = true;
      } else if (frame.uniqueSignal === null) {
        frame.uniqueSignal = value;
        frame.uniqueCount = 1;
      } else if (frame.uniqueSignal !== value) {
        frame.uniqueCount = 2;
        frame.invalid = true;
      }
    }
    return value;
  }

  function install() {
    if (!requestPrototype || typeof originalGetter !== "function" || !originalDescriptor) {
      installStatus = "invalid_descriptor";
      return false;
    }
    try {
      Object.defineProperty(requestPrototype, "signal", {
        ...originalDescriptor,
        get: captureGetter,
      });
      installed = true;
      installStatus = "installed";
      return true;
    } catch {
      installStatus = "install_failed";
      return false;
    }
  }

  function restore() {
    if (!installed) return installStatus === "not_installed" || installStatus === "restored";
    try {
      Object.defineProperty(requestPrototype, "signal", originalDescriptor);
      installed = false;
      installStatus = "restored";
      return true;
    } catch {
      installStatus = "restore_failed";
      return false;
    }
  }

  function storeCapture(frame) {
    totals.attempts += 1;
    let status = "unknown";
    let reference = null;
    if (frame.overflow) {
      totals.overflow += 1;
    } else if (
      !frame.invalid &&
      frame.reads >= 1 &&
      frame.reads <= MAX_GETTER_READS &&
      frame.uniqueCount === 1 &&
      frame.uniqueSignal !== frame.sourceSignal &&
      retainedWeakReferences < maxWeakReferences
    ) {
      try {
        reference = makeWeakRef(frame.uniqueSignal);
        if (reference && typeof reference.deref === "function") {
          retainedWeakReferences += 1;
          maximumRetainedWeakReferences = Math.max(
            maximumRetainedWeakReferences,
            retainedWeakReferences,
          );
          status = "captured";
          totals.captured += 1;
        }
      } catch {
        reference = null;
      }
    }
    if (status === "unknown") totals.unknown += 1;

    let attempts = capturesByRow.get(frame.rowId);
    if (!attempts) {
      attempts = new Map();
      capturesByRow.set(frame.rowId, attempts);
    }
    attempts.set(frame.attemptOrdinal, {
      status,
      reads: frame.reads,
      uniqueCount: frame.uniqueCount,
      overflow: frame.overflow,
      reference,
    });
  }

  function withCapture(rowId, attemptOrdinal, sourceSignal, invokeOriginalFetch) {
    const parent = activeFrame;
    const frame = {
      rowId,
      attemptOrdinal,
      sourceSignal,
      reads: 0,
      uniqueSignal: null,
      uniqueCount: 0,
      overflow: false,
      invalid: false,
    };
    activeFrame = frame;
    let result;
    let thrown = false;
    let thrownValue;
    try {
      result = invokeOriginalFetch();
    } catch (error) {
      thrown = true;
      thrownValue = error;
      frame.invalid = true;
    } finally {
      activeFrame = parent;
      try {
        storeCapture(frame);
      } catch {
        totals.unknown += 1;
      }
    }
    if (thrown) throw thrownValue;
    return result;
  }

  function captureState(rowId, attemptOrdinal, sourceSignal) {
    const capture = capturesByRow.get(rowId)?.get(attemptOrdinal);
    if (!capture) {
      return {
        status: "unknown",
        reads: 0,
        unique: 0,
        weak: false,
        sourceAborted: Boolean(sourceSignal?.aborted),
        dependentAborted: null,
      };
    }
    let dependent = null;
    let weak = false;
    if (capture.reference) {
      try {
        const value = capture.reference.deref();
        if (value) {
          weak = true;
          dependent = Boolean(value.aborted);
        }
      } catch {
        weak = false;
      }
    }
    const status = capture.status === "captured" && !weak ? "unknown" : capture.status;
    return {
      status,
      reads: capture.reads > MAX_GETTER_READS ? "3+" : capture.reads,
      unique: capture.uniqueCount,
      overflow: capture.overflow,
      weak,
      sourceAborted: Boolean(sourceSignal?.aborted),
      dependentAborted: dependent,
    };
  }

  function rowSummary(rowId, sourceSignal, lastAttemptOrdinal) {
    const attempts = capturesByRow.get(rowId);
    let captured = 0;
    let unknown = 0;
    let overflow = 0;
    if (attempts) {
      for (const capture of attempts.values()) {
        if (capture.status === "captured") captured += 1;
        else unknown += 1;
        if (capture.overflow) overflow += 1;
      }
    }
    return {
      attempts: attempts?.size ?? 0,
      captured,
      unknown,
      overflow,
      last: captureState(rowId, lastAttemptOrdinal, sourceSignal),
    };
  }

  function clearRow(rowId) {
    const attempts = capturesByRow.get(rowId);
    if (attempts) {
      for (const capture of attempts.values()) {
        if (capture.reference) retainedWeakReferences = Math.max(0, retainedWeakReferences - 1);
      }
    }
    capturesByRow.delete(rowId);
  }

  function runSummary() {
    return {
      ...totals,
      retainedWeakReferences,
      maximumRetainedWeakReferences,
      installationStatus: installStatus,
    };
  }

  return {
    install,
    restore,
    withCapture,
    captureState,
    rowSummary,
    clearRow,
    runSummary,
    get installationStatus() {
      return installStatus;
    },
    get installed() {
      return installed;
    },
  };
}

export function restoreObserverForExit(observer, exitCode) {
  const restored = observer.restore();
  return { restored, exitCode: restored ? exitCode : 1 };
}
