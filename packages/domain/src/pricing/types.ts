/**
 * Shape of one row of `pricing_config` (supabase/migrations/
 * 20260731100002_pricing_config.sql). Every number the pricing engine
 * uses comes from here — CLAUDE.md: "Prices come from DB config, never
 * constants." Nothing in this module hardcodes a price; callers fetch a
 * PricingConfig from Supabase and pass it in.
 */
export interface PricingConfig {
  base: number;
  perHourAgent: number;
  perHourVehicle: number;
  perKm: number;
  coefNight: number;
  coefWeekend: number;
  coefUrgent: number;
  /** v2.3 §21 — combined night/weekend/urgent multiplier is capped here (1.5). */
  coefCap: number;
  minBillingHours: number;
  degressiveThresholdHours: number | null;
  degressiveRate: number;
  platformFee: number;
  vatRate: number;
  freeCancelMinutes: number;
  /** v2.3 §16 — floor on the labor/ride component (before platform fee + VAT). Confirmed for Protect Ride (60 lei) only; null elsewhere. */
  minimumTotal: number | null;
  /** M7 QA stopgap — disclosed placeholder distance used when the client leaves km blank (real geocoding not built yet). Protect Ride only; null elsewhere. */
  defaultDistanceKm: number | null;
  /** v2.3 §23 — floor on the agent's computed earnings. Confirmed for Protect Ride (35 lei) only; null elsewhere — not invented for Escort/Hourly. */
  agentMinimumPerMission: number | null;
  /** v2.3 §22 */
  cancellationFeePct: number;
  cancellationFeeMinimum: number;
  /** v2.3 §23 — fraction of the labor component paid to the agent (0.55), never of the total. */
  agentSharePct: number;
}

export type ServiceKey = "protect_ride" | "escort" | "hourly";
export type Mobility = "protego_vehicle" | "client_vehicle" | "on_foot";

export interface QuoteInput {
  serviceKey: ServiceKey;
  agentCount: number;
  hours: number;
  km?: number;
  mobility: Mobility;
  isNight?: boolean;
  isWeekend?: boolean;
  isUrgent?: boolean;
}

export interface QuoteLine {
  label:
    | "base"
    | "distance"
    | "distance_estimated"
    | "minimum_adjustment"
    | "agent"
    | "vehicle"
    | "client_vehicle"
    | "platform_fee"
    | "vat"
    | "overage";
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  total: number;
  currency: "RON";
  /** The part of `total` that is the agent's 55% share base — excludes vehicle cost and the platform fee. */
  laborComponent: number;
}
