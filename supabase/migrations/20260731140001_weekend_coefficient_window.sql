-- M6 housekeeping — fixes a real bug found while implementing Shield:
-- v2.3 §21 defines the weekend surcharge window as "Fri 20:00 -> Sun
-- 24:00", but create_quote_for_mission() and request_mission_overage()
-- (both from M5, 20260731130002/130003) only ever checked
-- extract(isodow from v_when) in (6, 7) — Saturday/Sunday only, missing
-- the Friday-evening portion of the window entirely. compute_quote()/
-- compute_overage_quote() themselves were never wrong — they just
-- multiply whatever p_weekend boolean they're handed by coef_weekend;
-- the bug was purely in how that boolean got computed from a real
-- timestamp, in exactly two call sites.
--
-- Extracted into one function so the two call sites can never drift
-- apart again the way they just did.
create function public.is_weekend_pricing_window(p_when timestamptz)
returns boolean
language sql
immutable
as $$
  select
    (extract(isodow from p_when) = 5 and extract(hour from p_when) >= 20)
    or extract(isodow from p_when) in (6, 7);
$$;

comment on function public.is_weekend_pricing_window(timestamptz) is
  'v2.3 Sec21: the weekend coefficient window is Friday 20:00 through Sunday 24:00 (isodow 5>=20h, or isodow 6/7 all day) — not just Sat/Sun.';

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
  v_is_weekend := public.is_weekend_pricing_window(v_when);
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

create or replace function public.request_mission_overage(p_mission_id uuid, p_additional_hours numeric)
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
    public.is_weekend_pricing_window(now()),
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

grant execute on function public.is_weekend_pricing_window(timestamptz) to authenticated;
