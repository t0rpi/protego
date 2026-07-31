-- M4 — two additions:
--  1. review->confirmed now also requires a logged dispatcher call for
--     that mission (design `dispatcher.level2Gate`: "Verificare nivel 2
--     obligatorie înainte de orice confirmare. Fără apel + CI verificat,
--     misiunea rămâne 'în verificare'") — reuses call_intents
--     (20260731120004) rather than a new table; the same log that backs
--     the "Sună clientul" button on the high-risk queue is what this
--     gate checks for.
--  2. shift_handovers (dispatcher-playbook.md §9): a snapshot of active
--     missions, unresolved SOS and pending high-risk missions at
--     handover time, journaled to audit_log.
--  3. A scoped dispatcher read policy on audit_log. M1 made audit_log
--     admin-only (data-model.md §4's general audit trail — role
--     changes, registrations). But dispatcher-playbook.md §3/§9 requires
--     dispatchers to journal SOS interventions and shift handovers as
--     part of their own job, which is meaningless if they can't ever
--     read back what got journaled. Scoped narrowly to the 3 entities
--     M4 actually journals for dispatcher-facing operations — not
--     widened to the full admin audit trail (registrations, role
--     changes stay admin-only).

create policy "dispatcher can read operational audit entries"
  on public.audit_log for select
  to authenticated
  using (
    public.current_user_role() = 'dispatcher'
    and entity in ('shield_events', 'shift_handovers', 'missions')
  );

create or replace function public.enforce_mission_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification_level smallint;
  v_checklist_ok boolean;
  v_is_assigned_agent boolean;
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then

    if OLD.status = 'draft' and NEW.status = 'quoted' then
      if NEW.service_id is null or NEW.mobility is null or NEW.city is null then
        raise exception 'mission incomplete: service, mobility and city are required before quoting';
      end if;

      if not exists (
        select 1 from public.service_city_status scs
        where scs.service_id = NEW.service_id and scs.city = NEW.city and scs.enabled
      ) then
        raise exception 'this service is not enabled in city % (catalog on/off switch)', NEW.city;
      end if;

    elsif OLD.status = 'quoted' and NEW.status = 'review' then
      if NEW.risk_level <> 'high' then
        raise exception 'quoted -> review is only for high-risk missions (risk_level=%)', NEW.risk_level;
      end if;

    elsif OLD.status = 'quoted' and NEW.status = 'confirmed' then
      if NEW.risk_level <> 'normal' then
        raise exception 'high-risk missions cannot confirm directly — must go through review (risk_level=%)', NEW.risk_level;
      end if;

      select verification_level into v_verification_level from public.profiles where id = NEW.client_id;
      if coalesce(v_verification_level, 1) < 2 then
        raise exception 'client verification_level must be 2 to confirm a mission (acceptance-tests.md M1/M2)';
      end if;

      if NEW.mobility = 'client_vehicle' then
        select
          c.consent_signed_at is not null
          and c.insurance_confirmed
          and c.client_signature_at is not null
          into v_checklist_ok
        from public.mission_vehicle_checklists c
        where c.mission_id = NEW.id;

        if not coalesce(v_checklist_ok, false) then
          raise exception 'client-vehicle checklist incomplete (consent + insurance + signature required before payment step)';
        end if;
      end if;

      if not NEW.payment_stub_confirmed then
        raise exception 'payment step not completed';
      end if;

    elsif OLD.status = 'review' and NEW.status = 'confirmed' then
      if public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only a dispatcher or admin can confirm a high-risk mission — never automatic (business-rules.md §6)';
      end if;

      select verification_level into v_verification_level from public.profiles where id = NEW.client_id;
      if coalesce(v_verification_level, 1) < 2 then
        raise exception 'client verification_level must be 2 to confirm a mission';
      end if;

      -- M4: design dispatcher.level2Gate — a call must be logged for
      -- this mission before a dispatcher can confirm it out of review.
      if not exists (
        select 1 from public.call_intents ci
        where ci.mission_id = NEW.id and ci.purpose = 'high_risk_review_call'
      ) then
        raise exception 'a dispatcher call must be logged for this mission before confirming (dispatcher.level2Gate)';
      end if;

    elsif OLD.status = 'review' and NEW.status = 'cancelled_dispatcher' then
      if public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only a dispatcher or admin can decline a high-risk mission';
      end if;

    elsif NEW.status = 'cancelled_client' and OLD.status in ('draft', 'quoted', 'review', 'confirmed') then
      if NEW.client_id <> auth.uid() and public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only the mission''s own client (or dispatcher/admin) can cancel it';
      end if;

    elsif OLD.status = 'confirmed' and NEW.status = 'assigned' then
      if not exists (
        select 1 from public.mission_offers mo
        where mo.mission_id = NEW.id and mo.status = 'accepted'
      ) then
        raise exception 'confirmed -> assigned requires an accepted mission offer';
      end if;

    elsif OLD.status = 'assigned' and NEW.status = 'enroute' then
      select exists (
        select 1 from public.mission_offers mo
        where mo.mission_id = NEW.id and mo.status = 'accepted' and mo.agent_id = auth.uid()
      ) into v_is_assigned_agent;
      if not v_is_assigned_agent and public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only the assigned agent (or dispatcher/admin) can start heading to the client';
      end if;

    elsif OLD.status = 'enroute' and NEW.status = 'arrived' then
      select exists (
        select 1 from public.mission_offers mo
        where mo.mission_id = NEW.id and mo.status = 'accepted' and mo.agent_id = auth.uid()
      ) into v_is_assigned_agent;
      if not v_is_assigned_agent and public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only the assigned agent (or dispatcher/admin) can mark arrival';
      end if;

    elsif OLD.status = 'arrived' and NEW.status = 'active' then
      if coalesce(current_setting('protego.verified_start', true), 'false') <> 'true' then
        raise exception 'arrived -> active requires verification via start_mission_protection()';
      end if;

      if NEW.mobility = 'client_vehicle' then
        select public.is_vehicle_photo_checklist_complete(c.photos) into v_checklist_ok
        from public.mission_vehicle_checklists c
        where c.mission_id = NEW.id;

        if not coalesce(v_checklist_ok, false) then
          raise exception 'client-vehicle photo checklist incomplete (6 photos required before starting protection)';
        end if;
      end if;

    elsif OLD.status = 'active' and NEW.status = 'done' then
      if coalesce(current_setting('protego.verified_complete', true), 'false') <> 'true' then
        raise exception 'active -> done requires completion via complete_mission()';
      end if;

    elsif OLD.status in ('assigned', 'enroute') and NEW.status = 'confirmed' then
      select exists (
        select 1 from public.mission_offers mo
        where mo.mission_id = NEW.id and mo.status = 'accepted' and mo.agent_id = auth.uid()
      ) into v_is_assigned_agent;
      if not v_is_assigned_agent and public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only the assigned agent (or dispatcher/admin) can release this mission back to the pool';
      end if;

    else
      raise exception 'mission transition % -> % is not allowed (or not implemented yet)', OLD.status, NEW.status;
    end if;

  end if;

  return NEW;
end;
$$;

-- Shift handover (dispatcher-playbook.md §9 — an operational
-- recommendation, "de formalizat ca procedură scrisă înainte de
-- pilot", now given a real data shape). A snapshot, not a live query:
-- what was true AT handover time is what the next dispatcher should
-- see, even if the underlying rows change moments later.
create table public.shift_handovers (
  id uuid primary key default gen_random_uuid(),
  dispatcher_id uuid not null references public.profiles (id),
  note text,
  active_mission_ids uuid[] not null default '{}',
  unresolved_sos_ids uuid[] not null default '{}',
  pending_high_risk_mission_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.shift_handovers enable row level security;

create policy "dispatcher and admin can read all handovers"
  on public.shift_handovers for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.shift_handovers to authenticated;
-- No write grant — only create_shift_handover() writes this table.

create function public.create_shift_handover(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_missions uuid[];
  v_unresolved_sos uuid[];
  v_pending_high_risk uuid[];
  v_handover_id uuid;
begin
  if public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only a dispatcher or admin can hand over a shift';
  end if;

  select coalesce(array_agg(id), '{}') into v_active_missions
  from public.missions where status in ('assigned', 'enroute', 'arrived', 'active');

  select coalesce(array_agg(id), '{}') into v_unresolved_sos
  from public.shield_events where status in ('open', 'acknowledged');

  select coalesce(array_agg(id), '{}') into v_pending_high_risk
  from public.missions where status = 'review';

  insert into public.shift_handovers (
    dispatcher_id, note, active_mission_ids, unresolved_sos_ids, pending_high_risk_mission_ids
  ) values (
    auth.uid(), p_note, v_active_missions, v_unresolved_sos, v_pending_high_risk
  )
  returning id into v_handover_id;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'shift_handover', 'shift_handovers', v_handover_id,
    jsonb_build_object(
      'active_missions', array_length(v_active_missions, 1),
      'unresolved_sos', array_length(v_unresolved_sos, 1),
      'pending_high_risk', array_length(v_pending_high_risk, 1),
      'note', p_note
    )
  );

  return v_handover_id;
end;
$$;

grant execute on function public.create_shift_handover(text) to authenticated;

-- High-risk queue action (design `dispatcher.requestInfo`): no status
-- change, just an audited note that the dispatcher needs more from the
-- client before deciding — dispatcher-playbook.md §4: "poate contacta
-- clientul direct înainte de alocare".
create function public.request_more_info(p_mission_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only a dispatcher or admin can request more information on a mission';
  end if;
  if not exists (select 1 from public.missions where id = p_mission_id and status = 'review') then
    raise exception 'mission % is not in review', p_mission_id;
  end if;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'requested_more_info', 'missions', p_mission_id,
    jsonb_build_object('note', p_note)
  );
end;
$$;

grant execute on function public.request_more_info(uuid, text) to authenticated;
