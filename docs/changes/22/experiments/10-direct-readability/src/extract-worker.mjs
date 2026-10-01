import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import { parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { Buffer } from "node:buffer";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

let networkAttempts = 0;
function blocked() { networkAttempts++; throw new Error("network_disabled"); }
globalThis.fetch = blocked;
http.request = blocked; http.get = blocked; https.request = blocked; https.get = blocked;
net.connect = blocked; net.createConnection = blocked; net.Socket.prototype.connect = blocked;
dns.lookup = blocked; dns.lookupService = blocked;
for (const key of ["resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"]) {
  dns[key] = blocked; dns.promises[key] = blocked;
}

function post(message) { parentPort.postMessage(message); }
function words(text) { const normalized = text.replace(/\s+/gu, " ").trim(); return normalized ? normalized.split(" ").length : 0; }
function articleBody(value, out = [], depth = 0) {
  if (depth > 12 || value == null) return out;
  if (Array.isArray(value)) { for (const child of value) articleBody(child, out, depth + 1); return out; }
  if (typeof value !== "object") return out;
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((x) => ["Article", "NewsArticle", "ReportageNewsArticle", "AnalysisNewsArticle"].includes(x)) && typeof value.articleBody === "string") out.push(value.articleBody);
  for (const [key, child] of Object.entries(value)) if (key !== "articleBody") articleBody(child, out, depth + 1);
  return out;
}

const h12GuardMarker = process.env.H12_REQUIRE_GUARD === "1"
  ? globalThis.__ISSUE22_H12_GUARD__ === "issue22-h12-deny-external-v1"
  : undefined;
post({ kind: "phase", phase: "worker_ready", ...(process.env.H12_REQUIRE_GUARD === "1" ? { guardMarker: h12GuardMarker } : {}) });
const started = performance.now();
post({ kind: "phase", phase: "parse_started" });
try {
  const { html, url } = workerData;
  const document = parseHTML(html).document;
  const elements = document.querySelectorAll("*").length;
  if (elements > 10000) {
    post({ kind: "phase", phase: "parse_complete", durationMs: Number((performance.now() - started).toFixed(3)) });
    post({ kind: "result", status: "dom_limit", domElements: 10000, structuredStatus: "not_scored", structuredWords: 0, readabilityStatus: "not_scored", readabilityWords: 0, outputChars: 0 });
    parentPort.close();
  } else {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    let scriptBytes = 0, structured = [];
    for (const script of scripts) {
      const source = script.textContent ?? "";
      scriptBytes += Buffer.byteLength(source, "utf8");
      if (scriptBytes > 64 * 1024) { structured = null; break; }
      try { structured.push(...articleBody(JSON.parse(source))); } catch { /* malformed publisher metadata is simply unscored */ }
    }
    const structuredText = structured?.join(" ") ?? "";
    const structuredWords = words(structuredText);
    const structuredStatus = structured === null ? "cap" : structuredWords > 0 ? "present" : "empty";
    const result = new Readability(document, { charThreshold: 0 }).parse();
    const cleaned = typeof result?.textContent === "string" ? result.textContent : "";
    const outputChars = cleaned.length;
    post({ kind: "phase", phase: "parse_complete", durationMs: Number((performance.now() - started).toFixed(3)) });
    if (outputChars > 100000) {
      post({ kind: "result", status: "output_limit", domElements: elements, structuredStatus, structuredWords, readabilityStatus: "cap", readabilityWords: 0, outputChars: 100000 });
    } else {
      const readabilityWords = words(cleaned);
      post({ kind: "result", status: "complete", domElements: elements, structuredStatus, structuredWords, readabilityStatus: readabilityWords > 0 ? "success" : "empty", readabilityWords, outputChars });
    }
    parentPort.close();
  }
} catch {
  post({ kind: "phase", phase: "parse_complete", durationMs: Number((performance.now() - started).toFixed(3)) });
  post({ kind: "result", status: networkAttempts ? "network_attempt" : "worker_error", domElements: 0, structuredStatus: "error", structuredWords: 0, readabilityStatus: "error", readabilityWords: 0, outputChars: 0 });
  parentPort.close();
}
