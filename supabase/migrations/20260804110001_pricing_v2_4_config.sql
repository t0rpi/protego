-- v2.4 pricing clarifications (founder + coordinator, 2026-08-04) --
-- master prompt update pending. All disclosed placeholders where no
-- source confirms an exact rate, same treatment as agent_share_pct/
-- default_distance_km.

-- 1. Accompany-inside restructure: flat fee now covers a fixed included
--    window (was: flat fee, no time dimension at all). Overage reuses
--    wait_per_minute_rate (founder: "same waiting rate from config"),
--    no new rate column needed. accompany_inside_hourly_threshold_minutes
--    already exists (20260803100001) -- reseeded 30 -> 45 per this
--    round's decision (was a documented-but-unenforced rule; now it
--    drives an actual client-facing suggestion, not just a comment).
alter table public.pricing_config
  add column accompany_inside_included_minutes integer not null default 15;

comment on column public.pricing_config.accompany_inside_included_minutes is
  'Protect Ride only: minutes covered by the flat accompany_inside_fee before wait_per_minute_rate overage applies.';

update public.pricing_config pc
set accompany_inside_hourly_threshold_minutes = 45
from public.services s
where s.id = pc.service_id and s.key = 'protect_ride' and pc.city = 'Oradea';

-- 2. Escort/Hourly vehicle fee km allowance + surcharge (new dimension
--    for these services -- Protect Ride's per-km pricing is unrelated
--    and untouched).
alter table public.pricing_config
  add column vehicle_included_km_per_hour numeric(6, 2),
  add column vehicle_km_surcharge_rate numeric(10, 2);

comment on column public.pricing_config.vehicle_included_km_per_hour is
  'Escort/Hourly + protego_vehicle only: km of driving included per billed hour before vehicle_km_surcharge_rate applies to the excess. Null = not applicable (Protect Ride uses per_km instead).';
comment on column public.pricing_config.vehicle_km_surcharge_rate is
  'Escort/Hourly + protego_vehicle only: per-km rate charged for driving beyond vehicle_included_km_per_hour * billed hours.';

update public.pricing_config pc
set vehicle_included_km_per_hour = 25, vehicle_km_surcharge_rate = 2
from public.services s
where s.id = pc.service_id and s.key in ('escort', 'hourly') and pc.city = 'Oradea';

-- 3. Platform fee scaling: max(platform_fee, platform_fee_per_hour *
--    billed hours) -- "unchanged up to 4h, scales beyond" (5*4=20,
--    matching the existing flat floor exactly up to 4h). Escort/Hourly
--    only -- Protect Ride has no hours dimension, stays flat.
alter table public.pricing_config
  add column platform_fee_per_hour numeric(10, 2);

comment on column public.pricing_config.platform_fee_per_hour is
  'Escort/Hourly only: platform fee is max(platform_fee, platform_fee_per_hour * billed hours), so it scales past ~4h instead of staying flat. Null = not applicable (Protect Ride stays flat at platform_fee).';

update public.pricing_config pc
set platform_fee_per_hour = 5
from public.services s
where s.id = pc.service_id and s.key in ('escort', 'hourly') and pc.city = 'Oradea';
