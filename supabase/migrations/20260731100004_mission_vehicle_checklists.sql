-- M2 — mission_vehicle_checklists: the client-vehicle rule
-- (business-rules.md §5). Split deliberately into two phases:
--
--   1. Client-provided, at booking time (M2): consent + insurance
--      confirmation + signature. This is what gates quoted->confirmed
--      (missions.sql's enforce_mission_transition()) — a client cannot
--      reach the payment step with "vehiculul meu" selected without
--      these three.
--   2. Agent-provided, at mission start (M3, not built here): the
--      actual photo checklist (front/back/left/right/km/fuel — 6
--      photos per design/HANDOFF.md's agentApp.photo* strings) happens
--      when the agent arrives, gating arrived->active, not
--      quoted->confirmed — a photo of the car cannot exist before an
--      agent has been assigned to it, which isn't possible until M3.
--      The `photos` column exists now (schema-ready) but stays empty
--      through M2; M3/M4 adds both the upload flow and the
--      arrived->active guard that checks it.

create table public.mission_vehicle_checklists (
  mission_id uuid primary key references public.missions (id) on delete cascade,
  consent_signed_at timestamptz,
  insurance_confirmed boolean not null default false,
  client_signature_at timestamptz,
  photos jsonb not null default '{}'::jsonb, -- populated at M3: {front,back,left,right,km,fuel: storage path}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mission_vehicle_checklists_set_updated_at
  before update on public.mission_vehicle_checklists
  for each row execute function public.set_updated_at();

alter table public.mission_vehicle_checklists enable row level security;

create policy "client can insert own mission's checklist"
  on public.mission_vehicle_checklists for insert
  to authenticated
  with check (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "client can read own mission's checklist"
  on public.mission_vehicle_checklists for select
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "client can update own mission's checklist"
  on public.mission_vehicle_checklists for update
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  )
  with check (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "dispatcher and admin can read all checklists"
  on public.mission_vehicle_checklists for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select, insert on public.mission_vehicle_checklists to authenticated;
-- Column-restricted update: the client may only set the three fields
-- that are legitimately theirs to provide at booking time. `photos` is
-- agent-side (M3) and gets its own grant/policy when that milestone
-- builds the upload flow — not exposed to the client role at all today.
grant update (consent_signed_at, insurance_confirmed, client_signature_at)
  on public.mission_vehicle_checklists to authenticated;
