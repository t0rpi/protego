-- Chained rides (founder-approved, 2026-08-04): during an active
-- Protect Ride mission booked with the wait-at-destination add-on, the
-- client can tap "Continua spre alta adresa" to keep the same mission
-- going to a new destination instead of ending it. Billed increment
-- only: the waiting minutes actually consumed beyond the free
-- allowance, plus the new leg's distance -- explicitly NO second base
-- fare (v2.3 SS16's base fare covers the whole mission, not per leg).
-- One mission, one report/receipt/rating throughout -- segments are an
-- append-only ledger of the itinerary, not separate missions.
--
-- Segment numbering: the ORIGINAL booked destination is segment 1 and
-- is never written here -- it's already fully modeled by the existing
-- missions.destination_address/distance_km columns. This table only
-- holds continuations (segment 2+), keeping the change purely additive
-- (create_quote_for_mission and the original booking flow are
-- untouched).
--
-- "Consumed waiting minutes" is client-reported at the moment they tap
-- continue (a stepper, defaulting to the mission's booked
-- wait_at_destination_minutes) -- the same disclosed-estimate pattern
-- already used for wait_at_destination_minutes/accompany_inside_minutes
-- at booking time (this codebase has never measured elapsed minutes via
-- GPS/telemetry; a pilot doing so here would be inconsistent with how
-- every other minutes-based add-on already works).
create table public.mission_segments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  segment_number int not null check (segment_number >= 2),
  previous_destination_address text not null,
  destination_address text not null,
  distance_km numeric(6, 2) not null check (distance_km >= 0),
  consumed_wait_minutes int not null check (consumed_wait_minutes >= 0),
  consumed_wait_billable_minutes int not null check (consumed_wait_billable_minutes >= 0),
  incremental_cost numeric(10, 2) not null,
  quote_id uuid not null references public.quotes (id),
  created_at timestamptz not null default now(),
  unique (mission_id, segment_number)
);

comment on table public.mission_segments is
  'Chained-rides itinerary ledger (2026-08-04). Segment 1 is implicit (missions.destination_address/distance_km); rows here are continuations only, written exclusively by request_mission_segment().';

alter table public.mission_segments enable row level security;

create policy "client can read own mission's segments"
  on public.mission_segments for select
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "dispatcher and admin can read all mission segments"
  on public.mission_segments for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

create policy "assigned agent can read mission segments"
  on public.mission_segments for select
  to authenticated
  using (
    exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = mission_segments.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  );

grant select on public.mission_segments to authenticated;
-- No insert/update/delete grant for anyone -- only request_mission_segment()
-- (SECURITY DEFINER, below) writes this table.

-- Quotes gains a 4th kind for the incremental charge of a chained-ride
-- continuation -- same "computed, never client-submitted" contract as
-- 'initial'/'overage'/'final', just a distinct label for reporting.
alter table public.quotes drop constraint quotes_kind_check;
alter table public.quotes add constraint quotes_kind_check
  check (kind in ('initial', 'overage', 'final', 'segment'));

-- The pricing engine for a chained-ride continuation, authoritative
-- version. packages/domain mirrors this exact formula for a client-side
-- preview, same relationship as compute_quote/compute_overage_quote.
-- Protect Ride only (the only service with a destination/wait-at-
-- destination concept); no base fare, no platform fee (already charged
-- once on the original mission) -- just the billable wait overage plus
-- the new leg's distance, then VAT.
create or replace function public.compute_segment_quote(
  p_city text,
  p_consumed_wait_minutes int,
  p_new_km numeric,
  p_night boolean default false,
  p_weekend boolean default false,
  p_urgent boolean default false
) returns jsonb
language plpgsql
stable
as $$
declare
  cfg public.pricing_config%rowtype;
  v_coef numeric;
  v_wait_billable_minutes int;
  v_wait_cost numeric;
  v_distance_cost numeric;
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
  v_lines jsonb := '[]'::jsonb;
begin
  select pc.* into cfg
  from public.pricing_config pc
  join public.services s on s.id = pc.service_id
  where s.key = 'protect_ride' and pc.city = p_city;

  if not found then
    raise exception 'no pricing config for protect_ride in city %', p_city;
  end if;

  v_coef := least(
    coalesce(cfg.coef_cap, 1.5),
    1.0
      * (case when p_night then cfg.coef_night else 1.0 end)
      * (case when p_weekend then cfg.coef_weekend else 1.0 end)
      * (case when p_urgent then cfg.coef_urgent else 1.0 end)
  );

  v_wait_billable_minutes := greatest(0, coalesce(p_consumed_wait_minutes, 0) - coalesce(cfg.wait_free_minutes, 0));
  v_wait_cost := round(v_wait_billable_minutes * coalesce(cfg.wait_per_minute_rate, 0), 2);
  v_lines := v_lines || jsonb_build_object('label', 'wait_at_destination', 'amount', v_wait_cost);

  v_distance_cost := round(coalesce(p_new_km, 0) * cfg.per_km * v_coef, 2);
  v_lines := v_lines || jsonb_build_object('label', 'distance', 'amount', v_distance_cost);

  v_subtotal := v_wait_cost + v_distance_cost;
  v_vat := round(v_subtotal * cfg.vat_rate, 2);
  v_lines := v_lines || jsonb_build_object('label', 'vat', 'amount', v_vat);

  v_total := round(v_subtotal + v_vat, 2);

  return jsonb_build_object(
    'lines', v_lines,
    'total', v_total,
    'currency', 'RON',
    'labor_component', v_subtotal
  );
