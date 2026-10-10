import { performance } from "node:perf_hooks";
import { processRow } from "./baseline.mjs";

if (process.env.ISSUE41_TEST_HANG_STARTUP === "1") {
  setInterval(() => {}, 1_000);
  await new Promise(() => {});
}

const started = performance.now();
const send = (message, callback = () => {}) => {
  try {
    if (process.send) process.send(message, () => callback());
    else callback();
  } catch {
    // Timing is observational and must not replace the row result.
    callback();
  }
};

send({ type: "ready", childElapsedMs: 0 });
try {
  const { row, sampleId } = await new Promise((resolve, reject) => {
    process.once("message", resolve);
    process.once("disconnect", () => reject(new Error("Parent disconnected before row input")));
  });
  const result = await processRow(row, sampleId, (stage) => {
    send({ type: "timing", stage, childElapsedMs: performance.now() - started });
  });
  send({ type: "result", result, childElapsedMs: performance.now() - started }, () => process.disconnect());
} catch (error) {
  send({
    type: "error",
    errorClass: error instanceof Error ? error.name : "UnknownError",
    childElapsedMs: performance.now() - started,
  }, () => process.disconnect());
  process.exitCode = 1;
}
