-- M4 — mission_tracking: the DOWNSAMPLED, persisted half of live location
-- (repository-audit.md §5.1). High-frequency position pings (3-5s) are
-- meant to travel over Realtime Broadcast, not a DB write per ping —
-- this table exists for the audit/report trail and RLS-testable access
-- control, written at a much coarser cadence (15-30s, per the audit)
-- from the SAME agent-side call that also broadcasts.
--
-- RLS is the literal acceptance-tests.md M4 requirement: "locația e
-- vizibilă exclusiv clientului asociat, exclusiv în timpul misiunii
-- active" — outside the enroute/arrived/active window, access is
-- denied entirely, not just stale.

create table public.mission_tracking (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  recorded_at timestamptz not null default now()
);

create index mission_tracking_mission_id_recorded_at_idx
  on public.mission_tracking (mission_id, recorded_at desc);

alter table public.mission_tracking enable row level security;

-- Client visibility is gated on mission window, re-checked on every
-- query (not just at insert time) — a mission that has since finished
-- or been cancelled stops being visible even for its own client,
-- matching "exclusiv în timpul misiunii active" literally.
create policy "client can read own active mission's tracking"
  on public.mission_tracking for select
  to authenticated
  using (
    exists (
      select 1 from public.missions m
      where m.id = mission_tracking.mission_id
        and m.client_id = auth.uid()
        and m.status in ('enroute', 'arrived', 'active')
    )
  );

create policy "dispatcher and admin can read all tracking"
  on public.mission_tracking for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.mission_tracking to authenticated;
-- No insert/update/delete grant — only record_mission_location() writes
-- this table (SECURITY DEFINER), so the window/identity checks below
-- can't be bypassed by a raw client-side insert.

-- Called by the assigned agent's device on the same cadence it
-- broadcasts over Realtime — this is the "persist a downsampled point"
-- half only, not the broadcast itself (that's a client-side Realtime
-- channel send, no DB round-trip needed for it).
create function public.record_mission_location(p_mission_id uuid, p_lat numeric, p_lng numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;

  if v_mission.status not in ('enroute', 'arrived', 'active') then
    raise exception 'mission % is not in an active tracking window (status=%)', p_mission_id, v_mission.status;
  end if;

  if not exists (
    select 1 from public.mission_offers mo
    where mo.mission_id = p_mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
  ) then
    raise exception 'only the assigned agent can record a location for this mission';
  end if;

  insert into public.mission_tracking (mission_id, agent_id, lat, lng)
  values (p_mission_id, auth.uid(), p_lat, p_lng);
end;
$$;

grant execute on function public.record_mission_location(uuid, numeric, numeric) to authenticated;

-- Latest position per mission — what the client/dispatcher map actually
-- reads, rather than scanning the whole trail.
create view public.mission_latest_location
with (security_invoker = true)
as
select distinct on (mission_id)
  mission_id, agent_id, lat, lng, recorded_at
from public.mission_tracking
order by mission_id, recorded_at desc;

comment on view public.mission_latest_location is
  'security_invoker=true — plain per-row filtering of mission_tracking is exactly what its own RLS already provides, no masking logic needed on top (unlike agent_mission_briefs in M3).';

grant select on public.mission_latest_location to authenticated;
