import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertNoProxyOverride, PROXY_ENV_KEYS, resolveRuntimeOrigin } from "../src/runtime-origin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

test("runtime gate accepts only canonical private IPv4 origins with an explicit nondefault port", () => {
  for (const value of [
    "http://10.12.34.56:8123",
    "http://10.12.34.56:8123/",
    "http://172.16.0.9:3001/",
    "http://172.31.255.254:3001/",
    "http://192.168.1.20:9000/",
  ]) {
    const resolved = resolveRuntimeOrigin({ apiBaseUrl: value, isAtHome: "1" });
    assert.equal(resolved.origin.startsWith("http://"), true);
    assert.equal(resolved.localMode, false);
    assert.equal(Number.isInteger(resolved.port) && resolved.port !== 80, true);
  }
});

test("runtime origin rejects absent signal and untrusted address classes", () => {
  assert.throws(() => resolveRuntimeOrigin({ apiBaseUrl: "http://10.1.2.3:8123/", isAtHome: "0" }), /runtime_signal_rejected/u);
  for (const value of [
    "http://api.apify.com:8123/",
    "http://8.8.8.8:8123/",
    "http://127.0.0.1:8123/",
    "http://169.254.1.2:8123/",
    "http://224.1.2.3:8123/",
    "http://0.0.0.0:8123/",
    "http://192.0.2.1:8123/",
    "http://100.64.0.1:8123/",
  ]) {
    assert.throws(() => resolveRuntimeOrigin({ apiBaseUrl: value, isAtHome: "1" }), /api_origin_rejected/u);
  }
});

test("runtime origin rejects protocol, port, path, credentials and suffix variations", () => {
  for (const value of [
    "https://10.1.2.3:8123/",
    "http://10.1.2.3/",
    "http://10.1.2.3:80/",
    "http://10.1.2.3:0/",
    "http://10.1.2.3:65536/",
    "http://10.1.2.3:08123/",
    "http://010.1.2.3:8123/",
    "http://10.1.2.3:8123/v2",
    "http://user:pass@10.1.2.3:8123/",
    "http://10.1.2.3:8123/?token=synthetic",
    "http://10.1.2.3:8123/#synthetic",
  ]) {
    assert.throws(() => resolveRuntimeOrigin({ apiBaseUrl: value, isAtHome: "1" }), /api_origin_rejected/u);
  }
});

test("runtime origin rejects every recognized proxy override without reflecting values", () => {
  for (const key of PROXY_ENV_KEYS) {
    assert.throws(() => assertNoProxyOverride({ [key]: "synthetic-proxy-secret" }), (error) => {
      assert.equal(error.message, "h15b_proxy_override_rejected");
      assert.equal(error.message.includes("synthetic-proxy-secret"), false);
      return true;
    });
  }
  assert.doesNotThrow(() => assertNoProxyOverride({ HTTP_PROXY: "", HTTPS_PROXY: undefined }));
});

test("local stub origin remains fixed and independent from the hosted origin gate", () => {
  assert.deepEqual(resolveRuntimeOrigin({ apiBaseUrl: "http://127.0.0.1:43822", isAtHome: "1", localMode: true }), {
    origin: "http://127.0.0.1:43822", hostname: "127.0.0.1", port: 43822, localMode: true,
  });
  assert.throws(() => resolveRuntimeOrigin({ apiBaseUrl: "http://localhost:43822", isAtHome: "1", localMode: true }), /api_origin_rejected/u);
});

test("pre-import preload rejects unsafe origin and proxy overrides with fixed codes only", () => {
  const preload = pathToFileURL(path.resolve(here, "../src/guard-preload.mjs")).href;
  const cleanEnv = { ...process.env, H15B_LOCAL_PREFLIGHT: "0", APIFY_IS_AT_HOME: "1" };
  for (const key of PROXY_ENV_KEYS) delete cleanEnv[key];
  const originValue = "http://203.0.113.99:8123/";
  const originCheck = spawnSync(process.execPath, ["--import", preload, "-e", "process.stdout.write('unexpected-main')"], {
    env: { ...cleanEnv, APIFY_API_BASE_URL: originValue }, encoding: "utf8",
  });
  assert.notEqual(originCheck.status, 0);
  assert.equal(originCheck.stdout, "");
  assert.match(originCheck.stderr, /h15b_api_origin_rejected/u);
  assert.equal(originCheck.stderr.includes(originValue), false);

  const proxyValue = "synthetic-proxy-secret";
  const proxyCheck = spawnSync(process.execPath, ["--import", preload, "-e", "process.stdout.write('unexpected-main')"], {
    env: { ...cleanEnv, APIFY_API_BASE_URL: "http://10.1.2.3:8123/", HTTP_PROXY: proxyValue }, encoding: "utf8",
  });
  assert.notEqual(proxyCheck.status, 0);
  assert.equal(proxyCheck.stdout, "");
  assert.match(proxyCheck.stderr, /h15b_proxy_override_rejected/u);
  assert.equal(proxyCheck.stderr.includes(proxyValue), false);
});
