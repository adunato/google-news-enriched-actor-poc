/* global Buffer:readonly */
import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  acquireCaptureLock,
  cleanupStagingDirectory,
  createStagingDirectory,
  publishStagingDirectory,
  writeStagedFile,
} from "./h4-storage.mjs";

async function absent(path) {
  try {
    await access(path);
    return false;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

test("exclusive capture lock rejects a second run before it can start and is released cleanly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "h4-lock-test-"));
  let first;
  try {
    first = await acquireCaptureLock(directory);
    await assert.rejects(acquireCaptureLock(directory), /Another H4 capture is active/);
    await first.release();
    first = undefined;
    const next = await acquireCaptureLock(directory);
    await next.release();
  } finally {
    if (first) await first.release();
    await rm(directory, { recursive: true, force: true });
  }
});

test("an interrupted incomplete stage never exposes a partial evidence directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "h4-stage-test-"));
  let lock;
  let stage;
  const final = join(directory, "h4-evidence");
  try {
    lock = await acquireCaptureLock(directory);
    stage = await createStagingDirectory(directory);
    await writeStagedFile(stage, "h4-candidates.sealed", Buffer.from("encrypted-placeholder"));
    await assert.rejects(
      publishStagingDirectory(stage, final, [
        "h4-candidates.sealed",
        "h4-calibration.json",
        "h4-freeze.json",
      ]),
      /Incomplete H4 staging artifact/,
    );
    assert.equal(await absent(final), true);
    await assert.rejects(acquireCaptureLock(directory), /Another H4 capture is active/);
  } finally {
    await cleanupStagingDirectory(stage);
    if (lock) await lock.release();
    await rm(directory, { recursive: true, force: true });
  }
});
