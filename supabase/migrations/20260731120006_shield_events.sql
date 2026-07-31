-- M4 — SOS (repository-audit.md §5.2, dispatcher-playbook.md §3).
--
-- NAMING NOTE (disclosed deviation from this milestone's literal
-- prompt): the prompt asks for a table named "sos_alerts". Every
-- existing project document (data-model.md §1, repository-audit.md
-- §3.5/§5.2, dispatcher-playbook.md) already names this exact concept
-- `shield_events` — a single table unifying SOS/WWM-expired/circle-
-- share/fake-call, sourced from either a paid mission (active from
-- M4) or the free Shield tier (schema-ready now, functionally gated
-- until M6 per the roadmap's explicit succession rule). Naming it
-- `sos_alerts` instead would silently fork the schema from every other
-- doc that already refers to `shield_events`. Kept the established
-- name; the `source`/`event_type` columns below give exactly the
-- "paid mission or future shield" distinction the prompt asked for.
--
-- SOS stays an OVERLAY, never a mission_status value (repository-
-- audit.md §3.5) — missions.status is untouched by anything in this file.

create type public.shield_event_source as enum ('mission', 'shield');
create type public.shield_event_type as enum ('sos', 'wwm_expired', 'circle_share', 'fake_call');
create type public.shield_event_status as enum ('open', 'acknowledged', 'resolved', 'cancelled_false_alarm');

create table public.shield_events (
  id uuid primary key default gen_random_uuid(),
  source public.shield_event_source not null,
  event_type public.shield_event_type not null default 'sos',
  triggered_by uuid not null references public.profiles (id),
  mission_id uuid references public.missions (id),
  status public.shield_event_status not null default 'open',
  lat numeric(9, 6),
  lng numeric(9, 6),
  -- dispatcher-playbook.md §3's 4-step script (dispatcher.p1-p4): must
  -- all be true before resolve_sos() will allow closing the alert.
  protocol_steps jsonb not null default '{"p1": false, "p2": false, "p3": false, "p4": false}'::jsonb,
  journal text,
  acknowledged_by uuid references public.profiles (id),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (source <> 'mission' or mission_id is not null)
);

create index shield_events_status_idx on public.shield_events (status) where status in ('open', 'acknowledged');

alter table public.shield_events enable row level security;

create policy "triggering user can read own event"
  on public.shield_events for select
  to authenticated
  using (triggered_by = auth.uid());

create policy "dispatcher and admin can read all events"
  on public.shield_events for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.shield_events to authenticated;
-- No direct write grant for anyone — every write goes through
-- trigger_sos()/acknowledge_sos()/update_sos_protocol_step()/
-- resolve_sos()/cancel_sos() below, all SECURITY DEFINER, so the
-- resolve-gate (protocol complete + journal written) can never be
-- bypassed by a raw UPDATE the way a plain grant would allow.

alter table public.call_intents
  add constraint call_intents_shield_event_id_fkey
  foreign key (shield_event_id) references public.shield_events (id) on delete set null;

-- M4 scope: only source='mission' is actually reachable — the client
-- SOS button (active-mission screen, hold-3s) and the agent emergency
-- button. A client may only trigger from their own ACTIVE mission; an
-- agent from any mission stage they are currently engaged in
-- (assigned/enroute/arrived/active) — danger isn't confined to the
-- "active" window for whoever is physically present before it starts.
create function public.trigger_sos(p_mission_id uuid, p_lat numeric default null, p_lng numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_is_client boolean;
  v_is_agent boolean;
  v_event_id uuid;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;

  v_is_client := (v_mission.client_id = auth.uid() and v_mission.status = 'active');
  v_is_agent := exists (
    select 1 from public.mission_offers mo
    where mo.mission_id = p_mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    and v_mission.status in ('assigned', 'enroute', 'arrived', 'active')
  );

  if not v_is_client and not v_is_agent then
    raise exception 'SOS can only be triggered by the client of an active mission, or its currently assigned agent';
  end if;

  insert into public.shield_events (source, event_type, triggered_by, mission_id, lat, lng)
  values ('mission', 'sos', auth.uid(), p_mission_id, p_lat, p_lng)
  returning id into v_event_id;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'sos_triggered', 'shield_events', v_event_id,
    jsonb_build_object('mission_id', p_mission_id)
  );

  return v_event_id;
end;
$$;

grant execute on function public.trigger_sos(uuid, numeric, numeric) to authenticated;

create function public.acknowledge_sos(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.shield_events%rowtype;
begin
  if public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only a dispatcher or admin can acknowledge an SOS event';
  end if;

  select * into v_event from public.shield_events where id = p_event_id;
  if not found then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_event.status <> 'open' then
    raise exception 'event % is not open (status=%)', p_event_id, v_event.status;
  end if;

  update public.shield_events
  set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now()
  where id = p_event_id;

  perform public.notify_event(v_event.triggered_by, 'sos_acknowledged', v_event.mission_id);

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'sos_acknowledged', 'shield_events', p_event_id, null
  );
end;
$$;

grant execute on function public.acknowledge_sos(uuid) to authenticated;

create function public.update_sos_protocol_step(p_event_id uuid, p_step text, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only a dispatcher or admin can update the SOS protocol checklist';
  end if;
  if p_step not in ('p1', 'p2', 'p3', 'p4') then
    raise exception 'unknown protocol step %', p_step;
  end if;

  update public.shield_events
  set protocol_steps = jsonb_set(protocol_steps, array[p_step], to_jsonb(p_value))
  where id = p_event_id and status in ('open', 'acknowledged');

  if not found then
    raise exception 'event % not found or not open/acknowledged', p_event_id;
  end if;
end;
$$;

grant execute on function public.update_sos_protocol_step(uuid, text, boolean) to authenticated;

-- The resolve-gate itself: design copy dispatcher.resolveGate —
-- "Butonul se activează doar cu toți pașii bifați + jurnal completat.
-- Nimic nu se închide nejurnalizat." Enforced here, not just in the UI.
create function public.resolve_sos(p_event_id uuid, p_journal text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.shield_events%rowtype;
begin
  if public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only a dispatcher or admin can resolve an SOS event';
  end if;

  select * into v_event from public.shield_events where id = p_event_id;
  if not found then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_event.status <> 'acknowledged' then
    raise exception 'event % must be acknowledged before it can be resolved (status=%)', p_event_id, v_event.status;
  end if;
  if p_journal is null or length(trim(p_journal)) = 0 then
    raise exception 'a journal entry is required before resolving an SOS event';
  end if;
  if not (
    coalesce((v_event.protocol_steps ->> 'p1')::boolean, false)
    and coalesce((v_event.protocol_steps ->> 'p2')::boolean, false)
    and coalesce((v_event.protocol_steps ->> 'p3')::boolean, false)
    and coalesce((v_event.protocol_steps ->> 'p4')::boolean, false)
  ) then
    raise exception 'all 4 protocol steps must be checked before resolving';
  end if;

  update public.shield_events
  set status = 'resolved', journal = p_journal, resolved_at = now()
  where id = p_event_id;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'sos_resolved', 'shield_events', p_event_id,
    jsonb_build_object('journal', p_journal)
  );
end;
$$;

grant execute on function public.resolve_sos(uuid, text) to authenticated;

-- Client/agent-initiated false-alarm cancellation (design sos.cancelFalse
-- / sos.cancelled — the dispatcher still confirms by phone afterward,
-- which is exactly why cancellation doesn't itself require the
-- protocol/journal gate; that gate is specifically about the
-- dispatcher's own closing action).
create function public.cancel_sos(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.shield_events%rowtype;
begin
  select * into v_event from public.shield_events where id = p_event_id;
  if not found then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_event.triggered_by <> auth.uid() then
    raise exception 'only the person who triggered the SOS can cancel it as a false alarm';
  end if;
  if v_event.status not in ('open', 'acknowledged') then
    raise exception 'event % can no longer be cancelled (status=%)', p_event_id, v_event.status;
  end if;

  update public.shield_events set status = 'cancelled_false_alarm' where id = p_event_id;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'sos_cancelled_false_alarm', 'shield_events', p_event_id, null
  );
end;
$$;

grant execute on function public.cancel_sos(uuid) to authenticated;
