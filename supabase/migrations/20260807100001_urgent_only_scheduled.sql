-- P1b pricing decision (founder, 2026-08-07, option B): on-demand
-- "Acum" bookings (scheduled_at is null) must charge the listed price
-- with no urgency surcharge at all -- the coef_urgent (x1.2) multiplier
-- applies ONLY to a SCHEDULED booking placed less than 30 minutes
-- before its own start time. The previous logic did the opposite: it
-- treated "no scheduled_at" (i.e. every on-demand booking) as urgent
-- unconditionally, which silently charged every immediate booking
-- 20% above the listed price -- v_when's night/weekend derivation is
-- unaffected and correctly stays coalesce(scheduled_at, now()).
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
  -- P1b: only a scheduled booking placed <30min before its own start
  -- counts as urgent. "Acum" (scheduled_at is null) never does.
  v_is_urgent := m.scheduled_at is not null and m.scheduled_at <= now() + interval '30 minutes';

  v_result := public.compute_quote(
    v_service_key, m.city, m.agent_count, coalesce(m.duration_hours, 0), m.distance_km, m.mobility::text,
    v_is_night, v_is_weekend, v_is_urgent,
    coalesce(m.wait_at_destination_minutes, 0), coalesce(m.accompany_inside_minutes, 0)
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
