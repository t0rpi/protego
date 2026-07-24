import { describe, expect, it } from "vitest";
import { canConfirmMission, MINIMUM_VERIFICATION_LEVEL_TO_CONFIRM_MISSION } from "./rules";

describe("canConfirmMission", () => {
  it("blocks a client at verification level 1", () => {
    expect(canConfirmMission({ verificationLevel: 1 })).toBe(false);
  });

  it("allows a client at verification level 2", () => {
    expect(canConfirmMission({ verificationLevel: 2 })).toBe(true);
  });

  it("uses 2 as the minimum level, per PRD §7", () => {
    expect(MINIMUM_VERIFICATION_LEVEL_TO_CONFIRM_MISSION).toBe(2);
  });
});
