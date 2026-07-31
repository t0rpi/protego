import { describe, expect, it } from "vitest";
import { canTransitionAgentStatus, isAgentEligibleForOffers, isAgentEligibleToStartMission } from "./status";

describe("canTransitionAgentStatus", () => {
  it("allows the onboarding happy path, in order", () => {
    expect(canTransitionAgentStatus("in_review", "approved")).toBe(true);
    expect(canTransitionAgentStatus("approved", "active")).toBe(true);
  });

  it("never allows skipping straight to active", () => {
    expect(canTransitionAgentStatus("in_review", "active")).toBe(false);
  });

  it("allows blocked from any working state, and reinstatement only to approved", () => {
    expect(canTransitionAgentStatus("active", "blocked")).toBe(true);
    expect(canTransitionAgentStatus("blocked", "approved")).toBe(true);
    expect(canTransitionAgentStatus("blocked", "active")).toBe(false);
  });
});

describe("isAgentEligibleForOffers", () => {
  it("requires active + available + no expired document, all three", () => {
    expect(isAgentEligibleForOffers({ status: "active", isAvailable: true, hasExpiredDocument: false })).toBe(true);
    expect(isAgentEligibleForOffers({ status: "approved", isAvailable: true, hasExpiredDocument: false })).toBe(
      false
    );
    expect(isAgentEligibleForOffers({ status: "active", isAvailable: false, hasExpiredDocument: false })).toBe(
      false
    );
    expect(isAgentEligibleForOffers({ status: "active", isAvailable: true, hasExpiredDocument: true })).toBe(false);
  });
});

describe("isAgentEligibleToStartMission", () => {
  it("blocks only on an expired document", () => {
    expect(isAgentEligibleToStartMission({ hasExpiredDocument: false })).toBe(true);
    expect(isAgentEligibleToStartMission({ hasExpiredDocument: true })).toBe(false);
  });
});
