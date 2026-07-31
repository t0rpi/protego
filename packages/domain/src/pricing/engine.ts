import type { PricingConfig, Quote, QuoteInput, QuoteLine } from "./types";

/**
 * Client-side preview mirror of the authoritative SQL engine
 * (public.compute_quote() in supabase/migrations/20260731100005_quotes.sql).
 * This is for showing a live-updating quote as the booking form is
 * filled in — the number that actually gets stored and gates
 * quoted->confirmed always comes from the SQL function, never from this
 * one, so a client can't tamper with a price by editing the app. Keep
 * the two formulas in sync; the pgTAP suite gives the SQL side the same
 * scrutiny these tests give this one.
 */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeQuote(input: QuoteInput, config: PricingConfig): Quote {
  const lines: QuoteLine[] = [];

  const hours = Math.max(input.hours, config.minBillingHours);
  const threshold = config.degressiveThresholdHours ?? hours;
  const normalHours = Math.min(hours, threshold);
  const discountedHours = Math.max(0, hours - threshold);

  const coef =
    1 *
    (input.isNight ? config.coefNight : 1) *
    (input.isWeekend ? config.coefWeekend : 1) *
    (input.isUrgent ? config.coefUrgent : 1);

  const agentCost = round2(
    input.agentCount * config.perHourAgent * coef * (normalHours + discountedHours * config.degressiveRate)
  );
  lines.push({ label: "agent", amount: agentCost });

  let vehicleCost = 0;
  if (input.mobility === "protego_vehicle") {
    vehicleCost = round2(hours * config.perHourVehicle);
    lines.push({ label: "vehicle", amount: vehicleCost });
  } else if (input.mobility === "client_vehicle") {
    lines.push({ label: "client_vehicle", amount: 0 });
  }

  let distanceCost = 0;
  if (input.serviceKey === "protect_ride" && input.km) {
    distanceCost = round2(input.km * config.perKm);
    lines.push({ label: "distance", amount: distanceCost });
  }

  lines.push({ label: "platform_fee", amount: config.platformFee });

  const subtotal = agentCost + vehicleCost + distanceCost + config.platformFee;
  const vat = round2(subtotal * config.vatRate);
  lines.push({ label: "vat", amount: vat });

  const total = round2(subtotal + vat);

  return { lines, total, currency: "RON" };
}

/**
 * Overage (prelungire) — business-rules.md §4: proposed automatically
 * but applied only after explicit client confirmation, never silently.
 * Only the incremental agent time + VAT is billed; the platform fee and
 * vehicle line are one-time charges from the original quote, not
 * repeated per extension.
 */
export function computeOverageQuote(
  extraHours: number,
  input: Pick<QuoteInput, "agentCount" | "isNight" | "isWeekend" | "isUrgent">,
  config: PricingConfig
): Quote {
  const coef =
    1 *
    (input.isNight ? config.coefNight : 1) *
    (input.isWeekend ? config.coefWeekend : 1) *
    (input.isUrgent ? config.coefUrgent : 1);

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
  };
}
