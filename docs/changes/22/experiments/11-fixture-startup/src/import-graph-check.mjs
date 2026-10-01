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
  const forbiddenImportPatternMatched = /(?:network\.mjs|probe\.mjs|hosted-run-controller\.mjs|run-approval\.mjs)/u.test(source);
  const dynamicImportPatternMatched = /\bimport\s*\(/u.test(source);
  const nativeLoadPatternMatched = /(?:process\.dlopen|createRequire\s*\(|require\s*\(|\.node\b)/u.test(source);
  const directUndiciImportPatternMatched = /(?:from\s*["']undici["']|import\s*["']undici["'])/u.test(source);
  const readPackage = async (specifier) => JSON.parse(await readFile(new URL("../package.json", import.meta.resolve(specifier)), "utf8"));
  const [apify, apifyClient] = await Promise.all([readPackage("apify"), readPackage("apify-client")]);
  const readability = JSON.parse(await readFile(path.resolve(here, "../../10-direct-readability/node_modules/@mozilla/readability/package.json"), "utf8"));
  const linkedom = JSON.parse(await readFile(path.resolve(here, "../../10-direct-readability/node_modules/linkedom/package.json"), "utf8"));
  const runtimeVersions = { node: process.version, apify: apify.version, apifyClient: apifyClient.version, readability: readability.version, linkedom: linkedom.version };
  const runtimePinned = runtimeVersions.node.startsWith("v20.") && runtimeVersions.apify === "3.7.2" && runtimeVersions.apifyClient === "2.25.0" && runtimeVersions.readability === "0.6.0" && runtimeVersions.linkedom === "0.18.13";
  const lexicalScreen = {
    type: "fixed-source lexical screen",
    reviewedModuleCount: paths.length,
    reviewedPaths: paths.map((file) => path.relative(here, file).replaceAll("\\", "/")),
    exclusions: [
      "Does not resolve or audit the transitive dependency graph.",
      "Pattern matches do not establish absence of APIs hidden behind aliases, computed names, or dependency internals.",
      "Does not inspect TLS, HTTP/2, WebSocket, child_process, native addons, or arbitrary Worker behavior as a complete capability inventory.",
      "Does not prove process-wide or operating-system-level zero egress.",
    ],
  };
  const checks = {
    reviewedModuleCount: paths.length,
    forbiddenImportPatternMatched,
    dynamicImportPatternMatched,
    nativeLoadPatternMatched,
    directUndiciImportPatternMatched,
    fixtureOnlyEntry: /fixture-only/u.test(sources[0]),
    workerGuardMarkerCheck: /H12_REQUIRE_GUARD/u.test(sources[5]),
    runtimeVersions,
    runtimePinned,
    lexicalScreen,
  };
  return {
    ...checks,
    passed: !forbiddenImportPatternMatched && !dynamicImportPatternMatched && !nativeLoadPatternMatched && !directUndiciImportPatternMatched && checks.fixtureOnlyEntry && checks.workerGuardMarkerCheck && runtimePinned,
  };
}
