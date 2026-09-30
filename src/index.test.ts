import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actorInit: vi.fn(),
  actorGetInput: vi.fn(),
  actorExit: vi.fn(),
  processActorInput: vi.fn(),
  retrieveGoogleNewsArticles: vi.fn(),
  resolvePublisherUrls: vi.fn(),
}));

vi.mock("apify", () => ({
  Actor: {
    init: mocks.actorInit,
    getInput: mocks.actorGetInput,
    exit: mocks.actorExit,
  },
}));
vi.mock("./input.js", () => ({
  processActorInput: mocks.processActorInput,
  runWithActorInput: vi.fn(async (_rawInput, processInput) => {
    await processInput({ queries: ["climate"], resolvePublisherUrls: true });
  }),
}));
vi.mock("./google-news.js", () => ({
  retrieveGoogleNewsArticles: mocks.retrieveGoogleNewsArticles,
}));
vi.mock("./publisher-url.js", () => ({ resolvePublisherUrls: mocks.resolvePublisherUrls }));

import { main } from "./index.js";

describe("Actor orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actorGetInput.mockResolvedValue({ raw: true });
  });

  it("forwards edition candidates to resolution and passes only flattened rows onward", async () => {
    const candidates = [
      {
        record: {
          query: "climate",
          title: "GB story",
          googleNewsUrl: "https://news.google.com/gb",
        },
        edition: { hl: "en-GB", gl: "GB", ceid: "GB:en-GB" },
      },
      {
        record: {
          query: "climate",
          title: "US story",
          googleNewsUrl: "https://news.google.com/us",
        },
        edition: { hl: "en-US", gl: "US", ceid: "US:en-US" },
      },
    ];
    const rows = candidates.map(({ record }) => ({
      ...record,
      urlResolved: false,
      urlResolutionStatus: "failure" as const,
    }));
    mocks.retrieveGoogleNewsArticles.mockResolvedValue(candidates);
    mocks.resolvePublisherUrls.mockResolvedValue(rows);

    await main();

    expect(mocks.resolvePublisherUrls).toHaveBeenCalledWith(candidates, true);
    expect(mocks.processActorInput).toHaveBeenCalledWith(
      expect.objectContaining({ queries: ["climate"] }),
      rows,
    );
    for (const row of mocks.processActorInput.mock.calls[0]![1] as object[]) {
      expect(row).not.toHaveProperty("edition");
      expect(row).not.toHaveProperty("record");
    }
    expect(mocks.actorInit).toHaveBeenCalledOnce();
    expect(mocks.actorExit).toHaveBeenCalledOnce();
  });
});
