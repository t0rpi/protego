import { describe, expect, it } from "vitest";
import { computeRiskLevel } from "./rules";

describe("computeRiskLevel", () => {
  it("flags high risk when a known threat is reported", () => {
    expect(computeRiskLevel({ hasKnownThreat: true, contextKind: "usual" })).toBe("high");
  });

  it("stays normal with no known threat, regardless of context kind", () => {
    for (const contextKind of ["usual", "stranger", "atm", "club"] as const) {
      expect(computeRiskLevel({ hasKnownThreat: false, contextKind })).toBe("normal");
    }
  });
});
