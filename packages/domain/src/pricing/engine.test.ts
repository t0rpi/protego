import { describe, expect, it } from "vitest";
import { computeOverageQuote, computeQuote, isWeekendPricingWindow } from "./engine";
import type { PricingConfig } from "./types";

// Mirrors the v2.3 Hourly/Escort config shape (PROTEGO_MASTERPROMPT_v2.3.md
// §17-18, §21) — coefficients kept distinct (not all equal) so the
// multiplicative-stacking test is meaningful, and small enough that the
// coefCap (1.5) test below can actually exceed it.
const baseConfig: PricingConfig = {
  base: 30,
  perHourAgent: 130,
  perHourVehicle: 50,
  perKm: 5,
  coefNight: 1.25,
  coefWeekend: 1.15,
  coefUrgent: 1.2,
  coefCap: 1.5,
  minBillingHours: 0,
  degressiveThresholdHours: 8,
  degressiveRate: 0.85,
  platformFee: 20,
  vatRate: 0.21,
  freeCancelMinutes: 60,
  minimumTotal: null,
  defaultDistanceKm: null,
  doorToDoorIncluded: false,
  waitFreeMinutes: 5,
  waitPerMinuteRate: null,
  accompanyInsideFee: null,
  accompanyInsideIncludedMinutes: 15,
  accompanyInsideHourlyThresholdMinutes: 45,
  agentMinimumPerMission: null,
  cancellationFeePct: 0.3,
  cancellationFeeMinimum: 30,
  agentSharePct: 0.55,
  vehicleIncludedKmPerHour: null,
  vehicleKmSurchargeRate: null,
  platformFeePerHour: null,
};

describe("computeQuote — Escort/Hourly (hourly agent rate)", () => {
  it("computes a basic protego-vehicle hourly quote with platform fee and VAT", () => {
    const quote = computeQuote(
      { serviceKey: "hourly", agentCount: 1, hours: 2, mobility: "protego_vehicle" },
      baseConfig
    );
    // agent: 1 * 130 * 2 = 260; vehicle: 2 * 50 = 100; platform: 20
    // subtotal = 380; vat = 79.80; total = 459.80
    expect(quote.lines).toEqual([
      { label: "agent", amount: 260 },
      { label: "vehicle", amount: 100 },
      { label: "platform_fee", amount: 20 },
      { label: "vat", amount: 79.8 },
    ]);
    expect(quote.total).toBe(459.8);
    expect(quote.laborComponent).toBe(260);
  });

  it("enforces the minimum billing hours (Escort 1h, Hourly 2h — business-rules.md decisions #8/#11)", () => {
    const config = { ...baseConfig, minBillingHours: 1 };
    const quote = computeQuote(
      { serviceKey: "escort", agentCount: 1, hours: 0.25, mobility: "on_foot" },
      config
    );
    // billed as 1h even though only 0.25h was requested
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(130);
  });

  it("applies the degressive rate only to hours beyond the threshold", () => {
    const quote = computeQuote(
      { serviceKey: "hourly", agentCount: 1, hours: 10, mobility: "on_foot" },
      baseConfig
    );
    // 8h normal + 2h at 0.85 discount: 130 * (8 + 2*0.85) = 130 * 9.7 = 1261
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(1261);
  });

  it("stacks night/weekend/urgent coefficients multiplicatively, under the cap", () => {
    const quote = computeQuote(
      {
        serviceKey: "hourly",
        agentCount: 1,
        hours: 1,
        mobility: "on_foot",
        isNight: true,
        isWeekend: true,
        isUrgent: false,
      },
      baseConfig
    );
    // 130 * 1.25 * 1.15 = 186.875 -> rounds to 186.88 (under the 1.5 cap: 1.4375)
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(186.88);
  });

  it("caps the combined coefficient at coefCap (v2.3 §21) even if the raw product exceeds it", () => {
    const quote = computeQuote(
      {
        serviceKey: "hourly",
        agentCount: 1,
        hours: 1,
        mobility: "on_foot",
        isNight: true,
        isWeekend: true,
        isUrgent: true,
      },
      baseConfig
    );
    // raw = 1.25 * 1.15 * 1.2 = 1.725, capped at 1.5 -> 130 * 1.5 = 195
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(195);
  });

  it("shows a zero-amount client_vehicle line instead of a vehicle charge", () => {
    const quote = computeQuote(
      { serviceKey: "hourly", agentCount: 1, hours: 2, mobility: "client_vehicle" },
      baseConfig
    );
    expect(quote.lines.find((l) => l.label === "client_vehicle")).toEqual({
      label: "client_vehicle",
      amount: 0,
    });
    expect(quote.lines.find((l) => l.label === "vehicle")).toBeUndefined();
  });

  it("scales agent cost with agent_count", () => {
    const quote = computeQuote(
      { serviceKey: "hourly", agentCount: 3, hours: 2, mobility: "on_foot" },
      baseConfig
    );
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(3 * 130 * 2);
  });
});

