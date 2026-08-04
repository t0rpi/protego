-- v2.4 pricing clarifications (founder + coordinator, 2026-08-04):
-- 1. Accompany-inside is now duration-based: flat fee covers the first
--    accompany_inside_included_minutes, then wait_per_minute_rate per
--    minute beyond that (reuses the wait rate, no new rate column).
--    accompany_inside_hourly_threshold_minutes (45) is a client-facing
--    suggestion only -- it does not change this computation.
-- 2. Escort/Hourly protego_vehicle: per_hour_vehicle includes
--    vehicle_included_km_per_hour km of driving per billed hour;
--    beyond that, vehicle_km_surcharge_rate per km (own line, only
--    when it actually applies). Vehicle cost/surcharge stays outside
--    labor_component (vehicle revenue is the company's, v2.3 SS19/23).
-- 3. Platform fee for Escort/Hourly is max(platform_fee,
--    platform_fee_per_hour * billed hours) -- flat up to ~4h, scales
--    beyond. Protect Ride has no hours dimension and stays flat.
create or replace function public.compute_quote(
  p_service_key text,
  p_city text,
  p_agent_count int,
  p_hours numeric,
  p_km numeric,
  p_mobility text,
  p_night boolean default false,
  p_weekend boolean default false,
  p_urgent boolean default false,
  p_wait_minutes int default 0,
  p_accompany_minutes int default 0
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
  v_distance_km numeric;
  v_distance_label text;
  v_wait_billable_minutes int;
  v_wait_cost numeric;
  v_accompany_extra_minutes int;
  v_accompany_cost numeric;
  v_adjustment numeric;
  v_vehicle_cost numeric := 0;
  v_included_km numeric;
  v_km_surcharge numeric;
  v_platform_fee numeric;
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
      v_distance_km := p_km;
      v_distance_label := 'distance';
    elsif cfg.default_distance_km is not null then
      -- Client left km blank — fall back to the disclosed placeholder
      -- estimate (20260731160002) rather than charging base-fare-only.
      v_distance_km := cfg.default_distance_km;
      v_distance_label := 'distance_estimated';
    end if;

    if v_distance_km is not null then
      v_distance_cost := round(v_distance_km * cfg.per_km * v_coef, 2);
      v_lines := v_lines || jsonb_build_object('label', v_distance_label, 'amount', v_distance_cost);
    end if;

    -- Last-mile add-ons (2026-08-03/04 founder decisions).
    v_wait_cost := 0;
    v_accompany_cost := 0;

    if cfg.door_to_door_included then
      v_lines := v_lines || jsonb_build_object('label', 'door_to_door_included', 'amount', 0);
    end if;

    if p_wait_minutes is not null and p_wait_minutes > 0 then
      v_wait_billable_minutes := greatest(0, p_wait_minutes - coalesce(cfg.wait_free_minutes, 0));
      v_wait_cost := round(v_wait_billable_minutes * coalesce(cfg.wait_per_minute_rate, 0), 2);
      v_lines := v_lines || jsonb_build_object('label', 'wait_at_destination', 'amount', v_wait_cost);
    end if;

    if p_accompany_minutes is not null and p_accompany_minutes > 0 then
      v_accompany_extra_minutes := greatest(0, p_accompany_minutes - coalesce(cfg.accompany_inside_included_minutes, 0));
      v_accompany_cost := round(
        coalesce(cfg.accompany_inside_fee, 0) + v_accompany_extra_minutes * coalesce(cfg.wait_per_minute_rate, 0),
        2
      );
      v_lines := v_lines || jsonb_build_object('label', 'accompany_inside', 'amount', v_accompany_cost);
    end if;

    v_labor_cost := v_base_cost + v_distance_cost + v_wait_cost + v_accompany_cost;

    if cfg.minimum_total is not null and v_labor_cost < cfg.minimum_total then
      v_adjustment := round(cfg.minimum_total - v_labor_cost, 2);
      v_lines := v_lines || jsonb_build_object('label', 'minimum_adjustment', 'amount', v_adjustment);
      v_labor_cost := cfg.minimum_total;
    end if;

    v_platform_fee := cfg.platform_fee;
  else
    -- Escort / Hourly: hourly agent rate, degressive beyond the
    -- threshold (v2.3 §17-18), optional separate protego_vehicle line.
    -- Last-mile add-ons don't apply here (Protect Ride only).
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

      -- 2026-08-04: km allowance + surcharge, own line, only when it
      -- actually applies.
      if cfg.vehicle_included_km_per_hour is not null and cfg.vehicle_km_surcharge_rate is not null
         and p_km is not null then
        v_included_km := cfg.vehicle_included_km_per_hour * v_hours;
        if p_km > v_included_km then
          v_km_surcharge := round((p_km - v_included_km) * cfg.vehicle_km_surcharge_rate, 2);
          v_vehicle_cost := v_vehicle_cost + v_km_surcharge;
          v_lines := v_lines || jsonb_build_object('label', 'vehicle_km_surcharge', 'amount', v_km_surcharge);
        end if;
      end if;
    elsif p_mobility = 'client_vehicle' then
      v_lines := v_lines || jsonb_build_object('label', 'client_vehicle', 'amount', 0);
    end if;

    -- 2026-08-04: scales past ~4h instead of staying flat (5*4=20,
    -- matches the existing flat floor exactly up to that point).
    v_platform_fee := greatest(cfg.platform_fee, coalesce(cfg.platform_fee_per_hour, 0) * v_hours);
  end if;

  v_lines := v_lines || jsonb_build_object('label', 'platform_fee', 'amount', v_platform_fee);

  v_subtotal := v_labor_cost + v_vehicle_cost + v_platform_fee;
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

-- CREATE OR REPLACE only replaces when the arg-type list matches
-- exactly; p_accompany_minutes int replaces p_accompany_inside
-- boolean, a different type list, so the old 11-arg overload would
-- otherwise linger unused (same lesson as 20260803100005).
drop function if exists public.compute_quote(
  text, text, int, numeric, numeric, text, boolean, boolean, boolean, int, boolean
);
