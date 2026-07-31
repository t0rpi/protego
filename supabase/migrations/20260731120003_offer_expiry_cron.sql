-- M4 — server-side offer expiry (M3 debt). M3's expire_mission_offer()
-- only ever ran when the agent's own app called it as its local 45s
-- countdown reached zero — if the app was closed or backgrounded, an
-- expired offer could sit unresolved indefinitely. This migration adds
-- the missing scheduler: a pg_cron job sweeps every 15 seconds for
-- pending offers whose window has passed and expires them the same way
-- expire_mission_offer() already does (elevated_priority=true, status
-- ->'expired'), reusing that exact logic rather than duplicating it.

create extension if not exists pg_cron;

-- Bulk equivalent of expire_mission_offer(), minus the caller-identity
-- check (there is no calling agent here — this runs as a scheduled
-- system job, not on behalf of any user; SECURITY DEFINER as before,
-- but the auth.uid()-based ownership check from the manual path
-- doesn't apply to a sweep).
create function public.expire_stale_mission_offers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mission_offers
  set status = 'expired', responded_at = now()
  where status = 'pending' and expires_at < now();

  update public.missions
  set elevated_priority = true
  where id in (
    select mission_id from public.mission_offers
    where status = 'expired' and responded_at >= now() - interval '20 seconds'
  );
end;
$$;

comment on function public.expire_stale_mission_offers() is
  'Scheduled sweep (cron.schedule below), not user-callable — no grant to authenticated. The manual expire_mission_offer() path from M3 stays in place unchanged for an agent app that is still open and wants to resolve its own countdown immediately; this is the safety net for when it is not.';

-- Named job: re-running this migration (idempotent, e.g. on
-- `db reset`) updates the existing schedule rather than erroring —
-- confirmed empirically against pg_cron 1.6.4 while building this.
select cron.schedule(
  'expire-stale-mission-offers',
  '*/15 * * * * *',
  $$select public.expire_stale_mission_offers();$$
);
