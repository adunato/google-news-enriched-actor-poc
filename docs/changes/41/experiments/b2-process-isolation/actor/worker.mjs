/* global AbortSignal, process */
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { cancelResponseBody, readBoundedBody } from "./body-stream.mjs";
import { domContentType } from "./dom-content-type.mjs";

const MAX_REDIRECTS = 5;
const HTTP_TIMEOUT_MS = 10_000;

function safeError(error) {
  const name = error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,39}$/u.test(error.name)
    ? error.name
    : "UnknownError";
  const code = error && typeof error.code === "string" && /^[A-Za-z0-9_-]{1,40}$/u.test(error.code)
    ? error.code
    : null;
  return { errorClass: name, errorCode: code };
}

async function fetchPublisher(url) {
  const signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);
  let currentUrl = url;
  let requestCount = 0;
  let redirectCount = 0;
  const startedAt = Date.now();
  for (let redirectIndex = 0; redirectIndex <= MAX_REDIRECTS; redirectIndex += 1) {
    requestCount += 1;
    const current = new URL(currentUrl);
    if (!["http:", "https:"].includes(current.protocol)) {
      return { fetchStatus: "unsupported_scheme", requestCount, redirectCount };
    }
    const response = await fetch(currentUrl, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 issue-41-b2-process-isolation/1.0",
      },
      redirect: "manual",
      signal,
    });
    const location = response.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      await cancelResponseBody(response);
      if (redirectIndex === MAX_REDIRECTS) {
        return { fetchStatus: "redirect_limit", httpStatus: response.status, requestCount, redirectCount };
      }
      const nextUrl = new URL(location, currentUrl);
      if (!["http:", "https:"].includes(nextUrl.protocol)) {
        return { fetchStatus: "unsupported_redirect_scheme", httpStatus: response.status, requestCount, redirectCount };
      }
      currentUrl = nextUrl.href;
      redirectCount += 1;
      continue;
    }
    const contentType = response.headers.get("content-type") || "";
    const finalUrl = currentUrl;
    if (!response.ok) {
      await cancelResponseBody(response);
      return {
        fetchStatus: [401, 403, 429].includes(response.status) ? "http_denied" : "http_error",
        httpStatus: response.status,
        contentType,
        finalUrl,
        requestCount,
        redirectCount,
        fetchElapsedMs: Date.now() - startedAt,
      };
    }
    if (!/\btext\/html\b|\bapplication\/xhtml\+xml\b/iu.test(contentType)) {
      await cancelResponseBody(response);
      return { fetchStatus: "non_html", httpStatus: response.status, contentType, finalUrl, requestCount, redirectCount };
    }
    try {
      const body = await readBoundedBody(response, () => {});
      return {
        fetchStatus: "eligible_html",
        httpStatus: response.status,
        contentType,
        finalUrl,
        requestCount,
        redirectCount,
        fetchElapsedMs: Date.now() - startedAt,
        body: body.toString("utf8"),
      };
    } catch (error) {
      const safe = safeError(error);
      return {
        fetchStatus: error?.code === "BODY_LIMIT" ? "body_limit" : "request_error",
        ...safe,
        httpStatus: response.status,
        contentType,
        finalUrl,
        requestCount,
        redirectCount,
        fetchElapsedMs: Date.now() - startedAt,
      };
    }
  }
  return { fetchStatus: "redirect_limit", requestCount, redirectCount };
}

function countWords(text) {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length;
}

function extractArticle(body, finalUrl, contentType) {
  const dom = new JSDOM(body, { url: finalUrl, contentType: domContentType(contentType) });
  try {
    const article = new Readability(dom.window.document, { disableJSONLD: true }).parse();
    const articleText = String(article?.textContent || "").replace(/\s+/gu, " ").trim();
    const wordCount = countWords(articleText);
    if (!articleText || wordCount === 0) {
      return { fullTextStatus: "no_readable_text_candidate", wordCount: 0, articleText: "" };
    }
    return { fullTextStatus: "success", wordCount, articleText };
  } finally {
    dom.window.close();
  }
}

async function execute(job) {
  if (job.control === "hang") {
    setInterval(() => {}, 1_000);
    await new Promise(() => {});
  }
  if (job.control === "error") throw Object.assign(new Error("Controlled child error"), { code: "I1_CONTROLLED_ERROR" });
  if (job.control !== undefined && job.control !== "success") {
    throw Object.assign(new Error("Unsupported experiment control"), { code: "INVALID_CONTROL" });
  }
  const fetched = await fetchPublisher(job.publisherUrl);
  if (fetched.fetchStatus !== "eligible_html") {
    return { ...fetched, fullTextStatus: "not_attempted_fetch_ineligible", wordCount: 0, articleText: "" };
  }
  const extracted = extractArticle(fetched.body, fetched.finalUrl, fetched.contentType);
  delete fetched.body;
  return { ...fetched, ...extracted };
}

if (!process.send) {
  throw new Error("Worker requires parent IPC");
}

process.once("message", async (message) => {
  try {
    const result = await execute(message.job);
    process.send({ type: "result", rowId: message.job.rowId, result }, () => process.exit(0));
  } catch (error) {
    process.send({ type: "error", rowId: message.job.rowId, ...safeError(error) }, () => process.exit(1));
  }
});
