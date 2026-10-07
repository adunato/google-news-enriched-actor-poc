import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

const prefix = "ISSUE41_R4 ";
const rowId = "x".repeat(32);
const bridge = {
  status: "unknown",
  reads: "3+",
  unique: 2,
  overflow: true,
  weak: false,
  sourceAborted: true,
  dependentAborted: null,
};
const baseState = {
  signalAborted: true,
  requestPending: false,
  readIndex: 2_097_152,
  readInFlight: true,
  readerClosedState: "rejected",
  cancellationPending: true,
  cleanupPending: true,
  cumulativeBodyBytes: 2_097_152,
  lastEventAgeMs: 900_000,
};

function lineBytes(record) {
  return Buffer.byteLength(`${prefix}${JSON.stringify(record)}`, "utf8") + 1;
}

const samples = [
  {
    label: "request_attempt_end",
    record: {
      rowId,
      attemptOrdinal: 6,
      sequence: 40,
      elapsedMs: 900_000,
      event: "request_attempt_end",
      phase: "request_failed",
      state: {
        ...baseState,
        responseStatus: 599,
        mediaTypeClass: "unknown",
        redirectCount: 5,
        errorClass: "UnknownError",
        errorCode: "ERR_INVALID_STATE",
        r6SignalBridge: bridge,
      },
    },
  },
  {
    label: "post_abort_snapshot_30000",
    record: {
      rowId,
      attemptOrdinal: 6,
      sequence: 40,
      elapsedMs: 900_000,
      event: "post_abort_snapshot_30000",
      phase: "body_read_in_flight",
      state: {
        ...baseState,
        snapshotScheduledMs: 30_000,
        snapshotActualMs: 900_000,
        timerDelayMs: 870_000,
        actualPhaseAtSnapshot: "body_read_in_flight",
        r6SignalBridge: bridge,
      },
    },
  },
  {
    label: "row_terminal",
    record: {
      rowId,
      attemptOrdinal: 6,
      sequence: 40,
      elapsedMs: 900_000,
      event: "row_terminal",
      phase: "row_terminal",
      state: {
        ...baseState,
        r6SignalBridge: bridge,
        r6SignalBridgeSummary: {
          attempts: 6,
          captured: 6,
          unknown: 6,
          overflow: 6,
          lastAttemptOrdinal: 6,
        },
        counters: {
          attempted: 40,
          emitted: 40,
          dropped: 40,
          deduplicated: 40,
          bytes: 4_194_304,
        },
      },
    },
  },
  {
    label: "run_summary",
    record: {
      rowId: "run",
      attemptOrdinal: null,
      sequence: 4_006,
      elapsedMs: 900_000,
      event: "run_summary",
      phase: "run_summary",
      state: {
        attempted: 4_006,
        emitted: 4_006,
        dropped: 4_006,
        deduplicated: 4_006,
        bytes: 4_194_304,
        droppedGlobalOverflow: true,
        r6SignalBridge: {
          attempts: 600,
          captured: 600,
          unknown: 600,
          overflow: 600,
          retainedWeakReferences: 600,
          maximumRetainedWeakReferences: 600,
          installationStatus: "restore_failed",
        },
      },
    },
  },
];

const results = samples.map(({ label, record }) => ({ label, bytesIncludingPrefixAndNewline: lineBytes(record) }));
for (const result of results) {
  assert.ok(
    result.bytesIncludingPrefixAndNewline <= 768,
    `${result.label} fits the 768-byte existing marker cap (${result.bytesIncludingPrefixAndNewline})`,
  );
}
assert.ok(4_006 * 768 <= 4 * 1024 * 1024, "existing per-record maximum fits within the 4 MiB total cap");
assert.equal(samples.length, 4, "R6 enriches existing marker kinds only; it adds no marker kind");
console.log(`R6_EVIDENCE_CAP_RESULT ${JSON.stringify({ records: results, maxMarkerBytes: 768, maxMarkers: 4006, totalByteCap: 4 * 1024 * 1024, worstCaseAllRecordsBytes: 4006 * 768 })}`);
