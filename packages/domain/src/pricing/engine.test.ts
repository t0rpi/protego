import { describe, expect, it } from "vitest";
import { computeOverageQuote, computeQuote } from "./engine";
import type { PricingConfig } from "./types";

const baseConfig: PricingConfig = {
  base: 0,
  perHourAgent: 180,
  perHourVehicle: 60,
  perKm: 2,
  coefNight: 1.2,
  coefWeekend: 1.1,
  coefUrgent: 1.15,
  minBillingHours: 0,
  degressiveThresholdHours: 8,
  degressiveRate: 0.9,
  platformFee: 20,
  vatRate: 0.21,
  freeCancelMinutes: 60,
};

describe("computeQuote", () => {
  it("computes a basic protego-vehicle hourly quote with platform fee and VAT", () => {
    const quote = computeQuote(
      { serviceKey: "hourly", agentCount: 1, hours: 2, mobility: "protego_vehicle" },
      baseConfig
    );
    // agent: 1 * 180 * 2 = 360; vehicle: 2 * 60 = 120; platform: 20
    // subtotal = 500; vat = 105; total = 605
    expect(quote.lines).toEqual([
      { label: "agent", amount: 360 },
      { label: "vehicle", amount: 120 },
      { label: "platform_fee", amount: 20 },
      { label: "vat", amount: 105 },
    ]);
    expect(quote.total).toBe(605);
  });

  it("enforces the minimum billing hours (Escort 1h, Hourly 2h — business-rules.md decisions #8/#11)", () => {
    const config = { ...baseConfig, minBillingHours: 1 };
    const quote = computeQuote(
      { serviceKey: "escort", agentCount: 1, hours: 0.25, mobility: "on_foot" },
      config
    );
    // billed as 1h even though only 0.25h was requested
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(180);
  });

  it("applies the degressive rate only to hours beyond the threshold", () => {
    const quote = computeQuote(
      { serviceKey: "hourly", agentCount: 1, hours: 10, mobility: "on_foot" },
      baseConfig
    );
    // 8h normal + 2h at 0.9 discount: 180 * (8 + 2*0.9) = 180 * 9.8 = 1764
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(1764);
  });

  it("stacks night/weekend/urgent coefficients multiplicatively", () => {
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
    // 180 * 1.2 * 1.1 * 1.15 = 273.24
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(273.24);
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

  it("adds a distance line only for protect_ride, using per_km", () => {
    const ride = computeQuote(
      { serviceKey: "protect_ride", agentCount: 1, hours: 1, km: 15, mobility: "protego_vehicle" },
      baseConfig
    );
    expect(ride.lines.find((l) => l.label === "distance")?.amount).toBe(30);

    const escort = computeQuote(
      { serviceKey: "escort", agentCount: 1, hours: 1, km: 15, mobility: "protego_vehicle" },
      baseConfig
    );
    expect(escort.lines.find((l) => l.label === "distance")).toBeUndefined();
  });

  it("scales agent cost with agent_count", () => {
    const quote = computeQuote(
      { serviceKey: "hourly", agentCount: 3, hours: 2, mobility: "on_foot" },
      baseConfig
    );
    expect(quote.lines.find((l) => l.label === "agent")?.amount).toBe(3 * 180 * 2);
  });
});

describe("computeOverageQuote", () => {
  it("bills only the incremental agent time + VAT, no platform fee or vehicle line", () => {
    const overage = computeOverageQuote(1, { agentCount: 1 }, baseConfig);
    expect(overage.lines).toEqual([
      { label: "overage", amount: 180 },
      { label: "vat", amount: 37.8 },
    ]);
    expect(overage.total).toBe(217.8);
  });
});