describe("computeQuote — Protect Ride (flat + per-km, vehicle bundled)", () => {
  it("computes base + distance with no separate agent or vehicle line (v2.3 §16/§19)", () => {
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, km: 15, mobility: "protego_vehicle" },
      baseConfig
    );
    // base: 30; distance: 15*5 = 75; labor = 105 (above the 60 lei floor); platform: 20
    // subtotal = 125; vat = 26.25; total = 151.25
    expect(quote.lines).toEqual([
      { label: "base", amount: 30 },
      { label: "distance", amount: 75 },
      { label: "platform_fee", amount: 20 },
      { label: "vat", amount: 26.25 },
    ]);
    expect(quote.total).toBe(151.25);
    expect(quote.laborComponent).toBe(105);
    expect(quote.lines.find((l) => l.label === "agent")).toBeUndefined();
    expect(quote.lines.find((l) => l.label === "vehicle")).toBeUndefined();
  });

  it("applies the minimum_total floor (60 lei) for a short ride", () => {
    const config = { ...baseConfig, minimumTotal: 60 };
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, km: 2, mobility: "protego_vehicle" },
      config
    );
    // base 30 + distance 10 = 40, below the 60 floor -> +20 adjustment
    expect(quote.lines.find((l) => l.label === "minimum_adjustment")?.amount).toBe(20);
    expect(quote.laborComponent).toBe(60);
  });

  it("falls back to defaultDistanceKm (flagged as an estimate) when km is left blank", () => {
    const config = { ...baseConfig, defaultDistanceKm: 8 };
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, mobility: "protego_vehicle" },
      config
    );
    // base 30; distance 8*5 = 40 (estimated); labor = 70
    expect(quote.lines).toEqual([
      { label: "base", amount: 30 },
      { label: "distance_estimated", amount: 40 },
      { label: "platform_fee", amount: 20 },
      { label: "vat", amount: 18.9 },
    ]);
    expect(quote.laborComponent).toBe(70);
  });

  it("charges base-fare-only when km is blank and no defaultDistanceKm is configured", () => {
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, mobility: "protego_vehicle" },
      baseConfig
    );
    expect(quote.lines.find((l) => l.label === "distance")).toBeUndefined();
    expect(quote.lines.find((l) => l.label === "distance_estimated")).toBeUndefined();
    expect(quote.laborComponent).toBe(30);
  });

  it("shows door-to-door as an included (0 lei) line when configured", () => {
    const config = { ...baseConfig, doorToDoorIncluded: true };
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, km: 15, mobility: "protego_vehicle" },
      config
    );
    expect(quote.lines.find((l) => l.label === "door_to_door_included")).toEqual({
      label: "door_to_door_included",
      amount: 0,
    });
    expect(quote.laborComponent).toBe(105); // door-to-door adds no cost
  });

  it("charges wait_at_destination only past the free minutes", () => {
    const config = { ...baseConfig, waitFreeMinutes: 5, waitPerMinuteRate: 2 };
    const quote = computeQuote(
      {
        serviceKey: "protect_ride",
        agentCount: 1,
        hours: 0,
        km: 15,
        mobility: "protego_vehicle",
        waitMinutes: 20,
      },
      config
    );
    // 20 - 5 free = 15 billable * 2 lei = 30
    expect(quote.lines.find((l) => l.label === "wait_at_destination")?.amount).toBe(30);
    expect(quote.laborComponent).toBe(105 + 30);
  });

  it("does not add a wait_at_destination line when within the free window", () => {
    const config = { ...baseConfig, waitFreeMinutes: 5, waitPerMinuteRate: 2 };
    const quote = computeQuote(
      {
        serviceKey: "protect_ride",
        agentCount: 1,
        hours: 0,
        km: 15,
        mobility: "protego_vehicle",
        waitMinutes: 3,
      },
      config
    );
    expect(quote.lines.find((l) => l.label === "wait_at_destination")?.amount).toBe(0);
  });

  it("charges only the flat accompany_inside fee within the included minutes", () => {
    const config = { ...baseConfig, accompanyInsideFee: 25, accompanyInsideIncludedMinutes: 15 };
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, km: 15, mobility: "protego_vehicle", accompanyMinutes: 10 },
      config
    );
    expect(quote.lines.find((l) => l.label === "accompany_inside")?.amount).toBe(25);
    expect(quote.laborComponent).toBe(105 + 25);
  });

  it("charges the flat fee plus per-minute overage past the included minutes (2026-08-04)", () => {
    const config = {
      ...baseConfig,
      accompanyInsideFee: 25,
      accompanyInsideIncludedMinutes: 15,
      waitPerMinuteRate: 2,
    };
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, km: 15, mobility: "protego_vehicle", accompanyMinutes: 40 },
      config
    );
    // 25 flat + (40-15)*2 = 25 + 50 = 75
    expect(quote.lines.find((l) => l.label === "accompany_inside")?.amount).toBe(75);
    expect(quote.laborComponent).toBe(105 + 75);
  });
});

