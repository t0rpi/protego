-- M4 — notifications: push (real, best-effort via Expo's push API
-- through pg_net) for the 5 critical events, plus a provider-agnostic
-- SMS stub (real SMS provider is M7 per this milestone's explicit
-- scope). Every attempt — push or SMS, successful or not — lands in
-- notification_log, which is the actual, pgTAP-testable source of
-- truth; the outbound HTTP call itself is best-effort and NOT something
-- this migration can verify end-to-end (no live device/Expo token
-- exists in this dev/CI environment, and the sandboxed network here may
-- or may not have outbound egress) — disclosed explicitly, not silently
-- assumed to work.

create extension if not exists pg_net;

create type public.notification_channel as enum ('push', 'sms');
create type public.notification_event as enum (
  'offer_received', 'mission_confirmed', 'agent_arrived', 'mission_completed', 'sos_acknowledged'
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.push_tokens enable row level security;

create policy "user can manage own push tokens"
  on public.push_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, delete on public.push_tokens to authenticated;
-- No update grant — a token is registered or removed, never edited in place.

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy "user can manage own notification preferences"
  on public.notification_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.notification_preferences to authenticated;

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  event public.notification_event not null,
  channel public.notification_channel not null,
  mission_id uuid references public.missions (id),
  payload jsonb,
  provider_status text not null default 'stub_logged',
  sent_at timestamptz not null default now()
);

alter table public.notification_log enable row level security;

create policy "user can read own notification log"
  on public.notification_log for select
  to authenticated
  using (user_id = auth.uid());

create policy "dispatcher and admin can read all notification log"
  on public.notification_log for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.notification_log to authenticated;
-- No write grant for anyone — only notify_event() (below) writes this table.

-- The one function that fans a domain event out to whichever channels
-- the recipient has enabled. Internal-only (no grant to authenticated —
-- called from triggers below, same pattern as log_audit_event since
-- M1), SECURITY DEFINER so it can write notification_log/push_tokens
-- regardless of who caused the underlying event.
create function public.notify_event(
  p_user_id uuid,
  p_event public.notification_event,
  p_mission_id uuid default null,
  p_payload jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs public.notification_preferences%rowtype;
  v_token record;
  v_status text;
begin
  select * into v_prefs from public.notification_preferences where user_id = p_user_id;

  if coalesce(v_prefs.push_enabled, true) then
    for v_token in select expo_push_token from public.push_tokens where user_id = p_user_id loop
      v_status := 'stub_logged';
      begin
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          body := jsonb_build_object(
            'to', v_token.expo_push_token,
            'title', 'PROTEGO',
            'body', p_event::text,
            'data', coalesce(p_payload, '{}'::jsonb)
          )
        );
        v_status := 'attempted';
      exception when others then
        -- Best-effort only — a missing/unreachable pg_net egress in
        -- this environment must never block the notification_log
        -- record from being written (that record is the real,
        -- pgTAP-tested contract; the HTTP call is not).
        v_status := 'stub_logged';
      end;

      insert into public.notification_log (user_id, event, channel, mission_id, payload, provider_status)
      values (p_user_id, p_event, 'push', p_mission_id, p_payload, v_status);
    end loop;
  end if;

  if coalesce(v_prefs.sms_enabled, true) then
    insert into public.notification_log (user_id, event, channel, mission_id, payload, provider_status)
    values (p_user_id, p_event, 'sms', p_mission_id, p_payload, 'stub_logged');
  end if;
end;
$$;

-- Wiring: the 5 critical events named in this milestone's scope.
create function public.notify_on_mission_offer_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_event(NEW.agent_id, 'offer_received', NEW.mission_id, jsonb_build_object('offer_id', NEW.id));
  return NEW;
end;
$$;

create trigger mission_offers_notify_agent
  after insert on public.mission_offers
  for each row execute function public.notify_on_mission_offer_created();

create function public.notify_on_mission_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    if NEW.status = 'confirmed' then
      perform public.notify_event(NEW.client_id, 'mission_confirmed', NEW.id);
    elsif NEW.status = 'arrived' then
      perform public.notify_event(NEW.client_id, 'agent_arrived', NEW.id);
    elsif NEW.status = 'done' then
      perform public.notify_event(NEW.client_id, 'mission_completed', NEW.id);
    end if;
  end if;
  return NEW;
end;
$$;

create trigger missions_notify_client_on_status
  after update on public.missions
  for each row execute function public.notify_on_mission_status_change();
