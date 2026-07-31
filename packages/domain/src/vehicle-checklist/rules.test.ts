import { describe, expect, it } from "vitest";
import {
  isBookingTimeChecklistComplete,
  isPhotoChecklistComplete,
  VEHICLE_CHECKLIST_PHOTO_KEYS,
} from "./rules";

describe("isBookingTimeChecklistComplete", () => {
  it("is false if any of consent/insurance/signature is missing", () => {
    expect(
      isBookingTimeChecklistComplete({
        consentSignedAt: null,
        insuranceConfirmed: true,
        clientSignatureAt: "2026-07-31T10:00:00Z",
      })
    ).toBe(false);

    expect(
      isBookingTimeChecklistComplete({
        consentSignedAt: "2026-07-31T10:00:00Z",
        insuranceConfirmed: false,
        clientSignatureAt: "2026-07-31T10:00:00Z",
      })
    ).toBe(false);

    expect(
      isBookingTimeChecklistComplete({
        consentSignedAt: "2026-07-31T10:00:00Z",
        insuranceConfirmed: true,
        clientSignatureAt: null,
      })
    ).toBe(false);
  });

  it("is true once all three are present, without needing any photo", () => {
    expect(
      isBookingTimeChecklistComplete({
        consentSignedAt: "2026-07-31T10:00:00Z",
        insuranceConfirmed: true,
        clientSignatureAt: "2026-07-31T10:00:00Z",
      })
    ).toBe(true);
  });
});

describe("isPhotoChecklistComplete", () => {
  it("requires all 6 photo keys", () => {
    const partial = Object.fromEntries(VEHICLE_CHECKLIST_PHOTO_KEYS.slice(0, 5).map((k) => [k, "path"]));
    expect(isPhotoChecklistComplete(partial)).toBe(false);

    const full = Object.fromEntries(VEHICLE_CHECKLIST_PHOTO_KEYS.map((k) => [k, "path"]));
    expect(isPhotoChecklistComplete(full)).toBe(true);
  });
});
