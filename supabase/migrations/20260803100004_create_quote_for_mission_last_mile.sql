-- Pass the new last-mile mission fields into compute_quote().
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
    v_is_night, v_is_weekend, v_is_urgent,
    coalesce(m.wait_at_destination_minutes, 0), m.accompany_inside_requested
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
