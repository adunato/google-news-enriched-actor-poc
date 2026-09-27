import type { PublisherResolvedArticle } from "./publisher-url.js";

export type DateRange = "any" | "1h" | "6h" | "1d" | "7d" | "30d";

export interface ActorInput {
  queries: string[];
  maxItemsPerQuery: number;
  language: string;
  country: string;
  dateRange: DateRange;
  dedupe: boolean;
  resolvePublisherUrls: boolean;
  includeFullText: boolean;
}

export type ActorInputProcessor = (input: ActorInput) => Promise<void> | void;

const DATE_RANGES: readonly DateRange[] = ["any", "1h", "6h", "1d", "7d", "30d"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(input: Record<string, unknown>, key: string, defaultValue?: string): string {
  const value = input[key];
  if (value === undefined && defaultValue !== undefined) return defaultValue;
  if (typeof value !== "string") throw new Error(`Input field '${key}' must be a string.`);
  return value;
}

function readBoolean(input: Record<string, unknown>, key: string, defaultValue: boolean): boolean {
  const value = input[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== "boolean") throw new Error(`Input field '${key}' must be a boolean.`);
  return value;
}

export function validateActorInput(value: unknown): ActorInput {
  if (!isRecord(value)) throw new Error("Actor input must be an object.");

  const queries = value.queries;
  if (!Array.isArray(queries) || queries.length < 1 || queries.length > 20) {
    throw new Error("Input field 'queries' must contain between 1 and 20 non-empty strings.");
  }
  if (queries.some((query) => typeof query !== "string" || query.trim().length === 0)) {
    throw new Error("Input field 'queries' must contain between 1 and 20 non-empty strings.");
  }

  const maxItemsPerQuery = value.maxItemsPerQuery === undefined ? 20 : value.maxItemsPerQuery;
  if (
    typeof maxItemsPerQuery !== "number" ||
    !Number.isInteger(maxItemsPerQuery) ||
    maxItemsPerQuery < 1 ||
    maxItemsPerQuery > 100
  ) {
    throw new Error("Input field 'maxItemsPerQuery' must be an integer from 1 to 100.");
  }

  const dateRange = readString(value, "dateRange", "7d");
  if (!DATE_RANGES.includes(dateRange as DateRange)) {
    throw new Error(`Input field 'dateRange' must be one of: ${DATE_RANGES.join(", ")}.`);
  }

  return {
    queries,
    maxItemsPerQuery,
    language: readString(value, "language", "en-GB"),
    country: readString(value, "country", "GB"),
    dateRange: dateRange as DateRange,
    dedupe: readBoolean(value, "dedupe", true),
    resolvePublisherUrls: readBoolean(value, "resolvePublisherUrls", true),
    includeFullText: readBoolean(value, "includeFullText", false),
  };
}

/** Validate and default Actor input before handing it to article processing. */
export async function runWithActorInput(
  rawInput: unknown,
  processInput: ActorInputProcessor,
): Promise<void> {
  await processInput(validateActorInput(rawInput));
}

/** Observable processing boundary for the next implementation stage. */
export function processActorInput(input: ActorInput, articles: PublisherResolvedArticle[]): void {
  console.info(
    JSON.stringify({
      event: "actor_input_accepted_for_processing",
      queryCount: input.queries.length,
      articleCount: articles.length,
      publisherUrlResolution: {
        successCount: articles.filter((article) => article.urlResolutionStatus === "success")
          .length,
        failureCount: articles.filter((article) => article.urlResolutionStatus === "failure")
          .length,
        notRequestedCount: articles.filter(
          (article) => article.urlResolutionStatus === "not_requested",
        ).length,
      },
    }),
  );
}
