begin;

select plan(10);

-- v2.4 founder + coordinator pricing clarifications (2026-08-04):
-- 1. Accompany-inside: flat fee covers the first
--    accompany_inside_included_minutes (15), then wait_per_minute_rate
--    (2) per minute beyond that. accompany_inside_hourly_threshold_minutes
--    (45) is a client-facing suggestion only -- not asserted here, since
--    it never enters this computation.
-- 2. Escort/Hourly protego_vehicle: vehicle_included_km_per_hour (25/h)
--    of driving included per billed hour, then vehicle_km_surcharge_rate
--    (2/km) beyond that -- own line, vehicle revenue stays out of
--    labor_component (v2.3 §19/23).
-- 3. Escort/Hourly platform fee is max(platform_fee, platform_fee_per_hour
--    * billed hours) -- flat up to ~4h (5*4=20 matches the floor exactly),
--    scales beyond. Protect Ride has no hours dimension and stays flat.

-- (1) Accompany within the included 15 minutes: flat 25 lei, no overage.
-- base 30 + 15km*5=75 distance + 25 accompany = 130 labor, +20 platform,
-- +21% VAT = 181.50.
select is(
  (select (public.compute_quote('protect_ride', 'Oradea', 1, 0, 15, 'protego_vehicle', false, false, false, 0, 10) ->> 'total')::numeric),
  181.50,
  'accompany-inside at 10 min (within the 15 included) charges only the flat 25 lei fee'
);

select is(
  (
    select (line ->> 'amount')::numeric
    from jsonb_array_elements(
      public.compute_quote('protect_ride', 'Oradea', 1, 0, 15, 'protego_vehicle', false, false, false, 0, 10) -> 'lines'
    ) as line
    where line ->> 'label' = 'accompany_inside'
  ),
  25.00,
  'accompany_inside line at 10 min is exactly the flat fee, no per-minute overage'
);

-- (1) Accompany past the included minutes: 25 + (45-15)*2 = 85 overage.
-- base 30 + 75 distance + 85 accompany = 190 labor, +20 platform,
-- +21% VAT = 254.10.
select is(
  (select (public.compute_quote('protect_ride', 'Oradea', 1, 0, 15, 'protego_vehicle', false, false, false, 0, 45) ->> 'total')::numeric),
  254.10,
  'accompany-inside at 45 min bills the flat fee plus per-minute overage past the included 15'
);

select is(
  (
    select (line ->> 'amount')::numeric
    from jsonb_array_elements(
      public.compute_quote('protect_ride', 'Oradea', 1, 0, 15, 'protego_vehicle', false, false, false, 0, 45) -> 'lines'
    ) as line
    where line ->> 'label' = 'accompany_inside'
  ),
  85.00,
  'accompany_inside line at 45 min = 25 flat + 30 extra min * 2 lei/min = 85'
);

-- (2) Vehicle km surcharge: 2h billed, 25km/h included = 50km allowance.
-- 80km requested: labor 260 (agent only) + vehicle (100 + (80-50)*2=60
-- surcharge = 160) + 20 platform, +21% VAT = 532.40.
select is(
  (select (public.compute_quote('hourly', 'Oradea', 1, 2, 80, 'protego_vehicle', false, false, false) ->> 'total')::numeric),
  532.40,
  'Hourly protego_vehicle at 80km (50km included) bills a 60 lei km surcharge on top'
);

select is(
  (
    select (line ->> 'amount')::numeric
    from jsonb_array_elements(
      public.compute_quote('hourly', 'Oradea', 1, 2, 80, 'protego_vehicle', false, false, false) -> 'lines'
    ) as line
    where line ->> 'label' = 'vehicle_km_surcharge'
  ),
  60.00,
  'vehicle_km_surcharge line is (80 - 50 included) * 2 lei/km = 60'
);

select is(
  (select (public.compute_quote('hourly', 'Oradea', 1, 2, 80, 'protego_vehicle', false, false, false) ->> 'labor_component')::numeric),
  260.00,
  'labor_component excludes the vehicle line and its km surcharge (vehicle revenue is the company''s, v2.3 §19/23)'
);

-- (2) Exactly at the included-km boundary (50km on 2h): no surcharge line.
select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      public.compute_quote('hourly', 'Oradea', 1, 2, 50, 'protego_vehicle', false, false, false) -> 'lines'
    ) as line
    where line ->> 'label' = 'vehicle_km_surcharge'
  ),
  0,
  'km exactly at the included allowance (50km on 2h) does not trigger a surcharge line'
);

-- (3) Platform fee stays at the flat floor up to ~4h (5*4=20).
-- hours=2, on_foot: labor 130*2=260, +20 platform (max(20, 5*2=10)),
-- +21% VAT = 338.80.
select is(
  (select (public.compute_quote('hourly', 'Oradea', 1, 2, null, 'on_foot', false, false, false) ->> 'total')::numeric),
  338.80,
  'platform fee at 2h stays at the flat 20 lei floor (5*2=10 < 20)'
);

-- (3) Platform fee scales past the floor: hours=6, on_foot: labor
-- 130*6=780, +30 platform (max(20, 5*6=30)), +21% VAT = 980.10.
select is(
  (select (public.compute_quote('hourly', 'Oradea', 1, 6, null, 'on_foot', false, false, false) ->> 'total')::numeric),
  980.10,
  'platform fee at 6h scales to 5*6=30, past the 20 lei flat floor'
);

select * from finish();

rollback;
