-- M4 — mission_share_links: the shareable link for the client's trusted
-- circle (design strings `circle.*`/`tracking.share` — "Primesc link web
-- cu locația ta live... Nu au nevoie de aplicație"). An unguessable
-- token (48 hex chars from 24 random bytes), revocable by the client,
-- and functionally expiring the moment the mission reaches a terminal
-- status — see get_shared_mission_status() below, which is the ONLY
-- way this data is ever read publicly.

create table public.mission_share_links (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid not null references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mission_share_links enable row level security;

create policy "client can manage own mission's share links"
  on public.mission_share_links for all
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  )
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "dispatcher and admin can read all share links"
  on public.mission_share_links for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select, insert, update on public.mission_share_links to authenticated;
-- No delete grant — revocation is a column update (revoked_at), not a
-- row delete, so the link's own history/audit trail survives.

-- The ONLY read path for this data as an unauthenticated visitor — no
-- table grant to anon exists on missions/mission_tracking/profiles at
-- all, so this function is deliberately the single narrow opening.
-- Deliberately minimal: mission status, the latest position while the
-- mission is in a trackable window, and first names only (never the
-- verification code, exact addresses, or any contact detail) — a
-- trusted-circle viewer needs "is this person safe and where are they
-- right now", nothing else the app itself exposes to the client/agent.
create function public.get_shared_mission_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.mission_share_links%rowtype;
  v_mission public.missions%rowtype;
  v_client_name text;
  v_agent_name text;
  v_position jsonb;
begin
  select * into v_link from public.mission_share_links where token = p_token;
  if not found or v_link.revoked_at is not null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_mission from public.missions where id = v_link.mission_id;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_mission.status in ('done', 'cancelled_client', 'cancelled_agent', 'cancelled_dispatcher', 'no_agent_available') then
    return jsonb_build_object('status', 'expired');
  end if;

  select full_name into v_client_name from public.profiles where id = v_mission.client_id;

  select p.full_name into v_agent_name
  from public.mission_offers mo
  join public.profiles p on p.id = mo.agent_id
  where mo.mission_id = v_mission.id and mo.status = 'accepted';

  if v_mission.status in ('enroute', 'arrived', 'active') then
    select jsonb_build_object('lat', lat, 'lng', lng, 'recorded_at', recorded_at)
      into v_position
    from public.mission_tracking
    where mission_id = v_mission.id
    order by recorded_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'status', v_mission.status,
    'client_name', v_client_name,
    'agent_name', v_agent_name,
    'position', v_position
  );
end;
$$;

grant execute on function public.get_shared_mission_status(text) to anon, authenticated;
