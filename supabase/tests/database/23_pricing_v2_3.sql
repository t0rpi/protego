begin;

select plan(15);

-- Protect Ride: flat base + per-km, vehicle bundled in, no agent/vehicle
-- lines at all (v2.3 §16/§19).
select is(
  (select (public.compute_quote('protect_ride', 'Oradea', 1, 0, 15, 'protego_vehicle', false, false, false) ->> 'total')::numeric),
  151.25,
  'Protect Ride: base 30 + 15km*5 = 105 labor, +20 platform, +21% VAT = 151.25'
);

select is(
  (select (public.compute_quote('protect_ride', 'Oradea', 1, 0, 15, 'protego_vehicle', false, false, false) ->> 'labor_component')::numeric),
  105.00,
  'Protect Ride labor_component excludes platform_fee and VAT'
);

-- v2.4 (20260803100003_compute_quote_last_mile.sql) added an
-- unconditional 'door_to_door_included' (amount 0) line for Protect
-- Ride, driven by pricing_config.door_to_door_included — not by any of
-- this call's boolean args. This test's expected array pre-dates that
-- migration; updated to match, since the missing line was never an
-- "agent"/"vehicle" line in the first place (this assertion's actual
-- intent, per its own description, still holds).
select is(
  (
    select array_agg(line ->> 'label' order by line ->> 'label')
    from jsonb_array_elements(
      public.compute_quote('protect_ride', 'Oradea', 1, 0, 15, 'protego_vehicle', false, false, false) -> 'lines'
    ) as line
  ),
  array['base', 'distance', 'door_to_door_included', 'platform_fee', 'vat'],
  'Protect Ride never gets an "agent" or "vehicle" line — labor is base+distance only, vehicle is bundled'
);

-- Protect Ride minimum_total floor (60 lei, v2.3 §16) on a short ride
select is(
  (select (public.compute_quote('protect_ride', 'Oradea', 1, 0, 2, 'protego_vehicle', false, false, false) ->> 'labor_component')::numeric),
  60.00,
  'a short ride (base 30 + 2km*5 = 40) is floored at the 60 lei minimum'
);

-- M7 QA fix: blank km (client can't know the route distance) falls back
-- to pricing_config.default_distance_km (seeded 8 for Oradea protect_ride,
-- 20260731160002) instead of silently charging base-fare-only.
select is(
  (select (public.compute_quote('protect_ride', 'Oradea', 1, 0, null, 'protego_vehicle', false, false, false) ->> 'total')::numeric),
  108.90,
  'blank km falls back to default_distance_km=8: base 30 + 8km*5=40 labor, +20 platform, +21% VAT = 108.90'
);

select is(
  (
    select line ->> 'label'
    from jsonb_array_elements(
      public.compute_quote('protect_ride', 'Oradea', 1, 0, null, 'protego_vehicle', false, false, false) -> 'lines'
    ) as line
    where line ->> 'label' in ('distance', 'distance_estimated')
  ),
  'distance_estimated',
  'the fallback distance line is flagged "distance_estimated", never presented as a measured "distance"'
);

-- Escort/Hourly: hourly agent rate + separate vehicle line
select is(
  (select (public.compute_quote('hourly', 'Oradea', 1, 2, null, 'protego_vehicle', false, false, false) ->> 'total')::numeric),
  459.80,
  'Hourly: 130*2 agent + 50*2 vehicle + 20 platform, +21% VAT = 459.80'
);

select is(
  (select (public.compute_quote('escort', 'Oradea', 1, 0.25, null, 'on_foot', false, false, false) ->> 'labor_component')::numeric),
  150.00,
  'Escort''s 1h minimum billing applies even for a 0.25h request'
);

select is(
  (select (public.compute_quote('hourly', 'Oradea', 1, 10, null, 'on_foot', false, false, false) ->> 'labor_component')::numeric),
  1261.00,
  'Hourly degressive rate (0.85, v2.3 §18): 130 * (8 + 2*0.85) = 1261'
);

-- Coefficient cap (v2.3 §21): raw 1.25*1.15*1.20=1.725, capped at 1.5.
-- 2h (= Hourly's own min_billing_hours floor, so the minimum-billing
-- rule doesn't also kick in and confound the expected value): 130*2=260
-- labor at coef 1.0, *1.5 capped coefficient = 390.
select is(
  (select (public.compute_quote('hourly', 'Oradea', 1, 2, null, 'on_foot', true, true, true) ->> 'labor_component')::numeric),
  390.00,
  'combined night+weekend+urgent coefficient is capped at 1.5, not the raw 1.725 product'
);

-- Overage: incremental labor only, no platform fee/vehicle line
select is(
  (select (public.compute_overage_quote('hourly', 'Oradea', 1, 2, false, false, false) ->> 'total')::numeric),
  314.60,
  'overage bills only incremental agent time + VAT: 130*2=260, +21% VAT = 314.60'
);

-- M6 housekeeping: is_weekend_pricing_window() (v2.3 Sec21: Fri 20:00 ->
-- Sun 24:00, not just Sat/Sun as create_quote_for_mission()/
-- request_mission_overage() originally computed it in M5).
-- is_weekend_pricing_window() reads extract(isodow/hour from ...) in
-- the SESSION's timezone (UTC on this DB) — using a +00 offset here so
-- the literal's stated hour and the function's extracted hour always
-- agree, regardless of what timezone a future session default becomes.
select ok(
  not public.is_weekend_pricing_window('2026-08-07 19:59:00+00'::timestamptz),
  'Friday before 20:00 is not yet the weekend window'
);

select ok(
  public.is_weekend_pricing_window('2026-08-07 20:00:00+00'::timestamptz),
  'Friday at/after 20:00 enters the weekend window'
);

select ok(
  public.is_weekend_pricing_window('2026-08-08 03:00:00+00'::timestamptz)
  and public.is_weekend_pricing_window('2026-08-09 23:59:00+00'::timestamptz),
  'Saturday and Sunday are weekend all day'
);

select ok(
  not public.is_weekend_pricing_window('2026-08-10 00:00:00+00'::timestamptz),
  'the window ends at Sunday 24:00 (Monday 00:00) — Monday itself is not weekend'
);

select * from finish();

rollback;
