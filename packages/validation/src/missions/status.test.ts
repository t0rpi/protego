import { describe, expect, it } from "vitest";
import { MISSION_STATUSES } from "@protego/domain";
import { missionStatusSchema } from "./status";

describe("missionStatusSchema", () => {
  it("accepts every canonical mission status", () => {
    for (const status of MISSION_STATUSES) {
      expect(missionStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects an unknown status", () => {
    expect(() => missionStatusSchema.parse("not_a_real_status")).toThrow();
  });
});
