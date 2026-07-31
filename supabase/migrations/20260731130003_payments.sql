-- M5 — payments (repository-audit.md §4, data-model.md "payments").
-- Manual-capture Stripe flow: PaymentIntent authorized at confirmation,
-- captured at completion for the real duration, released (or partially
-- captured as a cancellation fee) on cancellation, a NEW PaymentIntent
-- for overage. Every Stripe interaction is server-only — Postgres
-- itself never talks to Stripe; supabase/functions/ Edge Functions do,
-- authenticated with the service_role key, and call the SECURITY
-- DEFINER functions below (granted to `service_role` only, never
-- `authenticated`) to persist the result + audit_log. A client can
-- never fabricate a "succeeded" payment row.

create type public.payment_type as enum ('auth', 'capture', 'refund', 'overage_auth');
create type public.payment_status as enum ('requires_capture', 'succeeded', 'canceled', 'failed', 'processing');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  group_id uuid, -- nullable from day one — M9 split-payment attachment point (audit §4.5), `groups` itself stays inert (M2 future-ready table)
  stripe_payment_intent_id text not null,
  type public.payment_type not null,
  amount numeric(10, 2) not null,
  currency text not null default 'RON',
  status public.payment_status not null default 'processing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (stripe_payment_intent_id, type)
);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy "client can read own mission's payments"
  on public.payments for select
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "dispatcher and admin can read all payments"
  on public.payments for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.payments to authenticated;
-- No write grant for authenticated/anon at all — only record_payment_event()
-- (service_role only, below) writes this table.

-- record_payment_event() itself is SECURITY DEFINER (runs as the
-- function owner regardless of caller), so it doesn't need this — but
-- service_role has no implicit table-level grant of its own in this
-- local dev cluster (RLS bypass and table GRANT are separate things),
-- and an Edge Function may reasonably need to read payments back
-- directly (e.g. to decide how to act on a webhook).
grant select on public.payments to service_role;

