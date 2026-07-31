import { describe, expect, it } from "vitest";
import { computeAgentEarnings } from "./rules";

describe("computeAgentEarnings", () => {
  it("matches the pgTAP-verified example: 459.80 total x 0.70 share = 321.86", () => {
    expect(computeAgentEarnings({ missionTotal: 459.8, agentSharePct: 0.7 })).toBe(321.86);
  });

  it("rounds to 2 decimals", () => {
    expect(computeAgentEarnings({ missionTotal: 100, agentSharePct: 1 / 3 })).toBe(33.33);
  });
});
