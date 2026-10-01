export const PROXY_ENV_KEYS = Object.freeze([
  "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy",
  "NO_PROXY", "no_proxy", "GLOBAL_AGENT_HTTP_PROXY", "NODE_USE_ENV_PROXY", "APIFY_PROXY_URL",
]);

export function assertNoProxyOverride(env) {
  if (PROXY_ENV_KEYS.some((key) => typeof env?.[key] === "string" && env[key].length > 0)) {
    throw new Error("h15b_proxy_override_rejected");
  }
}

function isPrivateIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(?:0|[1-9][0-9]{0,2})$/u.test(part) || Number(part) > 255)) return false;
  const [a, b, c, d] = parts.map(Number);
  return a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}

export function resolveRuntimeOrigin({ apiBaseUrl, isAtHome, localMode = false }) {
  if (localMode) {
    const localOrigin = "http://127.0.0.1:43822";
    if (apiBaseUrl !== localOrigin) throw new Error("h15b_api_origin_rejected");
    return { origin: localOrigin, hostname: "127.0.0.1", port: 43822, localMode: true };
  }
  if (isAtHome !== "1") throw new Error("h15b_runtime_signal_rejected");
  if (typeof apiBaseUrl !== "string") throw new Error("h15b_api_origin_rejected");

  const match = /^http:\/\/([0-9]{1,3}(?:\.[0-9]{1,3}){3}):([0-9]{1,5})\/?$/u.exec(apiBaseUrl);
  if (!match) throw new Error("h15b_api_origin_rejected");
  const [, hostname, portText] = match;
  const port = Number(portText);
  let parsed;
  try { parsed = new URL(apiBaseUrl); } catch { throw new Error("h15b_api_origin_rejected"); }
  if (parsed.protocol !== "http:" || parsed.hostname !== hostname || parsed.host !== `${hostname}:${portText}` ||
      parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      !Number.isInteger(port) || port < 1 || port > 65535 || port === 80 || String(port) !== portText ||
      !isPrivateIpv4(hostname)) {
    throw new Error("h15b_api_origin_rejected");
  }
  return { origin: parsed.origin, hostname, port, localMode: false };
}
