import http from "node:http";
import { normalizedPath } from "./tuples.mjs";

const runId = "h15blocalrun000000000001";
const storeId = "h15blocalstore000000000001";
const datasetId = "h15blocaldataset0000000001";
let input = process.env.H15B_STUB_INPUT_MODE === "invalid"
  ? { mode: "live", fixtureId: "readability-positive-v1", extra: "rejected" }
  : { mode: "fixture-only", fixtureId: "readability-positive-v1" };
let redirectNextActorRun = false;
const seen = [];
let items = [];
const run = {
  id: runId,
  status: "RUNNING",
  defaultKeyValueStoreId: storeId,
  defaultDatasetId: datasetId,
  options: { memoryMbytes: 256, timeoutSecs: 180, maxTotalChargeUsd: 0.1, restartOnError: false, maxRetries: 0 },
};
const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  seen.push({ origin: `http://${request.headers.host}`, method: request.method.toUpperCase(), path: normalizedPath(request.url) });
  response.setHeader("content-type", "application/json; charset=utf-8");
  if (request.url.startsWith(`/v2/actor-runs/${runId}`)) {
    if (redirectNextActorRun) {
      redirectNextActorRun = false;
      response.writeHead(302, { location: "/v2/not-allowlisted" });
      response.end();
      return;
    }
    response.end(JSON.stringify({ data: run })); return;
  }
  if (request.url === `/v2/key-value-stores/${storeId}`) { response.end(JSON.stringify({ data: { id: storeId, name: storeId } })); return; }
  if (request.url.startsWith(`/v2/key-value-stores/${storeId}/records/INPUT`)) { response.end(JSON.stringify(input)); return; }
  if (request.url === `/v2/datasets/${datasetId}`) { response.end(JSON.stringify({ data: { id: datasetId, name: datasetId, itemCount: items.length } })); return; }
  if (request.method === "POST" && request.url.startsWith(`/v2/datasets/${datasetId}/items`)) {
    try {
      const parsed = JSON.parse(body);
      items.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      response.writeHead(201);
      response.end(JSON.stringify({ data: { itemCount: items.length } }));
    } catch {
      response.writeHead(400);
      response.end(JSON.stringify({ error: "invalid_payload" }));
    }
    return;
  }
  if (request.method === "GET" && request.url.startsWith(`/v2/datasets/${datasetId}/items`)) { response.end(JSON.stringify(items.slice(0, 1))); return; }
  response.writeHead(404);
  response.end(JSON.stringify({ error: "route_not_found" }));
});

await new Promise((resolve, reject) => { server.once("error", reject); server.listen(43822, "127.0.0.1", resolve); });
process.stdout.write(`${JSON.stringify({ ready: true, address: server.address().address, port: server.address().port })}\n`);
process.on("message", (message) => {
  if (message?.type === "report") process.stdout.write(`${JSON.stringify({ tuples: seen, itemCount: items.length })}\n`);
  if (message?.type === "input") {
    input = message.mode === "invalid" ? { mode: "live", fixtureId: "readability-positive-v1", extra: "rejected" } : { mode: "fixture-only", fixtureId: "readability-positive-v1" };
    process.send?.({ type: "input-set", requestId: message.requestId });
  }
  if (message?.type === "redirect-next-run") {
    redirectNextActorRun = true;
    process.send?.({ type: "redirect-set", requestId: message.requestId });
  }
  if (message?.type === "close") server.close(() => process.exit(0));
});
