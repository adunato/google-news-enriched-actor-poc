export const TARGET_SIZES = [8, 32, 96, 192, 256].map((kib) => kib * 1024);
export const SHAPES = ["semantic_article", "generic_nested_div"];

export function caseMatrix() {
  return SHAPES.flatMap((shape) => TARGET_SIZES.map((targetBytes) => ({
    caseId: `${shape}-${targetBytes / 1024}kib`,
    shape,
    targetBytes,
  })));
}

function authoredSegment(index) {
  return ` <h${index % 6 + 1}>section${index}</h${index % 6 + 1}><p>` +
    Array.from({ length: 24 }, (_, word) => `authoredword${index}_${word}`).join(" ") +
    "</p>";
}

export function createFixture(shape, targetBytes) {
  const prefix = shape === "semantic_article"
    ? "<!doctype html><html><head><title>Authored fixture</title></head><body><article><h1>Authored test</h1>"
    : "<!doctype html><html><head><title>Authored fixture</title></head><body><div class='outer'><div class='inner'><h1>Authored test</h1>";
  const suffix = shape === "semantic_article"
    ? "</article></body></html>"
    : "</div></div></body></html>";
  const open = shape === "semantic_article" ? "" : "<div><span>";
  const close = shape === "semantic_article" ? "" : "</span></div>";
  if (!SHAPES.includes(shape) || !Number.isSafeInteger(targetBytes) || targetBytes < 1024 || targetBytes > 256 * 1024)
    throw new Error("fixture_bounds_invalid");
  if (prefix.length + suffix.length >= targetBytes) throw new Error("fixture_target_too_small");

  let html = prefix;
  let segment = 0;
  while (html.length + suffix.length < targetBytes) {
    const markup = `${open}${authoredSegment(segment++)}${close}`;
    const remaining = targetBytes - html.length - suffix.length;
    if (markup.length <= remaining) {
      html += markup;
      continue;
    }
    html += " ".repeat(remaining);
  }
  html += suffix;
  if (Buffer.byteLength(html, "utf8") !== targetBytes) throw new Error("fixture_size_mismatch");
  return html;
}
