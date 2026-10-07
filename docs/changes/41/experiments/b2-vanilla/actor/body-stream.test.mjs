import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { MAX_BODY_BYTES, readBoundedBody } from "./body-stream.mjs";

const noop = () => {};

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

async function closeServer(server) {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
}

test("finite body returns exact bytes", async () => {
  const expected = Buffer.from("<html>ok</html>");
  const body = await readBoundedBody(
    new Response(expected, { headers: { "content-type": "text/html" } }),
    noop,
  );
  assert.deepEqual(body, expected);
});

test("declared body limit is preserved", async () => {
  const response = new Response("small", {
    headers: { "content-length": String(MAX_BODY_BYTES + 1) },
  });
  await assert.rejects(readBoundedBody(response, noop), (error) => error?.code === "BODY_LIMIT");
});

test("stream body limit is preserved", async () => {
  const chunk = new Uint8Array(MAX_BODY_BYTES + 1);
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(chunk);
        controller.close();
      },
    }),
  );
  await assert.rejects(readBoundedBody(response, noop), (error) => error?.code === "BODY_LIMIT");
});

test("unfinished HTTP body reproduction gate", async (t) => {
  let socket;
  const { server, url } = await listen((request, response) => {
    socket = request.socket;
    response.writeHead(200, { "content-type": "text/html" });
    response.write("<html><body>prefix");
  });
  t.after(() => closeServer(server));

  const signal = AbortSignal.timeout(250);
  const response = await fetch(url, { signal });
  const startedAt = Date.now();
  let settled = false;
  const helper = readBoundedBody(response, noop)
    .then(
      (value) => ({ kind: "fulfilled", value }),
      (error) => ({ kind: "rejected", error }),
    )
    .finally(() => {
      settled = true;
    });

  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const observedPending = !settled;
  socket?.destroy();

  const outcome = await Promise.race([
    helper,
    new Promise((resolve) => setTimeout(() => resolve({ kind: "cleanup_timeout" }), 1_000)),
  ]);

  console.log(
    `ISSUE41_B2_R3A ${JSON.stringify({
      nodeVersion: process.version,
      signalAborted: signal.aborted,
      observedPendingAtWatchdog: observedPending,
      elapsedMs: Date.now() - startedAt,
      outcome: outcome.kind,
      errorName: outcome.error?.name ?? null,
    })}`,
  );

  assert.equal(signal.aborted, true);
  assert.equal(
    observedPending,
    true,
    "R3a reproduction gate failed: the unchanged helper settled after abort before the watchdog",
  );
});
