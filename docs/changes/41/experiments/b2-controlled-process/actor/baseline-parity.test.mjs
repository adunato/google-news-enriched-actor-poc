import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { processRow } from "./baseline.mjs";
import { mapWithConcurrency, runRowInChild } from "./parent.mjs";

const ARTICLE = `<!doctype html><html><head><title>Local fixture</title><script type="application/ld+json">{"@type":"NewsArticle","articleBody":"A coherent locally served article has enough words to confirm extraction remains available in the process boundary."}</script></head><body><article><h1>Local fixture</h1><p>${"A readable fixture paragraph with enough ordinary words to exercise the article parser. ".repeat(30)}</p></article></body></html>`;
const paths = [];

function scenarioHandler(request, response) {
  paths.push({
    method: request.method,
    path: request.url,
    accept: request.headers.accept,
    userAgent: request.headers["user-agent"],
  });
  if (request.url === "/redirect") {
    response.writeHead(302, { location: "/jsonld", "content-length": "0" }).end();
  } else if (request.url === "/jsonld" || request.url === "/chunked") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    if (request.url === "/chunked") {
      const buffer = Buffer.from(ARTICLE);
      response.write(buffer.subarray(0, 100));
      setTimeout(() => response.end(buffer.subarray(100)), 5);
    } else response.end(ARTICLE);
  } else if (request.url === "/denied") {
    response.writeHead(403, { "content-type": "text/html", "content-length": "16" }).end("forbidden body!");
  } else if (request.url === "/non-html") {
    response.writeHead(200, { "content-type": "application/json", "content-length": "2" }).end("{}");
  } else if (request.url === "/oversize") {
    response.writeHead(200, { "content-type": "text/html", "content-length": String(2 * 1024 * 1024 + 1) }).end();
  } else if (request.url === "/stall") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "transfer-encoding": "chunked" });
    response.write("<!doctype html><p>waiting");
  } else if (request.url === "/charset") {
    response.writeHead(200, { "content-type": "text/html; charset=windows-1252" });
    response.end(Buffer.from(`<!doctype html><html><body><article><h1>Caf\xe9 news</h1><p>${"Caf\xe9 readers receive a useful local report with an ordinary article paragraph. ".repeat(25)}</p></article></body></html>`, "latin1"));
  } else if (request.url === "/abrupt") {
    response.socket.destroy();
  } else {
    response.writeHead(404).end();
  }
}

async function withServer(callback) {
  const server = createServer(scenarioHandler).listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function row(base, path) {
  const publisherUrl = `${base}${path}`;
  return {
    rowId: `local-${path.slice(1).replaceAll("-", "")}`,
    query: "local parity fixture",
    country: "GB",
    language: "en",
    title: "Local parity fixture",
    sourceName: "Local test server",
    sourceHost: "127.0.0.1",
    googleNewsUrl: "https://news.google.com/articles/local-fixture",
    googleNewsUrlHash: "fixture-google-hash",
    publisherUrl,
    publisherHost: "127.0.0.1",
    publisherUrlHash: "fixture-publisher-hash",
    urlResolved: true,
    urlResolutionStatus: "resolved",
  };
}

function comparable(outcome) {
  return {
    publisherFetchStatus: outcome.publisherFetchStatus,
    publisherHttpStatus: outcome.publisherHttpStatus,
    publisherRequestCount: outcome.publisherRequestCount,
    publisherRedirectCount: outcome.publisherRedirectCount,
    publisherBodyBytes: outcome.publisherBodyBytes,
    publisherBodySha256: outcome.publisherBodySha256,
    publisherRedirectStages: outcome.publisherRedirectStages,
    fullTextStatus: outcome.fullTextStatus,
    extractionMethod: outcome.extractionMethod,
    wordCount: outcome.wordCount,
    textCharacterCount: outcome.textCharacterCount,
    textSha256: outcome.textSha256,
    errorClass: outcome.errorClass,
    errorCode: outcome.errorCode,
  };
}

test("direct R2 baseline and child boundary preserve deterministic HTTP and extraction outcomes", async (t) => {
  await withServer(async (base) => {
    for (const path of ["/redirect", "/denied", "/non-html", "/chunked", "/oversize", "/charset", "/abrupt", "/stall"]) {
      await t.test(path, async () => {
        const input = row(base, path);
        paths.length = 0;
        const originalLog = console.log;
        console.log = () => {};
        let direct;
        try { direct = await processRow(input, "smoke"); }
        finally { console.log = originalLog; }
        const directTrace = structuredClone(paths);
        paths.length = 0;
        const child = await runRowInChild(input, "smoke");
        const childTrace = structuredClone(paths);
        assert.equal(child.status, "success", JSON.stringify(child));
        assert.equal(child.reaped, true);
        assert.deepEqual(comparable(child.result), comparable(direct));
        assert.equal(child.result.rowId, input.rowId);
        assert.equal(child.result.googleNewsUrl, input.googleNewsUrl);
        assert.equal(child.result.publisherUrl, input.publisherUrl);
        assert.equal(child.result.urlResolutionStatus, input.urlResolutionStatus);
        assert.deepEqual(childTrace, directTrace);
        assert.ok(child.timing.t0ToSpawnMs >= 0);
        assert.ok(child.timing.t0ToChildReadyMs >= child.timing.t0ToSpawnMs);
        assert.ok(child.timing.t0ToHttpRequestMs >= child.timing.t0ToChildReadyMs);
        assert.ok(childTrace.every((request) => request.method === "GET" &&
          request.accept === "text/html,application/xhtml+xml" &&
          request.userAgent === "Mozilla/5.0 issue-41-b2-vanilla/1.0"));
        process.stdout.write(`CONTROL_CASE ${JSON.stringify({ path, direct: comparable(direct), child: comparable(child.result), requestTrace: childTrace, timing: child.timing })}\n`);
      });
    }
  });
});

test("startup hang is killed and reaped at the 24-second parent deadline", async () => {
  const result = await runRowInChild(row("http://127.0.0.1", "/unused"), "smoke", { startupHangForTest: true });
  assert.equal(result.status, "child_timeout");
  assert.equal(result.reaped, true);
  assert.ok(result.timing.parentElapsedMs >= 24_000);
  assert.ok(result.timing.parentElapsedMs <= 26_000);
  assert.ok(result.timing.killToReapMs <= 2_000);
  process.stdout.write(`CONTROL_STARTUP_HANG ${JSON.stringify({ pid: result.pid, reaped: result.reaped, timing: result.timing })}\n`);
});

test("the parent scheduler never exceeds two live row children", async () => {
  await withServer(async (base) => {
    paths.length = 0;
    let active = 0;
    let maximumActive = 0;
    const rows = Array.from({ length: 4 }, (_, index) => ({
      ...row(base, "/jsonld"),
      rowId: `local-concurrency-${index + 1}`,
    }));
    const outcomes = await mapWithConcurrency(rows, 2, async (input) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      try { return await runRowInChild(input, "smoke"); }
      finally { active -= 1; }
    });
    assert.equal(maximumActive, 2);
    assert.ok(outcomes.every((outcome) => outcome.status === "success" && outcome.reaped));
    assert.equal(paths.length, 4);
    process.stdout.write(`CONTROL_CONCURRENCY ${JSON.stringify({ maximumActive, rows: outcomes.length, allReaped: outcomes.every((outcome) => outcome.reaped) })}\n`);
  });
});
