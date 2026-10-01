const MAX_BASE_URL_LENGTH = 2048;
const DOCUMENTED_PUBLIC_HOST = "api.apify.com";

function runtimeContext(isAtHome) {
  if (isAtHome === "1") return "apify_runtime_signal_present";
  if (isAtHome === "0") return "apify_runtime_signal_absent";
  return "apify_runtime_signal_unknown";
}

function classifyIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part) || Number(part) > 255)) return null;
  const [a, b] = parts.map(Number);
  if (a === 127) return "loopback_ipv4_candidate";
  if (a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168) return "private_ipv4_candidate";
  if (a === 169 && b === 254) return "link_local_ipv4_candidate";
  if (a === 100 && b >= 64 && b <= 127) return "shared_address_ipv4_candidate";
  if (a === 0 || a >= 224) return "reserved_ipv4_candidate";
  return "public_ipv4_unverified";
}

function classifyIpv6(host) {
  const value = host.replace(/^\[|\]$/gu, "").toLowerCase();
  if (!value.includes(":")) return null;
  if (value === "::1") return "loopback_ipv6_candidate";
  if (value === "::") return "unspecified_ipv6_candidate";
  if (/^(?:fc|fd)/u.test(value)) return "private_ipv6_candidate";
  if (/^fe[89ab]/u.test(value)) return "link_local_ipv6_candidate";
  if (/^2001:db8:/u.test(value)) return "documentation_ipv6_candidate";
  return "public_ipv6_unverified";
}

function classifyHost(host) {
  const lower = host.toLowerCase().replace(/\.$/u, "");
  if (lower === DOCUMENTED_PUBLIC_HOST) return "documented_public_apify_api_host";
  const ipv4 = classifyIpv4(lower);
  if (ipv4) return ipv4;
  const ipv6 = classifyIpv6(lower);
  if (ipv6) return ipv6;
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local") ||
      lower.endsWith(".internal") || lower.endsWith(".cluster.local") || !lower.includes(".")) {
    return "private_name_candidate_unverified";
  }
  if (lower.endsWith(".apify.com")) return "other_apify_domain_unverified";
  return "public_hostname_unverified";
}

function classifyPort(url) {
  return url.port === "" ? "effective_default" : "nondefault_explicit";
}

function classifyPath(url) {
  if (url.pathname === "/") return "root";
  if (url.pathname === "/v2" || url.pathname === "/v2/") return "api_v2_prefix";
  return "other_path";
}

function result({
  present,
  classification,
  schemeClass = null,
  hostClass = null,
  portClass = null,
  pathClass = null,
  hasUserInfo = false,
  hasQuery = false,
  hasFragment = false,
  runtime,
}) {
  return Object.freeze({
    schemaVersion: "issue22-h15-origin-classifier-v1",
    startupMarker: "h15_origin_classifier_complete",
    outcome: "classified_no_dispatch",
    baseUrlPresent: present,
    classification,
    schemeClass,
    hostClass,
    portClass,
    pathClass,
    hasUserInfo,
    hasQuery,
    hasFragment,
    runtimeContext: runtime,
    provenance: "value_shape_only_unverified",
    networkDispatch: "none",
    sdkImported: false,
  });
}

export function classifyApiBaseUrl(rawValue, isAtHome) {
  const runtime = runtimeContext(isAtHome);
  if (rawValue === undefined) return result({ present: false, classification: "missing", runtime });
  if (typeof rawValue !== "string") return result({ present: true, classification: "invalid_type", runtime });
  if (rawValue.length === 0) return result({ present: true, classification: "empty", runtime });
  if (rawValue.length > MAX_BASE_URL_LENGTH) return result({ present: true, classification: "too_long", runtime });
  if (rawValue.trim() !== rawValue || /[\u0000-\u001f\u007f]/u.test(rawValue)) {
    return result({ present: true, classification: "malformed", runtime });
  }

  let url;
  try {
    url = new URL(rawValue);
  } catch {
    return result({ present: true, classification: "malformed", runtime });
  }

  const schemeClass = url.protocol === "https:" ? "https" : url.protocol === "http:" ? "http" : "unsupported";
  const hostClass = classifyHost(url.hostname);
  const portClass = classifyPort(url);
  const pathClass = classifyPath(url);
  const hasUserInfo = Boolean(url.username || url.password);
  const hasQuery = Boolean(url.search);
  const hasFragment = Boolean(url.hash);

  let classification = "public_or_other_origin_unverified";
  if (schemeClass === "unsupported") classification = "unsupported_scheme";
  else if (hasUserInfo || hasQuery || hasFragment) classification = "authority_or_suffix_present";
  else if (hostClass.startsWith("private_") || hostClass.startsWith("loopback_") || hostClass.startsWith("link_local_") ||
      hostClass.startsWith("shared_address_") || hostClass.startsWith("reserved_") || hostClass.startsWith("unspecified_")) {
    classification = runtime === "apify_runtime_signal_present"
      ? "private_origin_in_apify_runtime_unverified"
      : "private_origin_outside_or_unknown_runtime_unverified";
  } else if (hostClass === "documented_public_apify_api_host" && schemeClass === "https" &&
      (pathClass === "root" || pathClass === "api_v2_prefix")) {
    classification = "documented_public_apify_api_shape";
  } else if (hostClass === "other_apify_domain_unverified") {
    classification = "other_apify_domain_unverified";
  }

  return result({
    present: true,
    classification,
    schemeClass,
    hostClass,
    portClass,
    pathClass,
    hasUserInfo,
    hasQuery,
    hasFragment,
    runtime,
  });
}
