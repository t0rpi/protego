-- M5 housekeeping — PROTEGO_MASTERPROMPT_v2.3 §16-23 (founder-confirmed
-- pilot pricing, 31 July 2026): replaces the M2/M3 placeholder values
-- (180/60/20 flat rates, 1.0 no-op coefficients, agent_share_pct=0.70)
-- with real, confirmed numbers. Still fully admin-editable — v2.3 gives
-- STARTING values for the Oradea pilot, not hardcoded constants.
--
-- New columns needed for the v2.3 rules that didn't exist before:
--   coef_cap                 — §21: coefficients multiply together but
--                               are capped at ×1.5 total (M2/M3 never
--                               capped this at all).
--   minimum_total             — §16: Protect Ride has a 60 lei/ride
--                               floor on its own fare (base+distance),
--                               independent of the per-hour minimum-
--                               billing mechanism (which doesn't apply
--                               to Protect Ride's flat+per-km model).
--   agent_minimum_per_mission — §23: a 35 lei/mission floor on the
--                               AGENT'S share specifically, confirmed
--                               only for Protect Ride. Nullable and
--                               genuinely unset for Escort/Hourly — no
--                               floor is stated for them, so none is
--                               invented.
--   cancellation_fee_pct/_minimum — §22: 30% of estimate, min 30 lei,
--                               for a cancellation that breaches the
--                               free-cancel window.

alter table public.pricing_config
  add column coef_cap numeric(4, 2) not null default 1.5,
  add column minimum_total numeric(10, 2),
  add column agent_minimum_per_mission numeric(10, 2),
  add column cancellation_fee_pct numeric(4, 3) not null default 0.30,
  add column cancellation_fee_minimum numeric(10, 2) not null default 30;

comment on column public.pricing_config.minimum_total is
  'Floor on the labor/ride component (before platform fee + VAT). Confirmed for Protect Ride (60 lei) only — null elsewhere.';
comment on column public.pricing_config.agent_minimum_per_mission is
  'Floor on the agent''s computed earnings for a completed mission. Confirmed for Protect Ride (35 lei) only (v2.3 §23) — deliberately left null for Escort/Hourly since no floor is stated for them; not invented.';

-- Protect Ride: flat 30 lei + 5 lei/km, no separate hourly agent rate
-- at all (per_hour_agent/per_hour_vehicle become genuinely unused for
-- this service — the vehicle is bundled into the ride fare per §19 —
-- zeroed rather than left at their old 180/60 values, which would
-- misleadingly suggest they still apply).
update public.pricing_config pc
set
  base = 30,
  per_km = 5,
  per_hour_agent = 0,
  per_hour_vehicle = 0,
  coef_night = 1.25,
  coef_weekend = 1.15,
  coef_urgent = 1.20,
  coef_cap = 1.5,
  platform_fee = 20,
  agent_share_pct = 0.55,
  minimum_total = 60,
  agent_minimum_per_mission = 35
from public.services s
where pc.service_id = s.id and s.key = 'protect_ride';

-- Escort: 150 lei/h, min 1h (already 1h from M2). Vehicle (when
-- mobility=protego_vehicle) is a separate 50 lei/h line — NOT bundled,
-- unlike Protect Ride.
update public.pricing_config pc
set
  per_hour_agent = 150,
  per_hour_vehicle = 50,
  coef_night = 1.25,
  coef_weekend = 1.15,
  coef_urgent = 1.20,
  coef_cap = 1.5,
  platform_fee = 20,
  agent_share_pct = 0.55
from public.services s
where pc.service_id = s.id and s.key = 'escort';

-- Hourly: 130 lei/h, min 2h (already), degressive -15% beyond the 8h
-- threshold (already 8h) — degressive_rate was a genuine M2 placeholder
-- (1.0, "not confirmed anywhere") and is now confirmed at 0.85.
update public.pricing_config pc
set
  per_hour_agent = 130,
  per_hour_vehicle = 50,
  degressive_rate = 0.85,
  coef_night = 1.25,
  coef_weekend = 1.15,
  coef_urgent = 1.20,
  coef_cap = 1.5,
  platform_fee = 20,
  agent_share_pct = 0.55
from public.services s
where pc.service_id = s.id and s.key = 'hourly';

-- Real-duration capture at completion (audit §4.2: "capture reflects
-- real duration"). Set by start_mission_protection()/complete_mission()
-- respectively — see 20260731130002_compute_quote_v2_3.sql.
alter table public.missions
  add column started_at timestamptz,
  add column completed_at timestamptz;

comment on column public.missions.started_at is
  'Set when arrived->active (start_mission_protection()) — real mission start, distinct from the client''s original scheduled_at estimate.';
comment on column public.missions.completed_at is
  'Set when active->done (complete_mission()). completed_at - started_at is the REAL duration used to recompute the final capture for time-based services (Escort/Hourly). Protect Ride''s distance is not independently re-measured this milestone (no real routing/GPS-path integration yet) — disclosed simplification.';