end;
$$;

grant execute on function public.compute_segment_quote(text, int, numeric, boolean, boolean, boolean) to authenticated;

-- Confirms a chained-ride continuation: computes the incremental quote,
-- records the segment, moves the mission's active destination to the
-- new leg (so the agent app / dispatcher console, which already read
-- missions.destination_address, see it with no extra plumbing), and
-- notifies the assigned agent + all dispatchers. Mirrors
-- request_mission_overage()'s "compute and commit in one call" shape --
-- the caller (create-segment-payment edge function) creates the actual
-- PaymentIntent right after this returns, same two-step pattern as the
-- existing overage flow.
create or replace function public.request_mission_segment(
  p_mission_id uuid,
  p_new_destination_address text,
  p_new_destination_km numeric,
  p_consumed_wait_minutes int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_service_key text;
  v_result jsonb;
  v_quote_id uuid;
  v_segment_id uuid;
  v_segment_number int;
  v_agent_id uuid;
  v_dispatcher record;
  v_payload jsonb;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;
  if v_mission.client_id <> auth.uid() then
    raise exception 'only the mission''s own client can continue to a new address';
  end if;
  if v_mission.status <> 'active' then
    raise exception 'mission % must be active to continue to a new address (status=%)', p_mission_id, v_mission.status;
  end if;
  if v_mission.wait_at_destination_minutes is null or v_mission.wait_at_destination_minutes <= 0 then
    raise exception 'chained rides require the wait-at-destination add-on to have been booked';
  end if;
  if p_new_destination_address is null or length(trim(p_new_destination_address)) = 0 then
    raise exception 'a new destination address is required';
  end if;
  if p_new_destination_km is null or p_new_destination_km < 0 then
    raise exception 'the new segment''s distance must be a non-negative number';
  end if;
  if p_consumed_wait_minutes is null or p_consumed_wait_minutes < 0 then
    raise exception 'consumed wait minutes must be a non-negative number';
  end if;

  select key into v_service_key from public.services where id = v_mission.service_id;
  if v_service_key <> 'protect_ride' then
    raise exception 'chained rides only apply to Protect Ride (distance/wait based)';
  end if;

  v_result := public.compute_segment_quote(
    v_mission.city, p_consumed_wait_minutes, p_new_destination_km,
    extract(hour from now()) >= 22 or extract(hour from now()) < 6,
    public.is_weekend_pricing_window(now()),
    false
  );

  insert into public.quotes (mission_id, breakdown, total_estimate, currency, labor_component, kind)
  values (
    p_mission_id, v_result -> 'lines', (v_result ->> 'total')::numeric, v_result ->> 'currency',
    (v_result ->> 'labor_component')::numeric, 'segment'
  )
  returning id into v_quote_id;

  select coalesce(max(segment_number), 1) + 1 into v_segment_number
  from public.mission_segments where mission_id = p_mission_id;

  insert into public.mission_segments (
    mission_id, segment_number, previous_destination_address, destination_address,
    distance_km, consumed_wait_minutes, consumed_wait_billable_minutes, incremental_cost, quote_id
  )
  values (
    p_mission_id, v_segment_number, v_mission.destination_address, p_new_destination_address,
    p_new_destination_km, p_consumed_wait_minutes,
    greatest(0, p_consumed_wait_minutes - (
      select coalesce(wait_free_minutes, 0) from public.pricing_config pc
      join public.services s on s.id = pc.service_id
      where s.key = 'protect_ride' and pc.city = v_mission.city
    )),
    (v_result ->> 'total')::numeric, v_quote_id
  )
  returning id into v_segment_id;

  update public.missions
  set destination_address = p_new_destination_address, distance_km = p_new_destination_km
  where id = p_mission_id;

  v_payload := jsonb_build_object('mission_id', p_mission_id, 'destination_address', p_new_destination_address);

  select mo.agent_id into v_agent_id
  from public.mission_offers mo
  where mo.mission_id = p_mission_id and mo.status = 'accepted'
  limit 1;

  if v_agent_id is not null then
    perform public.notify_event(v_agent_id, 'destination_changed', p_mission_id, v_payload);
  end if;

  for v_dispatcher in select id from public.profiles where role in ('dispatcher', 'admin') loop
    perform public.notify_event(v_dispatcher.id, 'destination_changed', p_mission_id, v_payload);
  end loop;

  return jsonb_build_object(
    'quote_id', v_quote_id,
    'segment_id', v_segment_id,
    'segment_number', v_segment_number,
    'total', v_result -> 'total',
    'labor_component', v_result -> 'labor_component'
  );
end;
$$;

grant execute on function public.request_mission_segment(uuid, text, numeric, int) to authenticated;
