import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["--test", "test/classify-origin.test.mjs", "test/hosted-launcher.test.mjs"], {
  cwd: root,
  encoding: "utf8",
  timeout: 15000,
});
if (result.status !== 0) {
  process.stderr.write("h15_local_preflight_failed\n");
  process.exitCode = 1;
} else {
  process.stdout.write("h15_local_preflight_passed\n");
}
