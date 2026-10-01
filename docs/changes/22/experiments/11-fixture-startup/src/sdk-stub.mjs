import http from "node:http";
import { normalizedPath } from "./tuples.mjs";

const allowed = new Map();
const seen = [];
let server;
let aggregateWriteVerified = false;

export function createSdkStub({ expectedTuples = [], input, discover = false }) {
  allowed.clear();
  for (const tuple of expectedTuples) allowed.set(JSON.stringify(tuple), tuple);
  seen.length = 0;
  aggregateWriteVerified = false;
  server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    const tuple = { origin: `http://${request.headers.host}`, method: request.method.toUpperCase(), path: normalizedPath(request.url), phase: process.env.H12_PHASE ?? "unclassified" };
    seen.push(tuple);
    const allowedTuple = allowed.get(JSON.stringify(tuple));
    if (!allowedTuple && !discover) {
      response.writeHead(403, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "h12_tuple_denied" }));
      return;
    }
    if (request.url.startsWith("/v2/key-value-stores/") && request.url.includes("/records/INPUT")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(input));
      return;
    }
    if (request.url.startsWith("/v2/actor-runs/")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: { id: "h12-local-run", options: { maxTotalChargeUsd: 1 }, pricingInfo: { pricingModel: "FREE" }, chargedEventCounts: {} } }));
      return;
    }
    if (request.method === "POST" && request.url.startsWith("/v2/datasets/") && request.url.endsWith("/items")) {
      let value;
      try { value = JSON.parse(body); } catch { value = null; }
      const items = Array.isArray(value) ? value : value && Array.isArray(value.items) ? value.items : [value];
      const expectedKeys = ["schemaVersion", "fixtureCount", "workerStatus", "readabilityStatus", "readabilityWords", "outputChars", "guardMarker"].sort().join("|");
      aggregateWriteVerified = items.length === 1 && items[0] && Object.keys(items[0]).sort().join("|") === expectedKeys &&
        items[0].schemaVersion === "issue22-h12-fixture-v1" && items[0].fixtureCount === 1 && items[0].workerStatus === "complete" &&
        items[0].readabilityStatus === "success" && Number.isSafeInteger(items[0].readabilityWords) && items[0].readabilityWords > 0 &&
        Number.isSafeInteger(items[0].outputChars) && items[0].outputChars > 0 && items[0].guardMarker === true;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: { itemCount: aggregateWriteVerified ? 1 : 0 } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: { id: "issue22-h12-local-store", name: "issue22-h12-local-store" }, items: [], itemCount: 0 }));
  });
  return {
    async listen(port = 43821) {
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
      return `http://127.0.0.1:${server.address().port}`;
    },
    tuples: () => seen.map((tuple) => ({ ...tuple })),
    aggregateWriteVerified: () => aggregateWriteVerified,
    close: () => new Promise((resolve, reject) => {
      if (!server.listening) { resolve(); return; }
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
