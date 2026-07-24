import { describe, expect, it } from "vitest";
import { MISSION_STATUSES } from "./status";

describe("MISSION_STATUSES", () => {
  it("has no duplicate states", () => {
    expect(new Set(MISSION_STATUSES).size).toBe(MISSION_STATUSES.length);
  });

  it("includes the required terminal and gating states", () => {
    for (const required of [
      "review",
      "confirmed",
      "active",
      "done",
      "cancelled_client",
      "no_agent_available",
    ] as const) {
      expect(MISSION_STATUSES).toContain(required);
    }
  });
});