-- Stripe webhook idempotency (webhooks can and do redeliver the same
-- event). The edge function calls this FIRST for every event; a false
-- return means "already processed, skip" rather than double-applying
-- e.g. a capture.
create table public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
-- Deliberately zero policies — service_role bypasses RLS entirely
-- (Supabase's standard role setup); no authenticated/anon access at all.

create function public.record_webhook_event(p_event_id text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stripe_webhook_events (id, event_type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;

  return found;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on every new function —
-- without this explicit revoke, `authenticated` could call this
-- service_role-only function directly despite the comment above saying
-- otherwise (caught by 24_payments_rls.sql expecting a 42501 here).
revoke execute on function public.record_webhook_event(text, text) from public;
grant execute on function public.record_webhook_event(text, text) to service_role;

-- The single write path into `payments`. Upserts by
-- (stripe_payment_intent_id, type) so a redelivered webhook updating
-- the same PaymentIntent's status is idempotent at the row level too
-- (defense in depth alongside record_webhook_event's event-id check).
create function public.record_payment_event(
  p_mission_id uuid,
  p_type public.payment_type,
  p_stripe_payment_intent_id text,
  p_amount numeric,
  p_status public.payment_status
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  insert into public.payments (mission_id, type, stripe_payment_intent_id, amount, status)
  values (p_mission_id, p_type, p_stripe_payment_intent_id, p_amount, p_status)
  on conflict (stripe_payment_intent_id, type)
    do update set status = excluded.status, amount = excluded.amount, updated_at = now()
  returning id into v_payment_id;

  perform public.log_audit_event(
    null, 'system', 'payment_' || p_type::text || '_' || p_status::text, 'payments', v_payment_id,
    jsonb_build_object('mission_id', p_mission_id, 'amount', p_amount, 'stripe_payment_intent_id', p_stripe_payment_intent_id)
  );

  return v_payment_id;
end;
$$;

revoke execute on function public.record_payment_event(uuid, public.payment_type, text, numeric, public.payment_status)
  from public;
grant execute on function public.record_payment_event(uuid, public.payment_type, text, numeric, public.payment_status)
  to service_role;

-- Transaction-local flag used by confirm_mission_after_payment() below,
-- same pattern as start_mission_protection()/complete_mission() (M3).
-- quoted->confirmed now requires a real, succeeded payment
-- authorization to exist — replaces M2's payment_stub_confirmed boolean.
-- review->confirmed deliberately still has NO payment check here
-- (audit §4.1: "nu se preautorizează nimic până la confirmarea umană"
-- — for a high-risk mission, the dispatcher's human confirmation comes
-- FIRST; payment authorization is triggered as a consequence of that
-- confirmation, not a precondition for it — see
-- confirm_mission_after_payment()'s header comment for how that's wired).
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

      if not exists (
        select 1 from public.payments
        where mission_id = NEW.id and type = 'auth' and status = 'requires_capture'
      ) then
        raise exception 'a successful payment authorization is required before confirming (audit §4.1)';
      end if;

    elsif OLD.status = 'review' and NEW.status = 'confirmed' then
      if public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only a dispatcher or admin can confirm a high-risk mission — never automatic (business-rules.md §6)';
      end if;

      select verification_level into v_verification_level from public.profiles where id = NEW.client_id;
      if coalesce(v_verification_level, 1) < 2 then
        raise exception 'client verification_level must be 2 to confirm a mission';
      end if;

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
      if coalesce(current_setting('protego.verified_cancel', true), 'false') <> 'true' then
        raise exception 'client cancellation must go through cancel_mission_by_client() (cancellation-fee calculation)';
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

-- M2's stub is gone — a real payments row is now the source of truth
-- for "has this mission been paid for". The client-role column grant
-- never needs to write it directly (the trigger only reads `payments`,
-- it does not require a matching missions column), so this is a
-- straightforward drop, not a soft-deprecate.
alter table public.missions drop column payment_stub_confirmed;

-- enforce_mission_column_ownership() (M3, 20260731110007) also
-- referenced payment_stub_confirmed in its NEW/OLD column diff — any
-- update to missions by an assigned agent (not just status changes)
-- fires this trigger, so the dropped column must be removed here too,
-- not just from enforce_mission_transition() above.
create or replace function public.enforce_mission_column_ownership()
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
    then
      raise exception 'an assigned agent may only update mission status, not booking fields';
    end if;
  end if;

  return NEW;
end;
$$;

-- Called by the payment-authorization edge function once Stripe
-- confirms the PaymentIntent reached requires_capture (webhook
-- `payment_intent.amount_capturable_updated`) — NOT callable directly
-- by a client, so a client can never flip their own mission to
-- confirmed without a real, Stripe-verified authorization.
create function public.confirm_mission_after_payment(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.missions set status = 'confirmed' where id = p_mission_id and status = 'quoted';
end;
$$;

revoke execute on function public.confirm_mission_after_payment(uuid) from public;
grant execute on function public.confirm_mission_after_payment(uuid) to service_role;

-- Client-initiated cancellation, now the ONLY path to cancelled_client
-- (see the trigger's protego.verified_cancel check above) — computes
-- the v2.3 §22 cancellation fee itself rather than trusting a caller-
-- supplied amount. Returns the fee (0 = full release) for the caller
-- (an edge function) to act on with Stripe — Postgres itself never
-- calls Stripe.
create function public.cancel_mission_by_client(p_mission_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_cfg public.pricing_config%rowtype;
  v_quote public.quotes%rowtype;
  v_within_free_window boolean;
  v_fee numeric := 0;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;
  if v_mission.client_id <> auth.uid() then
    raise exception 'only the mission''s own client can cancel it';
  end if;
  if v_mission.status not in ('draft', 'quoted', 'review', 'confirmed') then
    raise exception 'mission % cannot be cancelled from status %', p_mission_id, v_mission.status;
  end if;

  select pc.* into v_cfg
  from public.pricing_config pc
  where pc.service_id = v_mission.service_id and pc.city = v_mission.city;

  if v_mission.status = 'confirmed' and found then
    v_within_free_window :=
      v_mission.scheduled_at is not null
      and v_mission.scheduled_at - now() >= (v_cfg.free_cancel_minutes || ' minutes')::interval;

    -- An immediate ("now") booking has no scheduled buffer to measure
    -- against, so it is never "within" the free window once confirmed —
    -- disclosed interpretation, business-rules.md doesn't address this
    -- edge case explicitly.
    if not v_within_free_window then
      select * into v_quote
      from public.quotes
      where mission_id = p_mission_id and kind = 'initial'
      order by created_at desc
      limit 1;

      if v_quote.id is not null then
        v_fee := least(
          greatest(v_quote.total_estimate * v_cfg.cancellation_fee_pct, v_cfg.cancellation_fee_minimum),
          v_quote.total_estimate
        );
      end if;
    end if;
  end if;

  perform set_config('protego.verified_cancel', 'true', true);
  update public.missions set status = 'cancelled_client' where id = p_mission_id;
  perform set_config('protego.verified_cancel', 'false', true);

  perform public.log_audit_event(
    auth.uid(), 'client', 'mission_cancelled', 'missions', p_mission_id,
    jsonb_build_object('fee', v_fee, 'within_free_window', coalesce(v_within_free_window, true))
  );

  return v_fee;
end;
$$;

grant execute on function public.cancel_mission_by_client(uuid) to authenticated;

-- Overage (audit §4.4): the client's own explicit extension request.
-- Only creates the QUOTE (kind='overage') — the actual Stripe
-- PaymentIntent (type=overage_auth) is created by an edge function that
-- reads this quote back and calls record_payment_event().
create function public.request_mission_overage(p_mission_id uuid, p_additional_hours numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_service_key text;
  v_result jsonb;
  v_quote_id uuid;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;
  if v_mission.client_id <> auth.uid() then
    raise exception 'only the mission''s own client can request an extension';
  end if;
  if v_mission.status <> 'active' then
    raise exception 'mission % must be active to request an extension (status=%)', p_mission_id, v_mission.status;
  end if;
  if p_additional_hours is null or p_additional_hours <= 0 then
    raise exception 'additional hours must be positive';
  end if;

  select key into v_service_key from public.services where id = v_mission.service_id;
  if v_service_key = 'protect_ride' then
    raise exception 'overage does not apply to Protect Ride (distance-based, not hourly)';
  end if;

  v_result := public.compute_overage_quote(
    v_service_key, v_mission.city, v_mission.agent_count, p_additional_hours,
    extract(hour from now()) >= 22 or extract(hour from now()) < 6,
    extract(isodow from now()) in (6, 7),
    false
  );

  insert into public.quotes (mission_id, breakdown, total_estimate, currency, labor_component, kind)
  values (
    p_mission_id, v_result -> 'lines', (v_result ->> 'total')::numeric, v_result ->> 'currency',
    (v_result ->> 'labor_component')::numeric, 'overage'
  )
  returning id into v_quote_id;

  return jsonb_build_object(
    'quote_id', v_quote_id,
    'total', v_result -> 'total',
    'labor_component', v_result -> 'labor_component'
  );
end;
$$;

grant execute on function public.request_mission_overage(uuid, numeric) to authenticated;

-- Completion: now also recomputes the FINAL price from real duration
-- (Escort/Hourly only — Protect Ride's distance isn't independently
-- re-measured this milestone, disclosed simplification, no live route/
-- GPS-path integration yet), writes a kind='final' quote, computes
-- agent earnings from the labor component (v2.3 §23: 55%, with a 35
-- lei/mission floor confirmed for Protect Ride only), and returns the
-- capture amount(s) for the completion edge function to act on with
-- Stripe — capture can never exceed what was actually authorized.
-- CREATE OR REPLACE can't change a function's return type (void ->
-- jsonb, needed so callers get back the capture amount) — must drop first.
drop function if exists public.complete_mission(uuid, text);

create function public.complete_mission(p_mission_id uuid, p_summary text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_agent_id uuid;
  v_initial_quote public.quotes%rowtype;
  v_service_key text;
  v_real_hours numeric;
  v_final_result jsonb;
  v_final_total numeric;
  v_final_labor numeric;
  v_capture_amount numeric := 0;
  v_share_pct numeric;
  v_agent_floor numeric;
  v_amount numeric;
  v_overage_total numeric := 0;
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

  perform set_config('protego.verified_complete', 'true', true);
  update public.missions set status = 'done', completed_at = now() where id = p_mission_id;
  perform set_config('protego.verified_complete', 'false', true);

  insert into public.mission_reports (mission_id, agent_id, summary)
  values (p_mission_id, v_agent_id, p_summary);

  select * into v_initial_quote
  from public.quotes
  where mission_id = p_mission_id and kind = 'initial'
  order by created_at desc
  limit 1;

  if v_initial_quote.id is not null then
    select key into v_service_key from public.services where id = v_mission.service_id;

    if v_service_key = 'protect_ride' then
      v_final_total := v_initial_quote.total_estimate;
      v_final_labor := v_initial_quote.labor_component;
    else
      v_real_hours := greatest(
        extract(
          epoch from coalesce(v_mission.completed_at, now())
            - coalesce(v_mission.started_at, v_mission.completed_at, now())
        ) / 3600.0,
        0
      );
      v_final_result := public.compute_quote(
        v_service_key, v_mission.city, v_mission.agent_count, v_real_hours, v_mission.distance_km,
        v_mission.mobility::text, false, false, false
      );
      v_final_total := (v_final_result ->> 'total')::numeric;
      v_final_labor := (v_final_result ->> 'labor_component')::numeric;
    end if;

    v_capture_amount := least(v_final_total, v_initial_quote.total_estimate);

    insert into public.quotes (mission_id, breakdown, total_estimate, currency, labor_component, kind)
    values (
      p_mission_id, coalesce(v_final_result -> 'lines', v_initial_quote.breakdown), v_final_total, 'RON',
      v_final_labor, 'final'
    );

    select pc.agent_share_pct, pc.agent_minimum_per_mission into v_share_pct, v_agent_floor
    from public.pricing_config pc
    where pc.service_id = v_mission.service_id and pc.city = v_mission.city;

    v_amount := round(v_final_labor * coalesce(v_share_pct, 0), 2);
    if v_agent_floor is not null and v_amount < v_agent_floor then
      v_amount := v_agent_floor;
    end if;

    insert into public.agent_earnings (mission_id, agent_id, amount, currency)
    values (p_mission_id, v_agent_id, v_amount, 'RON');

    select coalesce(sum(total_estimate), 0) into v_overage_total
    from public.quotes
    where mission_id = p_mission_id and kind = 'overage';
  end if;

  return jsonb_build_object('capture_amount', v_capture_amount, 'overage_total', v_overage_total);
end;
$$;

grant execute on function public.complete_mission(uuid, text) to authenticated;
