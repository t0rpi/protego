-- Founder-approved Protect Ride last-mile add-ons (2026-08-03 QA round):
-- door-to-door escort (always included, both directions), wait at
-- destination (paid per minute past a free window), accompany inside
-- the venue (flat fee). All admin-editable, same disclosed-placeholder
-- treatment as agent_share_pct/default_distance_km -- none of these
-- rates are confirmed from any pricing source, they are seeded so the
-- feature is usable today and tunable before the real pilot.
alter table public.pricing_config
  add column door_to_door_included boolean not null default false,
  add column wait_free_minutes integer not null default 5,
  add column wait_per_minute_rate numeric(10, 2),
  add column accompany_inside_fee numeric(10, 2),
  add column accompany_inside_hourly_threshold_minutes integer not null default 30;

comment on column public.pricing_config.door_to_door_included is
  'Protect Ride only: whether escorting the client to/from the door at both ends of the ride is included in the base fare (no separate charge) -- founder decision, always on for Protect Ride, admin-editable.';
comment on column public.pricing_config.wait_free_minutes is
  'Protect Ride only: minutes the agent can wait at the destination before wait_per_minute_rate starts applying.';
comment on column public.pricing_config.wait_per_minute_rate is
  'Protect Ride only: per-minute rate charged for waiting time beyond wait_free_minutes. Disclosed placeholder, not a confirmed rate from any source.';
comment on column public.pricing_config.accompany_inside_fee is
  'Protect Ride only: flat fee for the agent accompanying the client inside a venue. Disclosed placeholder, not a confirmed rate from any source.';
comment on column public.pricing_config.accompany_inside_hourly_threshold_minutes is
  'Protect Ride only: past this many minutes, accompany-inside is meant to convert to the hourly rate instead of the flat fee -- documents the rule; runtime enforcement (tracking actual accompany duration during a live mission) is not built yet, this only affects the booking-time quote today.';

update public.pricing_config pc
set
  door_to_door_included = true,
  wait_per_minute_rate = 2,
  accompany_inside_fee = 25
from public.services s
where s.id = pc.service_id and s.key = 'protect_ride' and pc.city = 'Oradea';
