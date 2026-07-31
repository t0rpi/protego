import { describe, expect, it } from "vitest";
import { isSosProtocolComplete } from "./protocol";

describe("isSosProtocolComplete", () => {
  it("is false until all 4 steps are explicitly true", () => {
    expect(isSosProtocolComplete({})).toBe(false);
    expect(isSosProtocolComplete({ p1: true, p2: true, p3: true })).toBe(false);
  });

  it("is true only once all 4 steps are true", () => {
    expect(isSosProtocolComplete({ p1: true, p2: true, p3: true, p4: true })).toBe(true);
  });

  it("does not treat a missing step as satisfied", () => {
    expect(isSosProtocolComplete({ p1: true, p2: true, p3: true, p4: false })).toBe(false);
  });
});
