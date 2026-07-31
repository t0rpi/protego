import type { PricingConfig, Quote, QuoteInput, QuoteLine } from "./types";

/**
 * Client-side preview mirror of the authoritative SQL engine
 * (public.compute_quote() in supabase/migrations/
 * 20260731130002_compute_quote_v2_3.sql). This is for showing a
 * live-updating quote as the booking form is filled in — the number
 * that actually gets stored and gates quoted->confirmed always comes
 * from the SQL function, never from this one, so a client can't tamper
 * with a price by editing the app. Keep the two formulas in sync; the
 * pgTAP suite gives the SQL side the same scrutiny these tests give
 * this one.
 *
 * v2.3 (PROTEGO_MASTERPROMPT_v2.3.md §16-23): Protect Ride is a flat +
 * per-km fare with the vehicle bundled in (no hourly agent rate at
 * all); Escort/Hourly stay hourly-agent-rate services with an optional
 * separate vehicle line. `laborComponent` is what v2.3 §23 calls
 * "componenta de manoperă" — the base for the agent's 55% share,
 * excluding vehicle cost and the platform fee.
 */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * v2.3 §21: the weekend coefficient window is Friday 20:00 through
 * Sunday 24:00 — mirrors public.is_weekend_pricing_window() (supabase/
 * migrations/20260731140001_weekend_coefficient_window.sql), added
 * after the SQL side shipped with a Sat/Sun-only bug in M5. No caller
 * in this codebase computes `isWeekend` from a real Date yet (the SQL
 * function is the only live call site so far) — this exists so any
 * future client-side quote preview reaches for this instead of
 * reinventing the same check incorrectly.
 */
export function isWeekendPricingWindow(date: Date): boolean {
  const day = date.getDay(); // 0=Sunday ... 6=Saturday
  if (day === 6 || day === 0) return true;
  return day === 5 && date.getHours() >= 20;
}

function combinedCoefficient(
  config: Pick<PricingConfig, "coefNight" | "coefWeekend" | "coefUrgent" | "coefCap">,
  input: Pick<QuoteInput, "isNight" | "isWeekend" | "isUrgent">
): number {
  const raw =
    1 *
    (input.isNight ? config.coefNight : 1) *
    (input.isWeekend ? config.coefWeekend : 1) *
    (input.isUrgent ? config.coefUrgent : 1);
  return Math.min(raw, config.coefCap);
}

export function computeQuote(input: QuoteInput, config: PricingConfig): Quote {
  const lines: QuoteLine[] = [];
  const coef = combinedCoefficient(config, input);
  let laborComponent: number;
  let vehicleCost = 0;

  if (input.serviceKey === "protect_ride") {
    const baseCost = round2(config.base * coef);
    lines.push({ label: "base", amount: baseCost });

    let distanceCost = 0;
    if (input.km) {
      distanceCost = round2(input.km * config.perKm * coef);
      lines.push({ label: "distance", amount: distanceCost });
    }

    laborComponent = baseCost + distanceCost;

    if (config.minimumTotal !== null && laborComponent < config.minimumTotal) {
      const adjustment = round2(config.minimumTotal - laborComponent);
      lines.push({ label: "minimum_adjustment", amount: adjustment });
      laborComponent = config.minimumTotal;
    }
  } else {
    const hours = Math.max(input.hours, config.minBillingHours);
    const threshold = config.degressiveThresholdHours ?? hours;
    const normalHours = Math.min(hours, threshold);
    const discountedHours = Math.max(0, hours - threshold);

    laborComponent = round2(
      input.agentCount * config.perHourAgent * coef * (normalHours + discountedHours * config.degressiveRate)
    );
    lines.push({ label: "agent", amount: laborComponent });

    if (input.mobility === "protego_vehicle") {
      vehicleCost = round2(hours * config.perHourVehicle);
      lines.push({ label: "vehicle", amount: vehicleCost });
    } else if (input.mobility === "client_vehicle") {
      lines.push({ label: "client_vehicle", amount: 0 });
    }
  }

  lines.push({ label: "platform_fee", amount: config.platformFee });

  const subtotal = laborComponent + vehicleCost + config.platformFee;
  const vat = round2(subtotal * config.vatRate);
  lines.push({ label: "vat", amount: vat });

  const total = round2(subtotal + vat);

  return { lines, total, currency: "RON", laborComponent };
}

/**
 * Overage (prelungire) — business-rules.md §4: proposed automatically
 * but applied only after explicit client confirmation, never silently.
 * Only the incremental agent time + VAT is billed; the platform fee and
 * vehicle line are one-time charges from the original quote, not
 * repeated per extension. Does not apply to Protect Ride (distance-
 * based, not hourly).
 */
export function computeOverageQuote(
  extraHours: number,
  input: Pick<QuoteInput, "agentCount" | "isNight" | "isWeekend" | "isUrgent">,
  config: PricingConfig
): Quote {
  const coef = combinedCoefficient(config, input);

  const agentCost = round2(input.agentCount * config.perHourAgent * coef * extraHours);
  const vat = round2(agentCost * config.vatRate);
  const total = round2(agentCost + vat);

  return {
    lines: [
      { label: "overage", amount: agentCost },
      { label: "vat", amount: vat },
    ],
    total,
    currency: "RON",
    laborComponent: agentCost,
  };
}
