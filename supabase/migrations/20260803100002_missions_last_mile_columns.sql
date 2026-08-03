-- Founder-approved Protect Ride last-mile add-ons: per-mission client
-- selections. door-to-door has no column here -- it's not a per-mission
-- choice, it's always-on per pricing_config.door_to_door_included.
alter table public.missions
  add column wait_at_destination_minutes integer,
  add column accompany_inside_requested boolean not null default false;

comment on column public.missions.wait_at_destination_minutes is
  'Protect Ride only: client-requested estimated wait time at the destination, null = not selected. Used to compute the wait_at_destination quote line (pricing_config.wait_free_minutes/wait_per_minute_rate).';
comment on column public.missions.accompany_inside_requested is
  'Protect Ride only: client opted in to the agent accompanying them inside the venue (pricing_config.accompany_inside_fee).';

grant update (wait_at_destination_minutes, accompany_inside_requested) on public.missions to authenticated;
