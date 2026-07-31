-- M3 — mission_offers: the 45-second offer cycle
-- (docs/architecture/repository-audit.md §3.4/§6; design HANDOFF.md
-- "Oferta agent = 45s ... la expirare misiunea revine în coadă cu
-- prioritate ridicată"). A mission in 'confirmed' status with no
-- pending, unexpired offer IS the unassigned pool — no separate queue
-- table needed; the dispatcher view (M3 web) simply queries missions
-- with status='confirmed', prioritizing elevated_priority=true.
--
-- Writes go exclusively through the functions below (SECURITY DEFINER),
-- same pattern as quotes/create_quote_for_mission — no direct
-- insert/update grant for anyone, so an agent can never self-assign an
-- offer or silently mark one accepted past its expiry.

create type public.mission_offer_status as enum ('pending', 'accepted', 'declined', 'expired');

create table public.mission_offers (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  status public.mission_offer_status not null default 'pending',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 seconds'),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.missions add column elevated_priority boolean not null default false;

comment on column public.missions.elevated_priority is
  'Set whenever an offer on this mission is declined or expires without acceptance — the dispatcher queue (M3 web) sorts these first. Cleared implicitly once the mission reaches assigned (a fresh offer cycle succeeded).';

alter table public.mission_offers enable row level security;

create policy "agent can read own offers"
  on public.mission_offers for select
  to authenticated
  using (agent_id = auth.uid());

create policy "dispatcher and admin can read all offers"
  on public.mission_offers for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.mission_offers to authenticated;
-- Deliberately no insert/update/delete grant — only the functions below
-- (all SECURITY DEFINER) write this table.

-- Dispatcher/admin only (M3 web scope: "manual offer creation to a
-- chosen agent" — no auto-matching algorithm yet, that's a later
-- milestone). Blocks on: mission not in the unassigned pool, agent not
-- active/available, agent with an expired document (repository-audit.md
-- §6 — automatic, no manual override), or an offer already pending.
create function public.create_mission_offer(p_mission_id uuid, p_agent_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_agent public.agents%rowtype;
  v_offer_id uuid;
begin
  if public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only a dispatcher or admin can create a mission offer';
  end if;

  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;
  if v_mission.status <> 'confirmed' then
    raise exception 'mission % is not in the unassigned pool (status=%)', p_mission_id, v_mission.status;
  end if;

  select * into v_agent from public.agents where id = p_agent_id;
  if not found then
    raise exception 'agent % not found', p_agent_id;
  end if;
  if v_agent.status <> 'active' then
    raise exception 'agent % is not active (status=%)', p_agent_id, v_agent.status;
  end if;
  if not v_agent.is_available then
    raise exception 'agent % is not available', p_agent_id;
  end if;
  if not public.agent_has_no_expired_documents(p_agent_id) then
    raise exception 'agent % has an expired document — cannot receive offers (repository-audit.md §6)', p_agent_id;
  end if;

  if exists (
    select 1 from public.mission_offers
    where mission_id = p_mission_id and status = 'pending' and expires_at > now()
  ) then
    raise exception 'mission % already has a pending offer', p_mission_id;
  end if;

  insert into public.mission_offers (mission_id, agent_id)
  values (p_mission_id, p_agent_id)
  returning id into v_offer_id;

  return v_offer_id;
end;
$$;

grant execute on function public.create_mission_offer(uuid, uuid) to authenticated;

-- Accept: only the offered agent, only while pending and unexpired, and
-- only if their documents are still valid at the moment of acceptance
-- (defense in depth — a document could have expired in the seconds
-- since the offer was created). Supersedes any other still-pending
-- offer on the same mission (relevant if a dispatcher re-offers before
-- the first one has resolved) and moves the mission confirmed->assigned
-- — the actual transition legality (an accepted offer must exist) is
-- re-checked by enforce_mission_transition() itself, not just trusted
-- here.
create function public.accept_mission_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.mission_offers%rowtype;
begin
  select * into v_offer from public.mission_offers where id = p_offer_id;
  if not found then
    raise exception 'offer % not found', p_offer_id;
  end if;
  if v_offer.agent_id <> auth.uid() then
    raise exception 'only the offered agent can accept this offer';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'offer % is no longer pending (status=%)', p_offer_id, v_offer.status;
  end if;
  if now() > v_offer.expires_at then
    raise exception 'offer % has expired', p_offer_id;
  end if;
  if not public.agent_has_no_expired_documents(v_offer.agent_id) then
    raise exception 'agent has an expired document — cannot accept missions (repository-audit.md §6)';
  end if;

  update public.mission_offers set status = 'accepted', responded_at = now() where id = p_offer_id;

  update public.mission_offers
  set status = 'declined', responded_at = now()
  where mission_id = v_offer.mission_id and id <> p_offer_id and status = 'pending';

  update public.missions set status = 'assigned' where id = v_offer.mission_id;
end;
$$;

grant execute on function public.accept_mission_offer(uuid) to authenticated;

-- Decline: agent's own choice, no penalty (agentApp.declined) but the
-- mission is flagged elevated_priority for whoever re-offers it next.
create function public.decline_mission_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.mission_offers%rowtype;
begin
  select * into v_offer from public.mission_offers where id = p_offer_id;
  if not found then
    raise exception 'offer % not found', p_offer_id;
  end if;
  if v_offer.agent_id <> auth.uid() then
    raise exception 'only the offered agent can decline this offer';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'offer % is no longer pending (status=%)', p_offer_id, v_offer.status;
  end if;

  update public.mission_offers set status = 'declined', responded_at = now() where id = p_offer_id;
  update public.missions set elevated_priority = true where id = v_offer.mission_id;
end;
$$;

grant execute on function public.decline_mission_offer(uuid) to authenticated;

-- Expire: no server-side scheduler yet (M3 has no realtime/cron
-- infrastructure — that lands with M4). The agent's own app calls this
-- when its local 45s countdown reaches zero; a dispatcher/admin can also
-- call it (e.g. the app was closed before the timer fired). Idempotent:
-- calling it on an already-resolved offer is a silent no-op rather than
-- an error, so a race between the agent's timer and an accept/decline
-- that just landed doesn't surface a confusing exception.
create function public.expire_mission_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.mission_offers%rowtype;
begin
  select * into v_offer from public.mission_offers where id = p_offer_id;
  if not found then
    raise exception 'offer % not found', p_offer_id;
  end if;
  if v_offer.agent_id <> auth.uid() and public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only the offered agent or a dispatcher/admin can expire this offer';
  end if;
  if v_offer.status <> 'pending' then
    return;
  end if;
  if now() <= v_offer.expires_at then
    raise exception 'offer % has not expired yet', p_offer_id;
  end if;

  update public.mission_offers set status = 'expired', responded_at = now() where id = p_offer_id;
  update public.missions set elevated_priority = true where id = v_offer.mission_id;
end;
$$;

grant execute on function public.expire_mission_offer(uuid) to authenticated;

-- agent_mission_briefs: the address-masking view (repository-audit.md
-- §6 — "exact-address field revealed to the agent ONLY after
-- acceptance — enforce via RLS/column restriction, not UI"). Plain RLS
-- can restrict ROWS, not conditionally null a COLUMN based on a
-- sibling table's status, so this view is the mechanism instead:
-- created WITHOUT security_invoker (the pre-PG15 default, kept
-- explicit here for clarity), it runs with the view owner's privileges
-- and therefore does not re-apply missions/profiles RLS at all — the
-- WHERE clause below is the ENTIRE access control for this view, not a
-- supplement to table RLS. An agent only ever gets rows for their own
-- offers; within those rows, pickup/destination address, the
-- verification code and the client's name are masked to null unless
-- that specific offer has been accepted. Dispatcher/admin see
-- everything unmasked, matching their existing full-visibility policies
-- on the underlying tables.
create view public.agent_mission_briefs
with (security_invoker = false)
as
select
  mo.id as offer_id,
  mo.mission_id,
  mo.agent_id,
  mo.status as offer_status,
  mo.offered_at,
  mo.expires_at as offer_expires_at,
  mo.responded_at,
  s.key as service_key,
  m.city,
  m.mobility,
  m.dress_code,
  m.agent_count,
  m.duration_hours,
  m.distance_km,
  m.scheduled_at,
  m.status as mission_status,
  m.context_kind,
  case when mo.status = 'accepted' then m.pickup_address else null end as pickup_address,
  case when mo.status = 'accepted' then m.destination_address else null end as destination_address,
  case when mo.status = 'accepted' then m.verification_code else null end as verification_code,
  case when mo.status = 'accepted' then m.context_details else null end as context_details,
  case when mo.status = 'accepted' then p.full_name else null end as client_full_name
from public.mission_offers mo
join public.missions m on m.id = mo.mission_id
join public.services s on s.id = m.service_id
join public.profiles p on p.id = m.client_id
where mo.agent_id = auth.uid() or public.current_user_role() in ('dispatcher', 'admin');

grant select on public.agent_mission_briefs to authenticated;
