import { describe, expect, it } from "vitest";

import { PROJECT_STATE } from "./index.js";

describe("repository bootstrap", () => {
  it("exposes the non-functional bootstrap state", () => {
    expect(PROJECT_STATE).toBe("bootstrap-established");
  });
});
