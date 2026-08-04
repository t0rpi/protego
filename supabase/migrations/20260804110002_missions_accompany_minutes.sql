-- Accompany-inside is now duration-based (v2.4), same shape as
-- wait_at_destination_minutes: a nullable minutes value doubles as the
-- opt-in flag (null/0 = not requested), no separate boolean needed --
-- drops the now-redundant accompany_inside_requested boolean from
-- 20260803100002. No production data depends on preserving it (pilot
-- not live yet).
alter table public.missions
  drop column accompany_inside_requested,
  add column accompany_inside_minutes integer;

comment on column public.missions.accompany_inside_minutes is
  'Protect Ride only: client-requested estimated duration for the agent to accompany them inside a venue, in minutes. Null = not selected. Billed as pricing_config.accompany_inside_fee for the first accompany_inside_included_minutes, then wait_per_minute_rate per minute beyond that.';

grant update (accompany_inside_minutes) on public.missions to authenticated;
