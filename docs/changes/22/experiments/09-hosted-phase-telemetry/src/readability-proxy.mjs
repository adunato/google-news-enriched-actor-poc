let parseHTML = null;

export function configureHtmlParser(parser) {
  if (typeof parser !== "function") throw new Error("html_parser_invalid");
  parseHTML = parser;
}

const MAX_CONTENT_CHARS = 1_048_576;
const tokenPattern = /[A-Za-z]+(?:['’][A-Za-z]+)*/gu;

function tokenize(value) {
  return value.toLowerCase().match(tokenPattern) ?? [];
}

function segmentsFromMarkup(markup) {
  if (!parseHTML) throw new Error("html_parser_unconfigured");
  const { document } = parseHTML(`<html><body>${markup}</body></html>`);
  const root = document.body;
  for (const node of root.querySelectorAll("script,style,noscript")) node.remove();
  const segments = [];
  let current = "";
  const flush = () => {
    const normalized = current.replace(/\s+/gu, " ").trim();
    if (normalized) segments.push(normalized);
    current = "";
  };
  const walk = (node) => {
    if (node.nodeType === 8) return;
    if (node.nodeType === 3) {
      current += node.data ?? node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : "";
    if (
      node.nodeType === 1 &&
      (node.hasAttribute("hidden") ||
        node.getAttribute("aria-hidden")?.toLowerCase() === "true" ||
        /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(node.getAttribute("style") ?? ""))
    )
      return;
    const block = /^(p|h[1-6]|li)$/.test(tag);
    if (tag === "br" || block) flush();
    for (const child of node.childNodes ?? []) walk(child);
    if (tag === "br" || block) flush();
  };
  walk(root);
  flush();
  return segments;
}

export function classifyExtractedContent(content) {
  if (!content) return { status: "empty", wordCount: 0, segmentCount: 0, fivegramUniqueness: null };
  if (content.length > MAX_CONTENT_CHARS)
    return { status: "oversize", wordCount: 0, segmentCount: 0, fivegramUniqueness: null };
  try {
    const segments = segmentsFromMarkup(content);
    const words = segments.flatMap(tokenize);
    const wordCount = words.length;
    if (wordCount < 100)
      return { status: "too_short", wordCount, segmentCount: segments.length, fivegramUniqueness: null };
    const substantiveSegments = segments.filter((segment) => tokenize(segment).length >= 20);
    if (substantiveSegments.length < 2)
      return { status: "quality_rejected", wordCount, segmentCount: segments.length, fivegramUniqueness: null };
    const grams = [];
    for (const segment of substantiveSegments) {
      const segmentWords = tokenize(segment);
      for (let i = 0; i <= segmentWords.length - 5; i++)
        grams.push(segmentWords.slice(i, i + 5).join(" "));
    }
    const fivegramUniqueness = grams.length ? new Set(grams).size / grams.length : 0;
    return {
      status: fivegramUniqueness >= 0.8 ? "accepted_proxy" : "quality_rejected",
      wordCount,
      segmentCount: substantiveSegments.length,
      fivegramUniqueness: Number(fivegramUniqueness.toFixed(3)),
    };
  } catch {
    return { status: "error", wordCount: 0, segmentCount: 0, fivegramUniqueness: null };
  }
}
