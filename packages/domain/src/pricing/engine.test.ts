import { describe, expect, it } from "vitest";
import { computeOverageQuote, computeQuote } from "./engine";
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
  agentMinimumPerMission: null,
  cancellationFeePct: 0.3,
  cancellationFeeMinimum: 30,
  agentSharePct: 0.55,
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