describe("computeQuote — Escort/Hourly vehicle km surcharge (2026-08-04)", () => {
  it("adds a vehicle_km_surcharge line only when driving exceeds the included allowance", () => {
    const config = { ...baseConfig, vehicleIncludedKmPerHour: 25, vehicleKmSurchargeRate: 2 };
    const quote = computeQuote(
      { serviceKey: "escort", agentCount: 1, hours: 3, km: 100, mobility: "protego_vehicle" },
      config
    );
    // included = 25*3 = 75km; surcharge = (100-75)*2 = 50
    expect(quote.lines.find((l) => l.label === "vehicle_km_surcharge")?.amount).toBe(50);
    // vehicle line itself should include the surcharge (150 base + 50 surcharge)
    expect(quote.lines.find((l) => l.label === "vehicle")?.amount).toBe(150);
    // surcharge stays out of labor_component — vehicle revenue is the company's
    expect(quote.laborComponent).toBe(quote.lines.find((l) => l.label === "agent")?.amount);
  });

  it("does not add a surcharge line when driving stays within the included allowance", () => {
    const config = { ...baseConfig, vehicleIncludedKmPerHour: 25, vehicleKmSurchargeRate: 2 };
    const quote = computeQuote(
      { serviceKey: "escort", agentCount: 1, hours: 3, km: 50, mobility: "protego_vehicle" },
      config
    );
    expect(quote.lines.find((l) => l.label === "vehicle_km_surcharge")).toBeUndefined();
  });
});

describe("computeQuote — Escort/Hourly platform fee scaling (2026-08-04)", () => {
  it("stays at the flat platform fee up to ~4 hours", () => {
    const config = { ...baseConfig, platformFeePerHour: 5 };
    const quote = computeQuote({ serviceKey: "hourly", agentCount: 1, hours: 4, mobility: "on_foot" }, config);
    // 5*4=20, matches the flat floor exactly
    expect(quote.lines.find((l) => l.label === "platform_fee")?.amount).toBe(20);
  });

  it("scales past ~4 hours", () => {
    const config = { ...baseConfig, platformFeePerHour: 5 };
    const quote = computeQuote({ serviceKey: "hourly", agentCount: 1, hours: 8, mobility: "on_foot" }, config);
    expect(quote.lines.find((l) => l.label === "platform_fee")?.amount).toBe(40);
  });

  it("stays flat for Protect Ride regardless of platformFeePerHour", () => {
    const config = { ...baseConfig, platformFeePerHour: 5 };
    const quote = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 0, km: 15, mobility: "protego_vehicle" },
      config
    );
    expect(quote.lines.find((l) => l.label === "platform_fee")?.amount).toBe(20);
  });
});

describe("computeOverageQuote", () => {
  it("bills only the incremental agent time + VAT, no platform fee or vehicle line", () => {
    const overage = computeOverageQuote(1, { agentCount: 1 }, baseConfig);
    expect(overage.lines).toEqual([
      { label: "overage", amount: 130 },
      { label: "vat", amount: 27.3 },
    ]);
    expect(overage.total).toBe(157.3);
    expect(overage.laborComponent).toBe(130);
  });
});

// 2026-08-03 is a confirmed Monday (used as the ISO week anchor
// elsewhere in this project's pgTAP fixtures) — so 08-07 is Friday,
// 08-08 Saturday, 08-09 Sunday, 08-10 the following Monday.
describe("isWeekendPricingWindow (v2.3 §21: Fri 20:00 -> Sun 24:00)", () => {
  it("is false on Friday before 20:00", () => {
    expect(isWeekendPricingWindow(new Date(2026, 7, 7, 19, 59))).toBe(false);
  });

  it("is true on Friday at/after 20:00", () => {
    expect(isWeekendPricingWindow(new Date(2026, 7, 7, 20, 0))).toBe(true);
    expect(isWeekendPricingWindow(new Date(2026, 7, 7, 23, 30))).toBe(true);
  });

  it("is true all day Saturday and Sunday", () => {
    expect(isWeekendPricingWindow(new Date(2026, 7, 8, 3, 0))).toBe(true);
    expect(isWeekendPricingWindow(new Date(2026, 7, 9, 23, 59))).toBe(true);
  });

  it("is false again once Monday starts (Sunday 24:00 boundary)", () => {
    expect(isWeekendPricingWindow(new Date(2026, 7, 10, 0, 0))).toBe(false);
  });

  it("is false on a plain weekday", () => {
    expect(isWeekendPricingWindow(new Date(2026, 7, 5, 14, 0))).toBe(false);
  });
});
