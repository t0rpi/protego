import { describe, expect, it } from "vitest";
import { isOfferExpired, OFFER_EXPIRY_SECONDS, secondsUntilOfferExpires } from "./rules";

describe("isOfferExpired", () => {
  it("is false before the expiry instant", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const expiresAt = new Date(now.getTime() + 1000).toISOString();
    expect(isOfferExpired(expiresAt, now)).toBe(false);
  });

  it("is true once now is past the expiry instant", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const expiresAt = new Date(now.getTime() - 1000).toISOString();
    expect(isOfferExpired(expiresAt, now)).toBe(true);
  });
});

describe("secondsUntilOfferExpires", () => {
  it("counts down from the full 45s window", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const expiresAt = new Date(now.getTime() + OFFER_EXPIRY_SECONDS * 1000).toISOString();
    expect(secondsUntilOfferExpires(expiresAt, now)).toBe(OFFER_EXPIRY_SECONDS);
  });

  it("floors at 0 rather than going negative", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const expiresAt = new Date(now.getTime() - 5000).toISOString();
    expect(secondsUntilOfferExpires(expiresAt, now)).toBe(0);
  });
});
