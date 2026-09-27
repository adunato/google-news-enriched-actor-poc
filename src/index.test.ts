import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { runWithActorInput, validateActorInput } from "./input.js";

const schema = JSON.parse(
  readFileSync(new URL("../.actor/input_schema.json", import.meta.url), "utf8"),
) as {
  properties: Record<string, Record<string, unknown>>;
  required: string[];
};

describe("Actor input contract", () => {
  it("applies the approved defaults", () => {
    expect(validateActorInput({ queries: ["climate policy"] })).toEqual({
      queries: ["climate policy"],
      maxItemsPerQuery: 20,
      language: "en-GB",
      country: "GB",
      dateRange: "7d",
      dedupe: true,
      resolvePublisherUrls: true,
      includeFullText: false,
    });
  });

  it("accepts the query-count and result-limit boundaries", () => {
    expect(validateActorInput({ queries: ["first"], maxItemsPerQuery: 1 }).queries).toHaveLength(1);
    expect(
      validateActorInput({
        queries: Array.from({ length: 20 }, (_, index) => `query ${index}`),
        maxItemsPerQuery: 100,
      }).queries,
    ).toHaveLength(20);
  });

  it("preserves valid query text without trimming it", () => {
    expect(validateActorInput({ queries: [" climate policy "] }).queries).toEqual([
      " climate policy ",
    ]);
  });

  it.each([
    undefined,
    {},
    { queries: [] },
    { queries: Array.from({ length: 21 }, (_, index) => `query ${index}`) },
    { queries: [""] },
    { queries: ["   "] },
    { queries: ["\t\t"] },
    { queries: ["valid", 1] },
  ])("rejects invalid queries before processing: %o", (input) => {
    expect(() => validateActorInput(input)).toThrow();
  });

  it.each([0, 101, 1.5, "20", null])(
    "rejects invalid maxItemsPerQuery value %o",
    (maxItemsPerQuery) => {
      expect(() => validateActorInput({ queries: ["valid"], maxItemsPerQuery })).toThrow(
        "maxItemsPerQuery",
      );
    },
  );

  it.each(["any", "1h", "6h", "1d", "7d", "30d"] as const)("accepts date range %s", (dateRange) => {
    expect(validateActorInput({ queries: ["valid"], dateRange }).dateRange).toBe(dateRange);
  });

  it("rejects unsupported date ranges and non-boolean switches", () => {
    expect(() => validateActorInput({ queries: ["valid"], dateRange: "2d" })).toThrow("dateRange");
    expect(() => validateActorInput({ queries: ["valid"], dedupe: "true" })).toThrow("dedupe");
  });

  it("keeps the Apify schema fields, defaults, bounds and choices aligned", () => {
    expect(schema.required).toContain("queries");
    expect(schema.properties.queries).toMatchObject({ minItems: 1, maxItems: 20 });
    expect(schema.properties.maxItemsPerQuery).toMatchObject({
      default: 20,
      minimum: 1,
      maximum: 100,
    });
    expect(schema.properties.language!.default).toBe("en-GB");
    expect(schema.properties.country!.default).toBe("GB");
    expect(schema.properties.dateRange).toMatchObject({
      default: "7d",
      enum: ["any", "1h", "6h", "1d", "7d", "30d"],
    });
    expect(schema.properties.dedupe!.default).toBe(true);
    expect(schema.properties.resolvePublisherUrls!.default).toBe(true);
    expect(schema.properties.includeFullText!.default).toBe(false);
  });

  it("hands fully validated and defaulted input to processing", async () => {
    const processor = vi.fn();
    await runWithActorInput({ queries: ["valid"] }, processor);

    expect(processor).toHaveBeenCalledOnce();
    expect(processor).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en-GB", maxItemsPerQuery: 20 }),
    );
  });

  it("never calls processing for invalid input", async () => {
    const processor = vi.fn();

    await expect(runWithActorInput({ queries: [] }, processor)).rejects.toThrow();
    expect(processor).not.toHaveBeenCalled();
  });
});
