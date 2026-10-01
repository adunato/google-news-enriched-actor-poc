import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const paths = [
  path.join(here, "main.mjs"),
  path.join(here, "sdk-stub.mjs"),
  path.join(here, "guard-preload.mjs"),
  path.join(here, "guard-probe-worker.mjs"),
  path.resolve(here, "../../10-direct-readability/src/extract.mjs"),
  path.resolve(here, "../../10-direct-readability/src/extract-worker.mjs"),
  path.resolve(here, "../../10-direct-readability/src/limits.mjs"),
];

export async function inspectImportGraph() {
  const sources = await Promise.all(paths.map((file) => readFile(file, "utf8")));
  const source = sources.join("\n");
  const forbiddenApplicationImports = /(?:network\.mjs|probe\.mjs|hosted-run-controller\.mjs|run-approval\.mjs)/u.test(source);
  const dynamicImports = /\bimport\s*\(/u.test(source);
  const nativeLoads = /(?:process\.dlopen|createRequire\s*\(|require\s*\(|\.node\b)/u.test(source);
  let directUndiciAvailable = true;
  try { import.meta.resolve("undici"); } catch { directUndiciAvailable = false; }
  const readPackage = async (specifier) => JSON.parse(await readFile(new URL("../package.json", import.meta.resolve(specifier)), "utf8"));
  const [apify, apifyClient] = await Promise.all([readPackage("apify"), readPackage("apify-client")]);
  const readability = JSON.parse(await readFile(path.resolve(here, "../../10-direct-readability/node_modules/@mozilla/readability/package.json"), "utf8"));
  const linkedom = JSON.parse(await readFile(path.resolve(here, "../../10-direct-readability/node_modules/linkedom/package.json"), "utf8"));
  const runtimeVersions = { node: process.version, apify: apify.version, apifyClient: apifyClient.version, readability: readability.version, linkedom: linkedom.version };
  const runtimePinned = runtimeVersions.node.startsWith("v20.") && runtimeVersions.apify === "3.7.2" && runtimeVersions.apifyClient === "2.25.0" && runtimeVersions.readability === "0.6.0" && runtimeVersions.linkedom === "0.18.13";
  const checks = {
    reviewedModuleCount: paths.length,
    forbiddenApplicationImports,
    dynamicImports,
    nativeLoads,
    directUndiciAvailable,
    fixtureOnlyEntry: /fixture-only/u.test(sources[0]),
    workerGuardMarkerCheck: /H12_REQUIRE_GUARD/u.test(sources[5]),
    runtimeVersions,
    runtimePinned,
  };
  return { ...checks, passed: !forbiddenApplicationImports && !dynamicImports && !nativeLoads && !directUndiciAvailable && checks.fixtureOnlyEntry && checks.workerGuardMarkerCheck && runtimePinned };
}
