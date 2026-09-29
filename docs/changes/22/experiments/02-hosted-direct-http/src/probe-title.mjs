function decodeEntityOnce(value) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|ndash|mdash);/gi,
    (match, name) => {
      const entity = name.toLowerCase();
      if (entity.startsWith("#x") || entity.startsWith("#")) {
        const point = entity.startsWith("#x")
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
        if (
          !Number.isInteger(point) ||
          point < 0 ||
          point > 0x10ffff ||
          (point >= 0xd800 && point <= 0xdfff)
        )
          return match;
        try {
          return String.fromCodePoint(point);
        } catch {
          return match;
        }
      }
      return (
        {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: "\u0022",
          apos: "\u0027",
          nbsp: " ",
          rsquo: "\u2019",
          lsquo: "\u2018",
          rdquo: "\u201d",
          ldquo: "\u201c",
          ndash: "\u2013",
          mdash: "\u2014",
        }[entity] ?? match
      );
    },
  );
}

export function decodeEntities(value) {
  let decoded = String(value ?? "");
  for (let i = 0; i < 3; i++) {
    const next = decodeEntityOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function cleanTitle(value) {
  return decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value, sourceName) {
  let normalized = decodeEntities(value)
    .normalize("NFKC")
    .replace(/[\u00ad\p{Cf}]/gu, "")
    .toLocaleLowerCase("en-US");
  if (sourceName) {
    const source = decodeEntities(sourceName)
      .normalize("NFKC")
      .replace(/[\u00ad\p{Cf}]/gu, "")
      .toLocaleLowerCase("en-US");
    for (const separator of [" - ", " \u2013 ", " \u2014 ", " | ", ": "]) {
      const suffix = `${separator}${source}`;
      if (normalized.endsWith(suffix)) {
        normalized = normalized.slice(0, -suffix.length);
        break;
      }
    }
  }
  return normalized
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyIdentity(expectedTitle, sourceName, titleSignals, responseCapped) {
  const expected = normalizeTitle(expectedTitle, sourceName);
  const matching = titleSignals.filter(
    (signal) => normalizeTitle(signal.value, sourceName) === expected,
  );
  const nonmatching = titleSignals.filter(
    (signal) => normalizeTitle(signal.value, sourceName) !== expected,
  );
  const distinctNonmatches = new Set(
    nonmatching.map((signal) => normalizeTitle(signal.value, sourceName)).filter(Boolean),
  );
  const mismatchKinds = new Set(nonmatching.map((signal) => signal.kind));
  const corroboratedMismatch =
    !responseCapped &&
    mismatchKinds.size >= 2 &&
    distinctNonmatches.size === 1 &&
    nonmatching.length >= 2;

  if (matching.length) {
    return {
      status: "confirmed_match",
      reason: `normalized_exact_match:${matching.map((signal) => signal.kind).join(",")}`,
      matchedSignals: matching.map((signal) => signal.kind),
    };
  }
  if (corroboratedMismatch) {
    return {
      status: "confirmed_mismatch",
      reason: "complete_response_two_independent_signals_agree_on_nonmatching_title",
      matchedSignals: [],
    };
  }
  const reason = responseCapped
    ? "no_match_in_capped_prefix_or_no_supported_title_signal"
    : distinctNonmatches.size > 1
      ? "conflicting_nonmatching_title_signals"
      : titleSignals.length
        ? "insufficient_independent_nonmatching_signals"
        : "no_supported_title_signal";
  return { status: "unverifiable", reason, matchedSignals: [] };
}
