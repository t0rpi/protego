import { describe, expect, it } from "vitest";
import { computeAgentEarnings } from "./rules";

describe("computeAgentEarnings", () => {
  it("matches the pgTAP-verified example: 260 labor x 0.55 share = 143", () => {
    expect(computeAgentEarnings({ laborComponent: 260, agentSharePct: 0.55 })).toBe(143);
  });

  it("rounds to 2 decimals", () => {
    expect(computeAgentEarnings({ laborComponent: 100, agentSharePct: 1 / 3 })).toBe(33.33);
  });

  it("applies the floor when the computed share falls below it (Protect Ride, v2.3 §23)", () => {
    // 55% of a 40 lei labor component = 22 lei, below the 35 lei floor
    expect(computeAgentEarnings({ laborComponent: 40, agentSharePct: 0.55, agentMinimumPerMission: 35 })).toBe(35);
  });

  it("does not apply a floor when none is given (Escort/Hourly — none confirmed)", () => {
    expect(computeAgentEarnings({ laborComponent: 40, agentSharePct: 0.55, agentMinimumPerMission: null })).toBe(22);
  });

  it("leaves the computed share alone when it already clears the floor", () => {
    expect(computeAgentEarnings({ laborComponent: 260, agentSharePct: 0.55, agentMinimumPerMission: 35 })).toBe(143);
  });
});
