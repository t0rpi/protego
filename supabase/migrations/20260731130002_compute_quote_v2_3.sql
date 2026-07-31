-- M5 housekeeping — compute_quote() rewritten for v2.3's actual pricing
-- models: Protect Ride is a flat+per-km fare with the vehicle bundled
-- in (no hourly agent rate at all), Escort/Hourly stay hourly-agent-rate
-- services with an optional separate vehicle line. Both models now
-- expose a `labor_component` — the part of the price that belongs to
-- the agent's 55% share (v2.3 §23), explicitly excluding vehicle cost
-- and the platform fee ("vehiculul și taxa de platformă revin firmei").

alter table public.quotes
  add column labor_component numeric(10, 2) not null default 0,
  add column kind text not null default 'initial' check (kind in ('initial', 'overage', 'final'));

comment on column public.quotes.kind is
  'initial = at booking time; overage = an additional-hours request mid-mission (own PaymentIntent, own client confirmation); final = recomputed at completion from real duration, used only to determine the capture amount on the ORIGINAL authorization (capped at it — see complete_mission()).';

create or replace function public.compute_quote(
  p_service_key text,
  p_city text,
  p_agent_count int,
  p_hours numeric,
  p_km numeric,
  p_mobility text,
  p_night boolean default false,
  p_weekend boolean default false,
  p_urgent boolean default false
) returns jsonb
language plpgsql
stable
as $$
declare
  cfg public.pricing_config%rowtype;
  v_hours numeric;
  v_normal_hours numeric;
  v_discounted_hours numeric;
  v_coef numeric;
  v_labor_cost numeric;
  v_base_cost numeric;
  v_distance_cost numeric;
  v_adjustment numeric;
  v_vehicle_cost numeric := 0;
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
  v_lines jsonb := '[]'::jsonb;
begin
  select pc.* into cfg
  from public.pricing_config pc
  join public.services s on s.id = pc.service_id
  where s.key = p_service_key and pc.city = p_city;

  if not found then
    raise exception 'no pricing config for service % in city %', p_service_key, p_city;
  end if;

  -- v2.3 §21: multiplicative, capped at coef_cap (1.5) total.
  v_coef := least(
    coalesce(cfg.coef_cap, 1.5),
    1.0
      * (case when p_night then cfg.coef_night else 1.0 end)
      * (case when p_weekend then cfg.coef_weekend else 1.0 end)
      * (case when p_urgent then cfg.coef_urgent else 1.0 end)
  );

  if p_service_key = 'protect_ride' then
    -- Flat base + per-km (v2.3 §16); vehicle bundled in (§19) — no
    -- hourly agent/vehicle lines for this service at all.
    v_base_cost := round(cfg.base * v_coef, 2);
    v_lines := v_lines || jsonb_build_object('label', 'base', 'amount', v_base_cost);

    v_distance_cost := 0;
    if p_km is not null and p_km > 0 then
      v_distance_cost := round(p_km * cfg.per_km * v_coef, 2);
      v_lines := v_lines || jsonb_build_object('label', 'distance', 'amount', v_distance_cost);
    end if;

    v_labor_cost := v_base_cost + v_distance_cost;

    if cfg.minimum_total is not null and v_labor_cost < cfg.minimum_total then
      v_adjustment := round(cfg.minimum_total - v_labor_cost, 2);
      v_lines := v_lines || jsonb_build_object('label', 'minimum_adjustment', 'amount', v_adjustment);
      v_labor_cost := cfg.minimum_total;
    end if;
  else
    -- Escort / Hourly: hourly agent rate, degressive beyond the
    -- threshold (v2.3 §17-18), optional separate protego_vehicle line.
    v_hours := greatest(coalesce(p_hours, 0), cfg.min_billing_hours);
    v_normal_hours := least(v_hours, coalesce(cfg.degressive_threshold_hours, v_hours));
    v_discounted_hours := greatest(0, v_hours - coalesce(cfg.degressive_threshold_hours, v_hours));

    v_labor_cost := round(
      p_agent_count * cfg.per_hour_agent * v_coef * (v_normal_hours + v_discounted_hours * cfg.degressive_rate),
      2
    );
    v_lines := v_lines || jsonb_build_object('label', 'agent', 'amount', v_labor_cost);

    if p_mobility = 'protego_vehicle' then
      v_vehicle_cost := round(v_hours * cfg.per_hour_vehicle, 2);
      v_lines := v_lines || jsonb_build_object('label', 'vehicle', 'amount', v_vehicle_cost);
    elsif p_mobility = 'client_vehicle' then
      v_lines := v_lines || jsonb_build_object('label', 'client_vehicle', 'amount', 0);
    end if;
  end if;

  v_lines := v_lines || jsonb_build_object('label', 'platform_fee', 'amount', cfg.platform_fee);

  v_subtotal := v_labor_cost + v_vehicle_cost + cfg.platform_fee;
  v_vat := round(v_subtotal * cfg.vat_rate, 2);
  v_lines := v_lines || jsonb_build_object('label', 'vat', 'amount', v_vat);

  v_total := round(v_subtotal + v_vat, 2);

  return jsonb_build_object(
    'lines', v_lines,
    'total', v_total,
    'currency', 'RON',
    'labor_component', v_labor_cost
  );
