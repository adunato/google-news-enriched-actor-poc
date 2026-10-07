const CHARSET_PARAMETER = /;\s*charset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;\s]*))/iu;

export function domContentType(headerValue) {
  const mediaType = headerValue.toLowerCase().includes("xhtml")
    ? "application/xhtml+xml"
    : "text/html";
  const match = CHARSET_PARAMETER.exec(headerValue);
  const label = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!label) return mediaType;

  try {
    const encoding = new TextDecoder(label.trim()).encoding;
    return `${mediaType}; charset=${encoding}`;
  } catch {
    return mediaType;
  }
}
