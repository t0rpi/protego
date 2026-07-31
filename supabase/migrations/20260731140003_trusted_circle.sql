-- M6 — trusted circle (design `circle.*`: "Primesc link web cu locatia
-- ta live - manual sau automat la SOS / Walk With Me expirat. Nu au
-- nevoie de aplicatie."). Mirrors M4's mission_share_links mechanism
-- (20260731120002_mission_share_links.sql) — unguessable token,
-- revocable, a single narrow SECURITY DEFINER read path for anon
-- visitors — but keyed by a person (owner_id), not a mission_id, since
-- a Shield share is never mission-scoped.

create table public.shield_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text not null check (length(trim(phone)) > 0),
  app_user_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.shield_contacts enable row level security;

create policy "owner can manage own trusted circle"
  on public.shield_contacts for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.shield_contacts to authenticated;

create table public.shield_share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid not null references public.profiles (id),
  -- set when this link was auto-created by trigger_shield_sos()/the WWM
  -- escalation sweep, so a manually-created "just share with my circle
  -- right now" link (source_event_id null) never expires just because
  -- some unrelated event later resolves.
  source_event_id uuid references public.shield_events (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shield_share_links enable row level security;

create policy "owner can manage own share links"
  on public.shield_share_links for all
  to authenticated
  using (owner_id = auth.uid())
  with check (created_by = auth.uid() and owner_id = auth.uid());

create policy "dispatcher and admin can read all share links"
  on public.shield_share_links for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select, insert, update on public.shield_share_links to authenticated;
-- No delete grant — revocation is a column update (revoked_at), same
-- reasoning as mission_share_links.

-- Live-location pings for an active Shield share, mirroring
-- mission_tracking's shape but keyed by owner_id instead of mission_id
-- (a Shield share is never mission-scoped).
create table public.shield_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  recorded_at timestamptz not null default now()
);

create index shield_locations_owner_recorded_idx on public.shield_locations (owner_id, recorded_at desc);

alter table public.shield_locations enable row level security;

create policy "owner can manage own location pings"
  on public.shield_locations for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert on public.shield_locations to authenticated;

create function public.record_shield_location(p_lat numeric, p_lng numeric)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.shield_locations (owner_id, lat, lng) values (auth.uid(), p_lat, p_lng);
$$;

grant execute on function public.record_shield_location(numeric, numeric) to authenticated;

-- Internal helper (not granted to authenticated — only called from
-- other SECURITY DEFINER functions) — returns the token of an existing
-- still-valid link tied to this exact event if one already exists,
-- otherwise creates one. Used by trigger_shield_sos() (M6) and, once
-- written, the Walk With Me escalation sweep, so "auto-share on SOS /
-- WWM expiry" (repository-audit.md Sec5.2, circle.intro) never
-- silently creates duplicate links for the same event.
create function public.ensure_shield_share_link(p_owner_id uuid, p_source_event_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_source_event_id is not null then
    select token into v_token
    from public.shield_share_links
    where owner_id = p_owner_id and source_event_id = p_source_event_id and revoked_at is null;

    if v_token is not null then
      return v_token;
    end if;
  end if;

  insert into public.shield_share_links (owner_id, created_by, source_event_id)
  values (p_owner_id, p_owner_id, p_source_event_id)
  returning token into v_token;

  return v_token;
end;
$$;

-- Client-initiated "share my location with my circle right now" (design
-- `circle.sendLink`) — independent of any SOS/WWM event
-- (source_event_id stays null), gated the same as the other standalone
-- Shield entry points.
create function public.create_shield_share_link()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_shield_public_enabled() then
    raise exception 'Shield is not yet publicly activated (M6 gate)';
  end if;

  return public.ensure_shield_share_link(auth.uid(), null);
end;
$$;

grant execute on function public.create_shield_share_link() to authenticated;

-- The ONLY read path for this data as an unauthenticated visitor —
-- same minimal-disclosure principle as get_shared_mission_status()
-- (M4): owner's first name, the linked event's status if any, and the
-- latest location ping while the link is still valid. A link tied to
-- a resolved/cancelled event is treated as expired; a manually-created
-- link (no source event) stays valid until explicitly revoked.
create function public.get_shared_shield_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.shield_share_links%rowtype;
  v_event public.shield_events%rowtype;
  v_owner_name text;
  v_position jsonb;
begin
  select * into v_link from public.shield_share_links where token = p_token;
  if not found or v_link.revoked_at is not null then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_link.source_event_id is not null then
    select * into v_event from public.shield_events where id = v_link.source_event_id;
    if found and v_event.status in ('resolved', 'cancelled_false_alarm') then
      return jsonb_build_object('status', 'expired');
    end if;
  end if;

  select full_name into v_owner_name from public.profiles where id = v_link.owner_id;

  select jsonb_build_object('lat', lat, 'lng', lng, 'recorded_at', recorded_at)
    into v_position
  from public.shield_locations
  where owner_id = v_link.owner_id
  order by recorded_at desc
  limit 1;

  return jsonb_build_object(
    'status', 'active',
    'owner_name', v_owner_name,
    'event_type', v_event.event_type,
    'event_status', v_event.status,
    'position', v_position
  );
end;
$$;

grant execute on function public.get_shared_shield_status(text) to anon, authenticated;
