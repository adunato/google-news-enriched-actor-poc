/* global process:readonly */
import { access, link, mkdir, open, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export async function acquireCaptureLock(directory) {
  const path = join(directory, "h4-capture.lock");
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        "Another H4 capture is active or a prior interrupted capture left h4-capture.lock; verify the owning process before recovery.",
      );
    }
    throw error;
  }
  try {
    await handle.writeFile(
      `${JSON.stringify({ pid: process.pid, startedAtUtc: new Date().toISOString() })}\n`,
    );
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(path, { force: true });
    throw error;
  }
  return {
    path,
    async release() {
      await handle.close();
      await rm(path, { force: true });
    },
  };
}

export async function createStagingDirectory(directory) {
  const path = join(directory, `.h4-stage-${process.pid}-${randomUUID()}`);
  await mkdir(path, { mode: 0o700 });
  return path;
}

export async function publishStagingDirectory(stage, destination, requiredFiles) {
  for (const file of requiredFiles) {
    let info;
    try {
      info = await stat(join(stage, file));
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Incomplete H4 staging artifact: ${file}`);
      throw error;
    }
    if (!info.isFile()) throw new Error(`Incomplete H4 staging artifact: ${file}`);
  }
  try {
    await access(destination);
    throw new Error("H4 evidence directory already exists; refusing to replace a prior run.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await rename(stage, destination);
  return destination;
}

export async function writeStagedFile(directory, filename, bytes) {
  const path = join(directory, filename);
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return path;
}

export async function writeFileAtomically(directory, filename, bytes) {
  const temporary = join(directory, `.${filename}.${randomUUID()}.tmp`);
  const destination = join(directory, filename);
  await writeStagedFile(directory, temporary.split(/[\\/]/).at(-1), bytes);
  try {
    await link(temporary, destination);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return destination;
}

export async function cleanupStagingDirectory(path) {
  if (!path) return;
  await rm(path, { recursive: true, force: true });
}

export async function listStagingDirectories(directory) {
  return (await readdir(directory)).filter((name) => name.startsWith(".h4-stage-"));
}
