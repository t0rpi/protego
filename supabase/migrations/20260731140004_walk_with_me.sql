-- M6 — Walk With Me (design `wwm.*`: destination + estimated duration
-- timer; check-in confirms arrival; on expiry without check-in ->
-- notify the trusted circle -> if still unacknowledged after a
-- configurable grace period -> escalate to dispatcher as a
-- shield_event). Server-side expiry via pg_cron, same pattern as M4's
-- offer-expiry sweep (20260731120003_offer_expiry_cron.sql) — never
-- client-timer-dependent, so a backgrounded/closed app can't silently
-- swallow an overdue check-in.

-- A dedicated notification_event value rather than reusing an existing
-- one — "your circle contact's Walk With Me check-in is overdue" is a
-- distinct event from anything M4 defined. Safe to add and reference
-- later in this same migration: the label is only ever embedded as
-- text inside a plpgsql function body below, never evaluated as an
-- enum literal until that function actually runs (well after this
-- migration's transaction commits).
alter type public.notification_event add value 'wwm_check_in_overdue';

create table public.walk_with_me_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  destination_text text not null check (length(trim(destination_text)) > 0),
  destination_lat numeric(9, 6),
  destination_lng numeric(9, 6),
  estimated_minutes integer not null check (estimated_minutes > 0),
  -- Snapshotted at session start (same reasoning as quotes snapshotting
  -- pricing_config at booking time) — a later admin change to the
  -- platform default must not retroactively change the grace window of
  -- a walk already in progress.
  grace_minutes integer not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  notified_at timestamptz,
  checked_in_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'checked_in', 'expired_notified', 'escalated', 'cancelled')),
  shield_event_id uuid references public.shield_events (id),
  created_at timestamptz not null default now()
);

create index walk_with_me_sessions_sweep_idx on public.walk_with_me_sessions (status, expires_at)
  where status in ('active', 'expired_notified');

alter table public.walk_with_me_sessions enable row level security;

create policy "owner can read own walk with me sessions"
  on public.walk_with_me_sessions for select
  to authenticated
  using (user_id = auth.uid());

create policy "dispatcher and admin can read escalated sessions"
  on public.walk_with_me_sessions for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin') and status = 'escalated');

grant select on public.walk_with_me_sessions to authenticated;
-- No direct write grant — every write goes through the SECURITY
-- DEFINER functions below (start/check-in/extend/cancel, plus the cron
-- sweep), same reasoning as shield_events itself.

