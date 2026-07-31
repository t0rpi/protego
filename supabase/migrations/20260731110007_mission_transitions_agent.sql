-- M3 — extends enforce_mission_transition() (originally
-- 20260731100003_missions.sql) with the agent-side transitions:
-- confirmed->assigned (accepted offer), assigned->enroute->arrived
-- (agent, one-tap), arrived->active (code + checklist gated, via
-- start_mission_protection()), active->done (via complete_mission()),
-- and assigned/enroute->confirmed (agent cancellation / reassignment).
--
-- `cancelled_agent` (an existing enum value from M2) is deliberately
-- NOT reached by any branch here: this milestone models cancellation as
-- "return to the pool for reassignment" (->confirmed,
-- elevated_priority=true), not as a terminal state. `cancelled_agent`
-- stays reserved for a future milestone's "reassignment genuinely
-- failed, dispatcher gives up" decision — disclosed simplification, not
-- an oversight.
--
-- Two of the new transitions (arrived->active, active->done) carry
-- security-sensitive side effects that need extra parameters a trigger
-- can't receive directly (an entered verification code; a completion
-- summary) — start_mission_protection() and complete_mission() validate
-- those, then set a transaction-local flag via set_config(...,true) so
-- the trigger can confirm the update only happens through the function,
-- never a raw client-side UPDATE.

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

    elsif OLD.status = 'review' and NEW.status = 'cancelled_dispatcher' then
      if public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only a dispatcher or admin can decline a high-risk mission';
      end if;

    elsif NEW.status = 'cancelled_client' and OLD.status in ('draft', 'quoted', 'review', 'confirmed') then
      if NEW.client_id <> auth.uid() and public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only the mission''s own client (or dispatcher/admin) can cancel it';
      end if;

    -- M3: confirmed -> assigned only ever happens as a side effect of
    -- accept_mission_offer() (20260731110002), but the trigger
    -- re-verifies the precondition itself rather than trusting the
    -- caller — an accepted offer must actually exist for this mission.
    elsif OLD.status = 'confirmed' and NEW.status = 'assigned' then
      if not exists (
        select 1 from public.mission_offers mo
        where mo.mission_id = NEW.id and mo.status = 'accepted'
      ) then
        raise exception 'confirmed -> assigned requires an accepted mission offer';
      end if;

    -- M3: one-tap agent status flow. Only the agent holding the
    -- accepted offer for this mission (or a dispatcher/admin) may drive it.
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

    -- M3: arrived -> active must go through start_mission_protection()
    -- (verification code + client-vehicle photo checklist) — a raw
    -- UPDATE attempting this transition directly is rejected because the
    -- transaction-local flag isn't set. The checklist condition is also
    -- re-checked here as defense in depth (same pattern as the
    -- quoted->confirmed branch above).
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

    -- M3: active -> done must go through complete_mission() (writes the
    -- guided report + earnings atomically with the transition).
    elsif OLD.status = 'active' and NEW.status = 'done' then
      if coalesce(current_setting('protego.verified_complete', true), 'false') <> 'true' then
        raise exception 'active -> done requires completion via complete_mission()';
      end if;

    -- M3: agent cancellation / reassignment — the mission returns to the
    -- pool rather than terminating (see this file's header comment).
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

-- Agent-driven one-tap transitions (assigned->enroute, enroute->arrived,
-- and the cancellation path) go through a raw UPDATE of missions.status.
-- The column-level grant for `status` already exists from M2, but M2
-- never gave any role but the client (and dispatcher/admin) row-level
-- UPDATE access to `missions` at all — an agent session had no RLS
-- policy letting it touch a mission row in the first place. Add one.
--
-- Postgres row security requires a row to be SELECT-visible before an
-- UPDATE-specific policy's USING clause is even consulted for it — an
-- UPDATE policy alone, with no matching SELECT policy, silently updates
-- zero rows (confirmed empirically against a real Postgres instance
-- while building this milestone; it is not documented as prominently as
-- it probably should be). A raw SELECT policy scoped to *accepted*
-- offers only is also the right scope on its own merits: once an offer
-- is accepted, this mission's full detail is meant to be visible to
-- that agent anyway (agent_mission_briefs only masks pickup/destination
-- /code/context while a offer is still pending) — this policy grants
-- nothing beyond what acceptance is already supposed to reveal.
create policy "assigned agent can read own mission"
  on public.missions for select
  to authenticated
  using (
    exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = missions.id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  );

create policy "assigned agent can update own mission"
  on public.missions for update
  to authenticated
  using (
    exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = missions.id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  )
  with check (
    exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = missions.id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  );

-- That policy alone would let an assigned agent's session pass RLS for
-- the whole row and then, via the pre-existing shared column grant
-- (service_id, pickup_address, dress_code, etc. — all granted to
-- 'authenticated' for the CLIENT's booking-time use), also rewrite
-- booking fields that are none of their business — RLS policies are
-- OR'd together for row access and don't themselves restrict which
-- granted columns get touched. Same gap, same fix as
-- mission_vehicle_checklists (20260731110005): a trigger comparing
-- OLD/NEW restricts an assigned-agent session to the `status` column only.
create function public.enforce_mission_column_ownership()
returns trigger
language plpgsql
as $$
declare
  v_is_client boolean;
  v_is_assigned_agent boolean;
begin
  if public.current_user_role() in ('dispatcher', 'admin') then
    return NEW;
  end if;

  v_is_client := (NEW.client_id = auth.uid());
  select exists (
    select 1 from public.mission_offers mo
    where mo.mission_id = NEW.id and mo.agent_id = auth.uid() and mo.status = 'accepted'
  ) into v_is_assigned_agent;

  if v_is_assigned_agent and not v_is_client then
    if NEW.service_id is distinct from OLD.service_id
       or NEW.city is distinct from OLD.city
       or NEW.pickup_address is distinct from OLD.pickup_address
       or NEW.destination_address is distinct from OLD.destination_address
       or NEW.scheduled_at is distinct from OLD.scheduled_at
       or NEW.agent_count is distinct from OLD.agent_count
       or NEW.agent_preference is distinct from OLD.agent_preference
       or NEW.dress_code is distinct from OLD.dress_code
       or NEW.mobility is distinct from OLD.mobility
       or NEW.duration_hours is distinct from OLD.duration_hours
       or NEW.distance_km is distinct from OLD.distance_km
       or NEW.context_threat_known is distinct from OLD.context_threat_known
       or NEW.context_kind is distinct from OLD.context_kind
       or NEW.context_details is distinct from OLD.context_details
       or NEW.payment_stub_confirmed is distinct from OLD.payment_stub_confirmed
    then
      raise exception 'an assigned agent may only update mission status, not booking fields';
    end if;
  end if;

  return NEW;
end;
$$;

-- Alphabetically before "missions_enforce_transition" so column
-- ownership is checked first, but either order is safe here — both
-- triggers only ever inspect OLD/NEW, neither mutates other columns.
create trigger missions_enforce_column_ownership
  before update on public.missions
  for each row execute function public.enforce_mission_column_ownership();

-- Verification-code-gated start. Checks the caller IS the assigned
-- agent, the mission is actually 'arrived', the entered code matches
-- exactly (never partial/case-insensitive), the agent's own documents
-- are still valid, and — for client-vehicle missions — the 6-photo
-- checklist is complete, before flipping the transaction-local flag and
-- performing the update.
create function public.start_mission_protection(p_mission_id uuid, p_entered_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_checklist_ok boolean;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;

  if not exists (
    select 1 from public.mission_offers mo
    where mo.mission_id = p_mission_id and mo.status = 'accepted' and mo.agent_id = auth.uid()
  ) then
    raise exception 'only the assigned agent can start protection for this mission';
  end if;

  if v_mission.status <> 'arrived' then
    raise exception 'mission % must be arrived before starting protection (status=%)', p_mission_id, v_mission.status;
  end if;

  if p_entered_code is null or p_entered_code <> v_mission.verification_code then
    raise exception 'verification code does not match';
  end if;

  if not public.agent_has_no_expired_documents(auth.uid()) then
    raise exception 'agent has an expired document — cannot start missions (repository-audit.md §6)';
  end if;

  if v_mission.mobility = 'client_vehicle' then
    select public.is_vehicle_photo_checklist_complete(c.photos) into v_checklist_ok
    from public.mission_vehicle_checklists c
    where c.mission_id = p_mission_id;

    if not coalesce(v_checklist_ok, false) then
      raise exception 'client-vehicle photo checklist incomplete (6 photos required before starting protection)';
    end if;
  end if;

  -- Reset immediately after the guarded update, not left to expire at
  -- transaction end — otherwise this flag would stay "true" for the
  -- rest of the current transaction and could wrongly wave through a
  -- later, unrelated raw UPDATE attempting the same transition (this
  -- matters most for pgTAP, where an entire test file runs as one
  -- transaction, but is the correct discipline regardless).
  perform set_config('protego.verified_start', 'true', true);
  update public.missions set status = 'active' where id = p_mission_id;
  perform set_config('protego.verified_start', 'false', true);
end;
$$;

grant execute on function public.start_mission_protection(uuid, text) to authenticated;

-- Completion: only the assigned agent, only from 'active'. Writes the
-- guided report (mission_reports) and the earnings row
-- (agent_earnings, amount = latest quote's total x
-- pricing_config.agent_share_pct for that mission's service/city) in the
-- same transaction as the status flip to 'done'.
create function public.complete_mission(p_mission_id uuid, p_summary text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_agent_id uuid;
  v_quote public.quotes%rowtype;
  v_share_pct numeric;
  v_amount numeric;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;

  select mo.agent_id into v_agent_id
  from public.mission_offers mo
  where mo.mission_id = p_mission_id and mo.status = 'accepted';

  if v_agent_id is null or v_agent_id <> auth.uid() then
    raise exception 'only the assigned agent can complete this mission';
  end if;

  if v_mission.status <> 'active' then
    raise exception 'mission % must be active before completing (status=%)', p_mission_id, v_mission.status;
  end if;

  -- Reset immediately after use — see the matching comment in
  -- start_mission_protection() above for why.
  perform set_config('protego.verified_complete', 'true', true);
  update public.missions set status = 'done' where id = p_mission_id;
  perform set_config('protego.verified_complete', 'false', true);

  insert into public.mission_reports (mission_id, agent_id, summary)
  values (p_mission_id, v_agent_id, p_summary);

  select * into v_quote
  from public.quotes
  where mission_id = p_mission_id
  order by created_at desc
  limit 1;

  if v_quote.id is not null then
    select pc.agent_share_pct into v_share_pct
    from public.pricing_config pc
    where pc.service_id = v_mission.service_id and pc.city = v_mission.city;

    v_amount := round(v_quote.total_estimate * coalesce(v_share_pct, 0), 2);

    insert into public.agent_earnings (mission_id, agent_id, amount, currency)
    values (p_mission_id, v_agent_id, v_amount, v_quote.currency);
  end if;
end;
$$;

grant execute on function public.complete_mission(uuid, text) to authenticated;

-- Agent-initiated cancellation of an assigned/enroute mission — returns
-- it to the pool with elevated priority rather than a terminal state
-- (see this file's header comment).
create function public.agent_cancel_mission(p_mission_id uuid)
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

  if not exists (
    select 1 from public.mission_offers mo
    where mo.mission_id = p_mission_id and mo.status = 'accepted' and mo.agent_id = auth.uid()
  ) then
    raise exception 'only the assigned agent can cancel their own assignment on this mission';
  end if;

  if v_mission.status not in ('assigned', 'enroute') then
    raise exception 'mission % cannot be released back to the pool from status %', p_mission_id, v_mission.status;
  end if;

  -- Mission status must move while the offer is STILL 'accepted' —
  -- enforce_mission_transition()'s assigned/enroute->confirmed branch
  -- re-checks that an accepted offer for this agent exists before
  -- allowing the transition. Downgrade the now-stale offer only
  -- afterward, so a later query for "the current accepted offer on
  -- this mission" (accept_mission_offer's supersede step,
  -- complete_mission's lookup) never picks up this agent's old
  -- assignment once a fresh offer cycle succeeds. Reuses 'declined'
  -- rather than adding a 5th enum value — from the system's
  -- perspective this offer no longer represents an active assignment,
  -- the same end state as if it had never been accepted.
  update public.missions set status = 'confirmed', elevated_priority = true where id = p_mission_id;

  update public.mission_offers
  set status = 'declined', responded_at = now()
  where mission_id = p_mission_id and agent_id = auth.uid() and status = 'accepted';
end;
$$;

grant execute on function public.agent_cancel_mission(uuid) to authenticated;
