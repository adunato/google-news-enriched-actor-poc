import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { TextDecoder } from "node:util";
import { clearTimeout, setTimeout } from "node:timers";
import { URL } from "node:url";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import ipaddr from "ipaddr.js";

export function addressIsPublic(address) {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) parsed = parsed.toIPv4Address();
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

function timeoutPromise(timeoutMs) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("dns_lookup_timeout")), timeoutMs);
    timer.unref?.();
  });
  return { promise, clear: () => clearTimeout(timer) };
}

export async function resolvePublicHttpTarget(
  value,
  { resolver = lookup, timeoutMs = 10000 } = {},
) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    return { ok: false, reason: "invalid_http_target" };
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    ["localhost", "local", "internal", "test", "invalid", "example"].some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    )
  ) {
    return { ok: false, reason: "non_public_hostname" };
  }

  let addresses;
  try {
    if (isIP(hostname)) addresses = [{ address: hostname, family: isIP(hostname) }];
    else {
      const timeout = timeoutPromise(timeoutMs);
      try {
        addresses = await Promise.race([
          resolver(hostname, { all: true, verbatim: true }),
          timeout.promise,
        ]);
      } finally {
        timeout.clear();
      }
    }
  } catch (error) {
    return {
      ok: false,
      reason: error?.message === "dns_lookup_timeout" ? "dns_lookup_timeout" : "dns_lookup_failed",
    };
  }
  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.some((entry) => !addressIsPublic(entry.address))
  ) {
    return { ok: false, reason: "non_public_dns_address" };
  }
  return {
    ok: true,
    url: url.href,
    hostname,
    addresses: addresses.map(({ address, family }) => ({
      address,
      family: family || isIP(address),
    })),
  };
}

export function createPinnedLookup(target) {
  const expectedHostname = target.hostname.toLowerCase();
  const pinnedAddresses = target.addresses.map((entry) => ({ ...entry }));
  return (hostname, options, callback) => {
    if (hostname.toLowerCase() !== expectedHostname) {
      callback(new Error("pinned_hostname_mismatch"));
      return;
    }
    if (options?.all) callback(null, pinnedAddresses);
    else callback(null, pinnedAddresses[0].address, pinnedAddresses[0].family);
  };
}

export function resolveRedirectUrl(location, currentUrl) {
  try {
    return new URL(location, currentUrl).href;
  } catch {
    return null;
  }
}

export async function requestPinnedPublicHttp(
  value,
  { headers, timeoutMs = 10000, resolver = lookup } = {},
) {
  const target = await resolvePublicHttpTarget(value, { resolver, timeoutMs });
  if (!target.ok) return target;
  const url = new URL(target.url);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    let responseStream;
    let timer;
    const request = transport.request(
      {
        hostname: target.hostname,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
        lookup: createPinnedLookup(target),
        agent: false,
        ...(url.protocol === "https:" && !isIP(target.hostname)
          ? { servername: target.hostname }
          : {}),
      },
      (response) => {
        settled = true;
        responseStream = response;
        resolve({
          ok: true,
          target,
          response,
          close: () => {
            clearTimeout(timer);
            response.destroy();
            request.destroy();
          },
        });
      },
    );
    timer = setTimeout(() => {
      const error = new Error("request_timeout");
      error.name = "TimeoutError";
      request.destroy(error);
    }, timeoutMs);
    timer.unref?.();
    request.once("close", () => {
      if (!settled) clearTimeout(timer);
    });
    request.once("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      } else {
        responseStream?.destroy(error);
      }
    });
    request.end();
  });
}

export async function boundedNodePrefix(response, maxBytes) {
  const declaredLength = Number(response.headers["content-length"] || 0);
  const encoding = String(response.headers["content-encoding"] || "identity").toLowerCase();
  const compressed = encoding !== "identity";
  let stream = response;
  if (encoding === "gzip" || encoding === "x-gzip") stream = response.pipe(createGunzip());
  else if (encoding === "deflate") stream = response.pipe(createInflate());
  else if (encoding === "br") stream = response.pipe(createBrotliDecompress());
  else if (compressed) {
    response.destroy();
    throw new Error("unsupported_content_encoding");
  }
  const lengthSuggestsTruncation = !compressed && declaredLength > maxBytes;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (truncated) => {
      if (settled) return;
      settled = true;
      const bytes = Buffer.concat(chunks, size);
      resolve({
        text: new TextDecoder().decode(bytes),
        truncated: truncated || lengthSuggestsTruncation,
      });
    };
    stream.on("data", (chunk) => {
      const remaining = maxBytes - size;
      const take = chunk.subarray(0, Math.max(0, Math.min(chunk.length, remaining)));
      if (take.length) chunks.push(take);
      size += take.length;
      if (take.length < chunk.length || size === maxBytes) {
        finish(true);
        response.destroy();
      }
    });
    stream.once("end", () => finish(false));
    stream.once("error", (error) => {
      if (!settled) reject(error);
    });
    if (stream !== response)
      response.once("error", (error) => {
        if (!settled) reject(error);
      });
  });
}