create function public.start_walk_with_me(
  p_destination_text text,
  p_estimated_minutes integer,
  p_destination_lat numeric default null,
  p_destination_lng numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grace_minutes integer;
  v_session_id uuid;
begin
  if not public.is_shield_public_enabled() then
    raise exception 'Shield is not yet publicly activated (M6 gate)';
  end if;
  if p_estimated_minutes is null or p_estimated_minutes <= 0 then
    raise exception 'estimated_minutes must be positive';
  end if;

  select coalesce((value #>> '{}')::integer, 10) into v_grace_minutes
  from public.platform_settings where key = 'wwm_grace_minutes';

  insert into public.walk_with_me_sessions (
    user_id, destination_text, destination_lat, destination_lng,
    estimated_minutes, grace_minutes, expires_at
  )
  values (
    auth.uid(), p_destination_text, p_destination_lat, p_destination_lng,
    p_estimated_minutes, coalesce(v_grace_minutes, 10), now() + (p_estimated_minutes || ' minutes')::interval
  )
  returning id into v_session_id;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'wwm_started', 'walk_with_me_sessions', v_session_id,
    jsonb_build_object('estimated_minutes', p_estimated_minutes)
  );

  return v_session_id;
end;
$$;

grant execute on function public.start_walk_with_me(text, integer, numeric, numeric) to authenticated;

-- Design `wwm.arrived` / `wwm.arrivedToast`.
create function public.check_in_walk_with_me(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.walk_with_me_sessions%rowtype;
begin
  select * into v_session from public.walk_with_me_sessions where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;
  if v_session.user_id <> auth.uid() then
    raise exception 'only the walker can check in to their own session';
  end if;
  if v_session.status not in ('active', 'expired_notified') then
    raise exception 'session % can no longer be checked into (status=%)', p_session_id, v_session.status;
  end if;

  update public.walk_with_me_sessions
  set status = 'checked_in', checked_in_at = now()
  where id = p_session_id;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'wwm_checked_in', 'walk_with_me_sessions', p_session_id, null
  );
end;
$$;

grant execute on function public.check_in_walk_with_me(uuid) to authenticated;

-- Design `wwm.extend` ("+10 minute").
create function public.extend_walk_with_me(p_session_id uuid, p_extra_minutes integer default 10)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.walk_with_me_sessions%rowtype;
begin
  select * into v_session from public.walk_with_me_sessions where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;
  if v_session.user_id <> auth.uid() then
    raise exception 'only the walker can extend their own session';
  end if;
  if v_session.status <> 'active' then
    raise exception 'session % can no longer be extended (status=%)', p_session_id, v_session.status;
  end if;
  if p_extra_minutes is null or p_extra_minutes <= 0 then
    raise exception 'extra minutes must be positive';
  end if;

  update public.walk_with_me_sessions
  set expires_at = expires_at + (p_extra_minutes || ' minutes')::interval
  where id = p_session_id;
end;
$$;

grant execute on function public.extend_walk_with_me(uuid, integer) to authenticated;

create function public.cancel_walk_with_me(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.walk_with_me_sessions%rowtype;
begin
  select * into v_session from public.walk_with_me_sessions where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;
  if v_session.user_id <> auth.uid() then
    raise exception 'only the walker can cancel their own session';
  end if;
  if v_session.status not in ('active', 'expired_notified') then
    raise exception 'session % can no longer be cancelled (status=%)', p_session_id, v_session.status;
  end if;

  update public.walk_with_me_sessions set status = 'cancelled' where id = p_session_id;
end;
$$;

grant execute on function public.cancel_walk_with_me(uuid) to authenticated;

-- Two-phase sweep, mirroring expire_stale_mission_offers()'s pattern
-- exactly. Phase 1 (active, past expires_at, no check-in): notify the
-- trusted circle. There is no SMS/push infrastructure for phone-only
-- contacts yet (real SMS is explicitly M7 scope) — this is recorded as
-- an honest stub in audit_log (same "logged, not necessarily delivered"
-- treatment M4's notify_event() already gives a failed pg_net call),
-- listing exactly which contacts would have been reached, rather than
-- silently pretending a notification went out. A circle contact who is
-- also a PROTEGO user (app_user_id set) gets a real push via
-- notify_event(). Phase 2 (still not checked in after grace_minutes
-- past the notify point): escalate to dispatcher as a shield_event.
create function public.expire_stale_walk_with_me_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_app_contact record;
  v_phone_contacts jsonb;
  v_event_id uuid;
begin
  for v_session in
    select * from public.walk_with_me_sessions
    where status = 'active' and expires_at < now()
  loop
    for v_app_contact in
      select app_user_id from public.shield_contacts
      where owner_id = v_session.user_id and app_user_id is not null
    loop
      perform public.notify_event(
        v_app_contact.app_user_id, 'wwm_check_in_overdue'::public.notification_event, null,
        jsonb_build_object('wwm_session_id', v_session.id, 'walker_id', v_session.user_id)
      );
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'phone', phone)), '[]'::jsonb)
      into v_phone_contacts
    from public.shield_contacts
    where owner_id = v_session.user_id and app_user_id is null;

    update public.walk_with_me_sessions
    set status = 'expired_notified', notified_at = now()
    where id = v_session.id;

    perform public.log_audit_event(
      v_session.user_id, 'system', 'wwm_expired_circle_notified', 'walk_with_me_sessions', v_session.id,
      jsonb_build_object('phone_contacts_stub_logged', v_phone_contacts)
    );
  end loop;

  for v_session in
    select * from public.walk_with_me_sessions
    where status = 'expired_notified'
      and notified_at is not null
      and notified_at + (grace_minutes || ' minutes')::interval < now()
  loop
    insert into public.shield_events (source, event_type, triggered_by, mission_id, lat, lng)
    values ('shield', 'wwm_expired', v_session.user_id, null, v_session.destination_lat, v_session.destination_lng)
    returning id into v_event_id;

    perform public.ensure_shield_share_link(v_session.user_id, v_event_id);

    update public.walk_with_me_sessions
    set status = 'escalated', shield_event_id = v_event_id
    where id = v_session.id;

    perform public.log_audit_event(
      v_session.user_id, 'system', 'wwm_escalated_to_dispatcher', 'shield_events', v_event_id,
      jsonb_build_object('wwm_session_id', v_session.id)
    );
  end loop;
end;
$$;

comment on function public.expire_stale_walk_with_me_sessions() is
  'Scheduled sweep (cron.schedule below), not user-callable — no grant to authenticated.';

select cron.schedule(
  'expire-stale-walk-with-me-sessions',
  '*/15 * * * * *',
  $$select public.expire_stale_walk_with_me_sessions();$$
);
