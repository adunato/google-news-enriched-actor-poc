/* global Buffer:readonly */

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function cancelResponseBody(response, logStage, phase, r2Trace) {
  r2Trace?.cancelEntered();
  logStage("cancel", { phase: `${phase}_start` });
  try {
    await response.body?.cancel();
    r2Trace?.cancelSettled();
  } catch (error) {
    r2Trace?.cancelSettled(error);
    throw error;
  }
  logStage("cancel", { phase: `${phase}_complete` });
}

export async function readBoundedBody(response, logStage, r2Trace) {
  logStage("body_read", { phase: "start" });
  r2Trace?.setPhase("body_read_start");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    await cancelResponseBody(response, logStage, "declared_limit", r2Trace);
    throw Object.assign(new Error("Response exceeds the configured body bound"), {
      code: "BODY_LIMIT",
    });
  }
  if (!response.body) {
    logStage("body_read", { phase: "complete", bodyBytes: 0 });
    r2Trace?.bodyReadCompleted();
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  r2Trace?.readerAcquired(reader);
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      r2Trace?.readEntered();
      let readResult;
      try {
        readResult = await reader.read();
        r2Trace?.readSettled();
      } catch (error) {
        r2Trace?.readSettled(error);
        throw error;
      }
      const { done, value } = readResult;
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        logStage("cancel", { phase: "stream_limit_start" });
        r2Trace?.cancelEntered();
        try {
          await reader.cancel();
          r2Trace?.cancelSettled();
        } catch (error) {
          r2Trace?.cancelSettled(error);
          throw error;
        }
        logStage("cancel", { phase: "stream_limit_complete" });
        throw Object.assign(new Error("Response exceeds the configured body bound"), {
          code: "BODY_LIMIT",
        });
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  logStage("body_read", { phase: "complete", bodyBytes: byteLength });
  r2Trace?.bodyReadCompleted();
  return Buffer.concat(chunks, byteLength);
}
