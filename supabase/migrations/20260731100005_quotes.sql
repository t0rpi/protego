-- M2 — quotes: the price breakdown shown to the client before
-- confirmation (business-rules.md §2 — "defalcată pe componente,
-- niciodată o sumă globală opacă"). Rows are written EXCLUSIVELY by
-- create_quote_for_mission() (SECURITY DEFINER), which itself calls
-- compute_quote() — a client can never submit their own total_estimate
-- or breakdown; both are always computed server-side from
-- pricing_config, matching the acceptance test's "no hardcoded prices"
-- requirement in a way RLS alone can't guarantee (RLS restricts rows,
-- not whether a number was honestly computed).

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  breakdown jsonb not null, -- [{label, amount}, ...] — RowLine[] per design/HANDOFF.md §3
  total_estimate numeric(10, 2) not null,
  currency text not null default 'RON',
  created_at timestamptz not null default now()
);

alter table public.quotes enable row level security;

create policy "client can read own mission's quotes"
  on public.quotes for select
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "dispatcher and admin can read all quotes"
  on public.quotes for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.quotes to authenticated;
-- Deliberately no insert/update/delete grant for anyone — only the
-- SECURITY DEFINER function below writes this table.

-- The pricing engine, authoritative version. packages/domain's TS
-- pricing module mirrors this exact formula for a live client-side
-- preview as the booking form is filled in, but the row that actually
-- gets stored (and the mission confirmation gate) only ever trusts
-- this function's own computation, never a client-submitted number.
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
  v_agent_cost numeric;
  v_vehicle_cost numeric := 0;
  v_distance_cost numeric := 0;
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

  v_hours := greatest(coalesce(p_hours, 0), cfg.min_billing_hours);
  v_normal_hours := least(v_hours, coalesce(cfg.degressive_threshold_hours, v_hours));
  v_discounted_hours := greatest(0, v_hours - coalesce(cfg.degressive_threshold_hours, v_hours));

  v_coef := 1.0
    * (case when p_night then cfg.coef_night else 1.0 end)
    * (case when p_weekend then cfg.coef_weekend else 1.0 end)
    * (case when p_urgent then cfg.coef_urgent else 1.0 end);

  v_agent_cost := round(
    p_agent_count * cfg.per_hour_agent * v_coef * (v_normal_hours + v_discounted_hours * cfg.degressive_rate),
    2
  );
  v_lines := v_lines || jsonb_build_object('label', 'agent', 'amount', v_agent_cost);

  if p_mobility = 'protego_vehicle' then
    v_vehicle_cost := round(v_hours * cfg.per_hour_vehicle, 2);
    v_lines := v_lines || jsonb_build_object('label', 'vehicle', 'amount', v_vehicle_cost);
  elsif p_mobility = 'client_vehicle' then
    v_lines := v_lines || jsonb_build_object('label', 'client_vehicle', 'amount', 0);
  end if;

  if p_service_key = 'protect_ride' and p_km is not null and p_km > 0 then
    v_distance_cost := round(p_km * cfg.per_km, 2);
    v_lines := v_lines || jsonb_build_object('label', 'distance', 'amount', v_distance_cost);
  end if;

  v_lines := v_lines || jsonb_build_object('label', 'platform_fee', 'amount', cfg.platform_fee);

  v_subtotal := v_agent_cost + v_vehicle_cost + v_distance_cost + cfg.platform_fee;
  v_vat := round(v_subtotal * cfg.vat_rate, 2);
  v_lines := v_lines || jsonb_build_object('label', 'vat', 'amount', v_vat);

  v_total := round(v_subtotal + v_vat, 2);

  return jsonb_build_object('lines', v_lines, 'total', v_total, 'currency', 'RON');
end;
$$;

grant execute on function public.compute_quote(text, text, int, numeric, numeric, text, boolean, boolean, boolean)
  to authenticated;

-- Night/weekend/urgent are derived from the mission's own scheduled_at
-- (or "now" if booking immediately) — never client-supplied booleans,
-- so a client can't just claim off-peak pricing.
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

  insert into public.quotes (mission_id, breakdown, total_estimate, currency)
  values (p_mission_id, v_result -> 'lines', (v_result ->> 'total')::numeric, v_result ->> 'currency')
  returning id into v_quote_id;

  return v_quote_id;
end;
$$;

grant execute on function public.create_quote_for_mission(uuid) to authenticated;
