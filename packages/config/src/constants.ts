/**
 * Non-secret, shared constants. Prices, pricing coefficients and any other
 * numeric business config live in `pricing_config`/`services` (Supabase),
 * never here — see docs/architecture/repository-audit.md §3, §6 and
 * CLAUDE.md ("Prices come from DB config, never constants").
 */

export const PILOT_CITY = "Oradea" as const;

export const CURRENCY = "RON" as const;

export const AGENT_OFFER_WINDOW_SECONDS = 45 as const;

export const SOS_HOLD_DURATION_SECONDS = 3 as const;
