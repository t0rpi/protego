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
  minBillingHours: number;
  degressiveThresholdHours: number | null;
  degressiveRate: number;
  platformFee: number;
  vatRate: number;
  freeCancelMinutes: number;
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
  label: "agent" | "vehicle" | "client_vehicle" | "distance" | "platform_fee" | "vat" | "overage";
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  total: number;
  currency: "RON";
}