end;
$$;

-- Overage (audit §4.4, business-rules.md §4): incremental agent hours
-- only — no platform fee, no vehicle recharge, no minimum-billing floor
-- (that only applies to a fresh booking). Mirrors packages/domain's
-- computeOverageQuote() exactly.
create or replace function public.compute_overage_quote(
  p_service_key text,
  p_city text,
  p_agent_count int,
  p_additional_hours numeric,
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
  v_labor_cost numeric;
  v_vat numeric;
  v_total numeric;
  v_lines jsonb := '[]'::jsonb;
begin
  select pc.* into cfg
  from public.pricing_config pc
  join public.services s on s.id = pc.service_id
  where s.key = p_service_key and pc.city = p_city;

  if not found then
    raise exception 'no pricing config for service % in city %', p_service_key, p_city;
  end if;

  v_coef := least(
    coalesce(cfg.coef_cap, 1.5),
    1.0
      * (case when p_night then cfg.coef_night else 1.0 end)
      * (case when p_weekend then cfg.coef_weekend else 1.0 end)
      * (case when p_urgent then cfg.coef_urgent else 1.0 end)
  );

  v_labor_cost := round(p_agent_count * coalesce(cfg.per_hour_agent, 0) * v_coef * greatest(coalesce(p_additional_hours, 0), 0), 2);
  v_lines := v_lines || jsonb_build_object('label', 'overage', 'amount', v_labor_cost);

  v_vat := round(v_labor_cost * cfg.vat_rate, 2);
  v_lines := v_lines || jsonb_build_object('label', 'vat', 'amount', v_vat);

  v_total := round(v_labor_cost + v_vat, 2);

  return jsonb_build_object('lines', v_lines, 'total', v_total, 'currency', 'RON', 'labor_component', v_labor_cost);
end;
$$;

grant execute on function public.compute_quote(text, text, int, numeric, numeric, text, boolean, boolean, boolean)
  to authenticated;
grant execute on function public.compute_overage_quote(text, text, int, numeric, boolean, boolean, boolean)
  to authenticated;

create or replace function public.create_quote_for_mission(p_mission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.missions%rowtype;
  v_service_key text;
  v_when timestamptz;
  v_is_night boolean;
  v_is_weekend boolean;
  v_is_urgent boolean;
  v_result jsonb;
  v_quote_id uuid;
begin
  select * into m from public.missions where id = p_mission_id;
  if not found then
    raise exception 'mission % not found', p_mission_id;
  end if;

  if m.client_id <> auth.uid() and public.current_user_role() not in ('dispatcher', 'admin') then
    raise exception 'only the mission''s own client (or dispatcher/admin) can request a quote for it';
  end if;

  select key into v_service_key from public.services where id = m.service_id;

  v_when := coalesce(m.scheduled_at, now());
  v_is_night := extract(hour from v_when) >= 22 or extract(hour from v_when) < 6;
  v_is_weekend := extract(isodow from v_when) in (6, 7);
  v_is_urgent := m.scheduled_at is null or m.scheduled_at <= now() + interval '30 minutes';

  v_result := public.compute_quote(
    v_service_key, m.city, m.agent_count, coalesce(m.duration_hours, 0), m.distance_km, m.mobility::text,
    v_is_night, v_is_weekend, v_is_urgent
  );

  insert into public.quotes (mission_id, breakdown, total_estimate, currency, labor_component, kind)
  values (
    p_mission_id, v_result -> 'lines', (v_result ->> 'total')::numeric, v_result ->> 'currency',
    (v_result ->> 'labor_component')::numeric, 'initial'
  )
  returning id into v_quote_id;

  return v_quote_id;
end;
$$;

grant execute on function public.create_quote_for_mission(uuid) to authenticated;
