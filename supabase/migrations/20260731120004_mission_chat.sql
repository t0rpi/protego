-- M4 — mission chat (design `chat.*`: "Conversație monitorizată de
-- dispecerat. Numerele de telefon rămân ascunse"). Participants are
-- the mission's client and its currently-assigned agent; dispatcher/
-- admin can read (monitored) but never post as a participant.
--
-- Retention: compliance-checklist.md §3 states the exact retention
-- period is NOT confirmed by legal ("valoarea exactă... de propus și
-- confirmat"). platform_settings below holds a disclosed, editable
-- placeholder (90 days) — same treatment as pricing_config's
-- unconfirmed values — with NO deletion job wired yet (explicitly out
-- of scope this milestone; the number exists so a future retention job
-- has somewhere real to read from, not as a working guarantee today).

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

create policy "authenticated can read platform settings"
  on public.platform_settings for select
  to authenticated
  using (true);

create policy "admin can manage platform settings"
  on public.platform_settings for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select on public.platform_settings to authenticated;
grant insert, update, delete on public.platform_settings to authenticated;

insert into public.platform_settings (key, value) values
  ('chat_retention_days', '90'::jsonb)
on conflict (key) do nothing;

comment on table public.platform_settings is
  'chat_retention_days is a disclosed placeholder pending legal confirmation (compliance-checklist.md §3) — no deletion job reads it yet.';

create table public.mission_chat_messages (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (length(body) > 0),
  created_at timestamptz not null default now()
);

create index mission_chat_messages_mission_id_created_at_idx
  on public.mission_chat_messages (mission_id, created_at);

alter table public.mission_chat_messages enable row level security;

create policy "mission participants can read own mission chat"
  on public.mission_chat_messages for select
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
    or exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = mission_chat_messages.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  );

create policy "mission participants can send own mission chat"
  on public.mission_chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
      or exists (
        select 1 from public.mission_offers mo
        where mo.mission_id = mission_chat_messages.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
      )
    )
  );

create policy "dispatcher and admin can read all mission chat"
  on public.mission_chat_messages for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select, insert on public.mission_chat_messages to authenticated;
-- No update/delete grant — messages are a fixed record once sent, same
-- chain-of-custody reasoning as incident_reports (M3).

-- Masked-calling intent log (design `tracking.maskedCall`: "Apel mascat
-- prin dispecerat — numerele nu se văd reciproc"). A STUB behind this
-- table: no real telephony provider is wired (M7 config swap per the
-- milestone scope) — every "call" the app offers today just logs who
-- intended to call whom, about which mission, so the dispatcher
-- playbook's "apel cu un click" and the client/agent "Sună" action both
-- have a real, auditable record even though no call is actually placed.
create table public.call_intents (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.missions (id) on delete cascade,
  shield_event_id uuid, -- FK added in 20260731120006 once shield_events exists
  initiated_by uuid not null references public.profiles (id),
  target_user_id uuid references public.profiles (id),
  purpose text not null check (purpose in ('mission_call', 'sos_call', 'high_risk_review_call')),
  created_at timestamptz not null default now()
);

alter table public.call_intents enable row level security;

create policy "participants can read own call intents"
  on public.call_intents for select
  to authenticated
  using (
    initiated_by = auth.uid()
    or target_user_id = auth.uid()
    or public.current_user_role() in ('dispatcher', 'admin')
  );

create policy "authenticated can log own call intent"
  on public.call_intents for insert
  to authenticated
  with check (initiated_by = auth.uid());

grant select, insert on public.call_intents to authenticated;
