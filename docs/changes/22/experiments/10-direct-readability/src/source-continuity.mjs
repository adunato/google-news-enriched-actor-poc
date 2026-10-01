import { execFile as execFileCallback } from "node:child_process";
import { lstat, readdir, realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHostedRunPlan, SOURCE_ALLOWLIST } from "./hosted-run-controller.mjs";

const execFile = promisify(execFileCallback);
const EXPERIMENT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_ENTRIES = new Set([
  "Dockerfile", "experiment.md", "node_modules", "package-lock.json", "package.json",
  "preflight-report.json", "src",
]);

async function git(args, cwd) {
  try {
    const { stdout } = await execFile("git", args, { cwd, windowsHide: true, maxBuffer: 1024 * 1024 });
    return stdout.trim();
  } catch {
    throw new Error("source_continuity_git_check_failed");
  }
}

async function assertNoSymlink(path, root) {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) throw new Error("source_continuity_symlink_rejected");
  const real = await realpath(path);
  const rel = relative(root, real);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("source_continuity_path_escape");
  return metadata;
}

async function inspectPayload(root) {
  await assertNoSymlink(root, root);
  const top = await readdir(root, { withFileTypes: true });
  for (const entry of top) {
    if (!ROOT_ENTRIES.has(entry.name)) throw new Error("source_continuity_unexpected_root_entry");
    const info = await assertNoSymlink(join(root, entry.name), root);
    if (entry.name === "node_modules" && !info.isDirectory()) throw new Error("source_continuity_dependency_dir_invalid");
  }
  const found = [];
  for (const name of SOURCE_ALLOWLIST) {
    const path = join(root, ...name.split("/"));
    let directory = root;
    for (const part of name.split("/")) {
      directory = join(directory, part);
      const info = await assertNoSymlink(directory, root);
      if (directory !== path && !info.isDirectory()) throw new Error("source_continuity_payload_parent_invalid");
    }
    const info = await lstat(path);
    if (!info.isFile()) throw new Error("source_continuity_payload_file_invalid");
    found.push(name);
  }
  const sourceDirectory = join(root, "src");
  const actual = [];
  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      await assertNoSymlink(path, root);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) actual.push(relative(root, path).split(sep).join("/"));
      else throw new Error("source_continuity_special_file_rejected");
    }
  };
  await visit(sourceDirectory);
  const allowedSrc = found.filter((name) => name.startsWith("src/"));
  if (actual.sort().join("\n") !== allowedSrc.sort().join("\n")) throw new Error("source_continuity_payload_manifest_mismatch");
}

/**
 * Require a reviewed commit as an external trust anchor and prove the Actor
 * payload is exactly the clean, fixed allowlist under this experiment root.
 */
export async function verifySourceContinuity({ experimentRoot, trustedHead, repositoryRoot } = {}) {
  if (typeof trustedHead !== "string" || !/^[0-9a-f]{40}$/i.test(trustedHead)) throw new Error("source_continuity_trust_anchor_required");
  const root = resolve(experimentRoot ?? "");
  if (root !== EXPERIMENT_ROOT) throw new Error("source_continuity_wrong_experiment_root");
  const canonicalRoot = await realpath(root);
  if (canonicalRoot !== root) throw new Error("source_continuity_noncanonical_experiment_root");
  await inspectPayload(root);

  const repo = resolve(repositoryRoot ?? dirname(dirname(dirname(dirname(dirname(root))))));
  const head = await git(["rev-parse", "HEAD"], repo);
  if (head.toLowerCase() !== trustedHead.toLowerCase()) throw new Error("source_continuity_head_mismatch");
  const status = await git(["status", "--porcelain=v1", "--untracked-files=all"], repo);
  if (status) throw new Error("source_continuity_worktree_dirty");
  const tracked = (await git(["ls-files", "--", relative(repo, root)], repo)).split(/\r?\n/).filter(Boolean)
    .map((name) => name.slice(relative(repo, root).length + 1).replaceAll("\\", "/"))
    .filter((name) => SOURCE_ALLOWLIST.includes(name));
  if (tracked.sort().join("\n") !== [...SOURCE_ALLOWLIST].sort().join("\n")) throw new Error("source_continuity_tracked_manifest_mismatch");
  const plan = await createHostedRunPlan({ sourceRoot: root });
  return { valid: true, head, sourceManifestSha256: plan.sourceManifestSha256, sourcePaths: plan.sourcePaths };
}

export function experimentRootFromModule() { return EXPERIMENT_ROOT; }
