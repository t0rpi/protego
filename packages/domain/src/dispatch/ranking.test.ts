import { describe, expect, it } from "vitest";
import { computeSuggestionScore, rankAgentSuggestions } from "./ranking";

describe("rankAgentSuggestions", () => {
  it("ranks higher rating above lower rating, all else equal", () => {
    const ranked = rankAgentSuggestions([
      { agentId: "a", rating: 3, badgeCount: 0, hasVehicle: false },
      { agentId: "b", rating: 5, badgeCount: 0, hasVehicle: false },
    ]);
    expect(ranked.map((r) => r.agentId)).toEqual(["b", "a"]);
  });

  it("rewards more badges and having a vehicle", () => {
    const withBadgesAndVehicle = computeSuggestionScore({
      agentId: "a",
      rating: 4,
      badgeCount: 3,
      hasVehicle: true,
    });
    const plain = computeSuggestionScore({ agentId: "b", rating: 4, badgeCount: 0, hasVehicle: false });
    expect(withBadgesAndVehicle).toBeGreaterThan(plain);
  });

  it("factors in distance when available, without requiring it", () => {
    const close = computeSuggestionScore({ agentId: "a", rating: 4, badgeCount: 0, hasVehicle: false, distanceKm: 1 });
    const far = computeSuggestionScore({ agentId: "b", rating: 4, badgeCount: 0, hasVehicle: false, distanceKm: 15 });
    const noDistance = computeSuggestionScore({ agentId: "c", rating: 4, badgeCount: 0, hasVehicle: false });
    expect(close).toBeGreaterThan(far);
    expect(noDistance).toBe(4 * 20);
  });

  it("treats an unrated agent (null rating) as the lowest rating tier, not an error", () => {
    expect(() =>
      rankAgentSuggestions([{ agentId: "a", rating: null, badgeCount: 0, hasVehicle: false }])
    ).not.toThrow();
  });
});
