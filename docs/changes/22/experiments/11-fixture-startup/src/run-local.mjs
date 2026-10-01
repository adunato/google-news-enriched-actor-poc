import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../../..");
const main = path.join(here, "main.mjs");
const preload = path.join(here, "guard-preload.mjs");
const discover = process.argv.includes("--discover-tuples");
const args = ["--import", pathToFileURL(preload).href, main];
const env = {
  ...process.env,
  H12_DISCOVER_TUPLES: discover ? "1" : "0",
  H12_TUPLE_MANIFEST: path.join(here, "tuple-manifest.json"),
  H12_PHASE: "bootstrap",
  H12_LOCAL_PORT: "43821",
  APIFY_API_BASE_URL: "http://127.0.0.1:43821",
  APIFY_IS_AT_HOME: "1",
  ACTOR_EVENTS_WEBSOCKET_URL: "",
  APIFY_TOKEN: "h12-local-only-token",
  ACTOR_RUN_ID: "H12fixtureRun00000000000001",
  ACTOR_ID: "H12fixtureActor0000000001",
  ACTOR_BUILD_ID: "H12fixtureBuild000000000001",
  ACTOR_BUILD_NUMBER: "11.0.0",
  CRAWLEE_PURGE_ON_START: "0",
  APIFY_DEFAULT_KEY_VALUE_STORE_ID: "issue22-h12-local-store",
  CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID: "issue22-h12-local-store",
  APIFY_DEFAULT_DATASET_ID: "issue22-h12-local-store",
  CRAWLEE_DEFAULT_DATASET_ID: "issue22-h12-local-store",
};
for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete env[key];
const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
let output = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => { output += chunk; });
const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
let result;
try { result = JSON.parse(output.trim().split(/\r?\n/).at(-1)); } catch { result = { schemaVersion: "issue22-h12-local-result-v1", outcome: "unclassified_startup_failure", fixtureOnly: true }; }
process.stdout.write(`${JSON.stringify(result)}\n`);
if (process.argv.includes("--write-evidence")) {
  await writeFile(path.resolve(here, "../evidence/local-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
process.exitCode = exitCode ?? 1;
