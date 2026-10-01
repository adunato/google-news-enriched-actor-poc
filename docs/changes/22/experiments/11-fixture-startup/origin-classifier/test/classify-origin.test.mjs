import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { classifyApiBaseUrl } from "../src/classify-origin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outputKeys = [
  "schemaVersion", "startupMarker", "outcome", "baseUrlPresent", "classification", "schemeClass", "hostClass", "portClass", "pathClass",
  "hasUserInfo", "hasQuery", "hasFragment", "runtimeContext", "provenance", "networkDispatch", "sdkImported",
];

function summary(raw, isAtHome) {
  return classifyApiBaseUrl(raw, isAtHome);
}

test("missing and malformed values produce fixed categories without raw values", () => {
  assert.equal(summary(undefined).classification, "missing");
  assert.equal(summary("").classification, "empty");
  assert.equal(summary(" https://api.apify.com").classification, "malformed");
  assert.equal(summary("not a URL").classification, "malformed");
  assert.equal(summary("x".repeat(2049)).classification, "too_long");
});

test("all input classes emit the identical ordered key set and stable value types", () => {
  const samples = [
    summary(undefined),
    summary("not a URL"),
    summary("x".repeat(2049)),
    summary("https://api.apify.com/v2"),
    summary("http://10.12.4.8:3000/v2", "1"),
  ];
  const expectedTypes = ["string", "string", "string", "boolean", "string", "nullable-string", "nullable-string", "nullable-string", "nullable-string",
    "boolean", "boolean", "boolean", "string", "string", "string", "boolean"];
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
    const sample = samples[sampleIndex];
    assert.deepEqual(Object.keys(sample), outputKeys);
    assert.equal(Object.values(sample).some((value) => value === undefined), false);
    const actualTypes = Object.values(sample).map((value) => value === null ? "nullable-string" : typeof value);
    for (let i = 0; i < actualTypes.length; i++) {
      if (expectedTypes[i] === "nullable-string") assert.ok(actualTypes[i] === "nullable-string" || actualTypes[i] === "string");
      else assert.equal(actualTypes[i], expectedTypes[i]);
    }
    if (sampleIndex < 3) {
      for (const key of ["schemeClass", "hostClass", "portClass", "pathClass"]) assert.equal(sample[key], null);
      for (const key of ["hasUserInfo", "hasQuery", "hasFragment"]) assert.equal(sample[key], false);
    } else {
      for (const key of ["schemeClass", "hostClass", "portClass", "pathClass"]) assert.equal(typeof sample[key], "string");
    }
  }
});

test("documented public API and ordinary URL shapes are categorized without retaining host or path", () => {
  const documented = summary("https://api.apify.com/v2");
  assert.equal(documented.classification, "documented_public_apify_api_shape");
  assert.equal(documented.hostClass, "documented_public_apify_api_host");
  assert.equal(documented.pathClass, "api_v2_prefix");
  assert.equal(documented.schemeClass, "https");
  assert.equal(documented.portClass, "effective_default");
  assert.equal(JSON.stringify(documented).includes("api.apify.com"), false);
  assert.equal(JSON.stringify(documented).includes("/v2"), false);

  assert.equal(summary("https://service.example.invalid/base").classification, "public_or_other_origin_unverified");
  assert.equal(summary("https://service.apify.com").classification, "other_apify_domain_unverified");
  assert.equal(summary("ftp://api.apify.com").classification, "unsupported_scheme");
});

test("private and loopback hosts remain explicitly untrusted even in an Apify runtime context", () => {
  const privateContext = summary("http://10.12.4.8:3000/v2", "1");
  assert.equal(privateContext.classification, "private_origin_in_apify_runtime_unverified");
  assert.equal(privateContext.hostClass, "private_ipv4_candidate");
  assert.equal(privateContext.portClass, "nondefault_explicit");
  assert.equal(privateContext.runtimeContext, "apify_runtime_signal_present");
  assert.equal(privateContext.provenance, "value_shape_only_unverified");

  assert.equal(summary("http://127.0.0.1:4321", "1").hostClass, "loopback_ipv4_candidate");
  assert.equal(summary("http://service.local", "0").hostClass, "private_name_candidate_unverified");
  assert.equal(summary("https://[fd00::1]/v2", "1").hostClass, "private_ipv6_candidate");
  assert.equal(summary("https://192.0.2.10", "1").hostClass, "public_ipv4_unverified");
  assert.equal(summary("http://10.12.4.8", "0").classification, "private_origin_outside_or_unknown_runtime_unverified");
});

test("credentials and URL suffixes are flagged without emitting their contents", () => {
  const value = summary("https://user:secret@api.apify.com/v2?token=hidden#fragment");
  assert.equal(value.classification, "authority_or_suffix_present");
  assert.equal(value.hasUserInfo, true);
  assert.equal(value.hasQuery, true);
  assert.equal(value.hasFragment, true);
  for (const forbidden of ["user", "secret", "token=hidden", "fragment", "api.apify.com"]) {
    assert.equal(JSON.stringify(value).includes(forbidden), false);
  }
});

test("Actor entrypoint exits after classification and never hits a loopback listener", async () => {
  let hits = 0;
  const server = net.createServer(() => { hits++; });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const child = spawnSync(process.execPath, [path.join(root, "src", "main.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, APIFY_API_BASE_URL: `http://127.0.0.1:${port}/v2`, APIFY_IS_AT_HOME: "1" },
    timeout: 5000,
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  await new Promise((resolve) => server.close(resolve));

  assert.equal(child.status, 0, child.stderr);
  assert.equal(hits, 0);
  assert.equal(child.stderr, "");
  const lines = child.stdout.trim().split(/\r?\n/u);
  assert.equal(lines.length, 1);
  const result = JSON.parse(lines[0]);
  assert.equal(result.startupMarker, "h15_origin_classifier_complete");
  assert.equal(result.networkDispatch, "none");
  assert.equal(result.sdkImported, false);
  assert.equal(result.classification, "private_origin_in_apify_runtime_unverified");
  assert.equal(child.stdout.includes("127.0.0.1"), false);
  assert.equal(child.stdout.includes(String(port)), false);
});

test("Actor entrypoint has no network, SDK, dynamic-import, storage, or Worker dispatch path", async () => {
  const entry = await readFile(path.join(root, "src", "main.mjs"), "utf8");
  const classifier = await readFile(path.join(root, "src", "classify-origin.mjs"), "utf8");
  const source = `${entry}\n${classifier}`;
  assert.doesNotMatch(source, /\bfetch\s*\(|\b(?:https?|http|net|dns)\.(?:request|get|connect|lookup)\s*\(/u);
  assert.doesNotMatch(source, /node:(?:http|https|net|dns|tls|http2|worker_threads|child_process)|Actor\.init\s*\(|Actor\.getInput\s*\(|pushData\s*\(|new Worker\s*\(|WebSocket|import\s*\(|process\.binding\s*\(|\beval\s*\(/u);
});
