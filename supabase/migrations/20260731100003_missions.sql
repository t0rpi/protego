-- M2 — missions: the state machine that is the spine of the system.
-- Canonical status list matches packages/domain/src/missions/status.ts
-- exactly (MISSION_STATUSES) and docs/architecture/repository-audit.md
-- §3.4. Only the M2-relevant transitions (draft..confirmed, plus client
-- cancellation) are guarded here — M3/M4/M5 extend
-- enforce_mission_transition() in their own migrations as they add
-- assigned/enroute/arrived/active/done. Any transition not explicitly
-- allowed is rejected by default (see the trigger's final `else`).

create type public.mission_status as enum (
  'draft', 'quoted', 'review', 'confirmed', 'assigned', 'enroute', 'arrived', 'active', 'done',
  'cancelled_client', 'cancelled_agent', 'cancelled_dispatcher', 'no_agent_available'
);

create type public.mission_mobility as enum ('protego_vehicle', 'client_vehicle', 'on_foot');
create type public.mission_agent_preference as enum ('any', 'female', 'male');
create type public.mission_dress_code as enum ('formal', 'casual', 'discreet');
create type public.mission_context_kind as enum ('usual', 'stranger', 'atm', 'club');

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  protected_person_id uuid references public.protected_persons (id),
  service_id uuid not null references public.services (id),
  city text not null,

  status public.mission_status not null default 'draft',

  -- "unde" / "când" (MASTERPROMPT §5A, booking step 2-3)
  pickup_address text,
  destination_address text, -- Protect Ride only
  scheduled_at timestamptz, -- null = "acum"

  -- "echipa" (step 5)
  agent_count smallint not null default 1 check (agent_count >= 1),
  agent_preference public.mission_agent_preference not null default 'any',
  dress_code public.mission_dress_code not null default 'casual',

  -- "mobilitate" (step 6)
  mobility public.mission_mobility not null default 'on_foot',

  -- duration/distance estimates feeding the quote
  duration_hours numeric(4, 2),
  distance_km numeric(6, 2), -- Protect Ride only

  -- "chestionar context" (step 7) — risk_level is NEVER trusted from the
  -- client; a BEFORE trigger below recomputes it from the raw answers
  -- every time, so a client cannot self-report "normal" while admitting
  -- a known threat (business-rules.md §6; the *decision itself* — 2-3
  -- answers -> flag — mirrors packages/domain's computeRiskLevel()).
  context_threat_known boolean not null default false,
  context_kind public.mission_context_kind not null default 'usual',
  context_details text,
  risk_level text not null default 'normal' check (risk_level in ('normal', 'high')),

  -- system-generated, never client-settable (see trigger below)
  verification_code char(4),

  -- M2 payment is a stub (no Stripe until M5) — this is the one field the
  -- quoted->confirmed guard checks in place of a real preauthorization.
  payment_stub_confirmed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.missions is
  'The state machine spine (repository-audit.md §3.4). Status transitions are guarded by enforce_mission_transition(), not just RLS — a client can never write their way past a guard by having UPDATE access to their own row.';

create trigger missions_set_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

-- Recompute risk_level from the raw questionnaire answers on every
-- write, regardless of what the client sent for that column — mirrors
-- packages/domain's computeRiskLevel() (hasKnownThreat -> 'high',
-- everything else -> 'normal'; context_kind is agent-routing
-- information, not itself a risk trigger — see that module's doc
-- comment for the reasoning).
create or replace function public.derive_mission_risk_level()
returns trigger
language plpgsql
as $$
begin
  new.risk_level := case when new.context_threat_known then 'high' else 'normal' end;
  return new;
end;
$$;

create trigger missions_derive_risk_level
  before insert or update on public.missions
  for each row execute function public.derive_mission_risk_level();

-- 4-digit verification code, always system-generated at insert —
-- unconditionally overwritten so a client can never pick their own code
-- (e.g. "0000"), which would defeat its purpose entirely.
create or replace function public.generate_mission_verification_code()
returns trigger
language plpgsql
as $$
begin
  new.verification_code := lpad(floor(random() * 10000)::text, 4, '0');
  return new;
end;
$$;

create trigger missions_generate_verification_code
  before insert on public.missions
  for each row execute function public.generate_mission_verification_code();

-- The state machine guard. Every transition not explicitly listed here
-- is rejected — safer default than an allow-list that silently grows
-- stale as milestones add states this migration doesn't know about yet.
create or replace function public.enforce_mission_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification_level smallint;
  v_checklist_ok boolean;
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then

    if OLD.status = 'draft' and NEW.status = 'quoted' then
      if NEW.service_id is null or NEW.mobility is null or NEW.city is null then
        raise exception 'mission incomplete: service, mobility and city are required before quoting';
      end if;

      if not exists (
        select 1 from public.service_city_status scs
        where scs.service_id = NEW.service_id and scs.city = NEW.city and scs.enabled
      ) then
        raise exception 'this service is not enabled in city % (catalog on/off switch)', NEW.city;
      end if;

    elsif OLD.status = 'quoted' and NEW.status = 'review' then
      if NEW.risk_level <> 'high' then
        raise exception 'quoted -> review is only for high-risk missions (risk_level=%)', NEW.risk_level;
      end if;

    elsif OLD.status = 'quoted' and NEW.status = 'confirmed' then
      if NEW.risk_level <> 'normal' then
        raise exception 'high-risk missions cannot confirm directly — must go through review (risk_level=%)', NEW.risk_level;
      end if;

      select verification_level into v_verification_level from public.profiles where id = NEW.client_id;
      if coalesce(v_verification_level, 1) < 2 then
        raise exception 'client verification_level must be 2 to confirm a mission (acceptance-tests.md M1/M2)';
      end if;

      if NEW.mobility = 'client_vehicle' then
        select
          c.consent_signed_at is not null
          and c.insurance_confirmed
          and c.client_signature_at is not null
          into v_checklist_ok
        from public.mission_vehicle_checklists c
        where c.mission_id = NEW.id;

        if not coalesce(v_checklist_ok, false) then
          raise exception 'client-vehicle checklist incomplete (consent + insurance + signature required before payment step)';
        end if;
      end if;

      if not NEW.payment_stub_confirmed then
        raise exception 'payment step not completed';
      end if;

    elsif OLD.status = 'review' and NEW.status = 'confirmed' then
      if public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only a dispatcher or admin can confirm a high-risk mission — never automatic (business-rules.md §6)';
      end if;

      select verification_level into v_verification_level from public.profiles where id = NEW.client_id;
      if coalesce(v_verification_level, 1) < 2 then
        raise exception 'client verification_level must be 2 to confirm a mission';
      end if;

    elsif OLD.status = 'review' and NEW.status = 'cancelled_dispatcher' then
      if public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only a dispatcher or admin can decline a high-risk mission';
      end if;

    elsif NEW.status = 'cancelled_client' and OLD.status in ('draft', 'quoted', 'review', 'confirmed') then
      if NEW.client_id <> auth.uid() and public.current_user_role() not in ('dispatcher', 'admin') then
        raise exception 'only the mission''s own client (or dispatcher/admin) can cancel it';
      end if;

    else
      raise exception 'mission transition % -> % is not allowed (or not implemented yet)', OLD.status, NEW.status;
    end if;

  end if;

  return NEW;
end;
$$;

create trigger missions_enforce_transition
  before insert or update on public.missions
  for each row execute function public.enforce_mission_transition();

alter table public.missions enable row level security;

create policy "client can read own missions"
  on public.missions for select
  to authenticated
  using (client_id = auth.uid());

create policy "client can insert own missions"
  on public.missions for insert
  to authenticated
  with check (client_id = auth.uid());

create policy "client can update own missions"
  on public.missions for update
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy "dispatcher and admin can read all missions"
  on public.missions for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

create policy "dispatcher and admin can update all missions"
  on public.missions for update
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'))
  with check (public.current_user_role() in ('dispatcher', 'admin'));

grant select, insert on public.missions to authenticated;
-- Column-restricted update: excludes verification_code (system-
-- generated, see generate_mission_verification_code()), risk_level
-- (always recomputed by derive_mission_risk_level() regardless, but
-- excluded here too as defense in depth), client_id (ownership must
-- never change) and the id/timestamp columns. Everything a client
-- legitimately fills in during booking — including `status`, whose
-- actual transition legality is enforced by
-- enforce_mission_transition(), not by this grant — stays writable.
grant update (
  service_id, city, pickup_address, destination_address, scheduled_at,
  agent_count, agent_preference, dress_code, mobility,
  duration_hours, distance_km,
  context_threat_known, context_kind, context_details,
  status, payment_stub_confirmed
) on public.missions to authenticated;
-- No delete grant for anyone — missions are cancelled, never deleted
-- (audit trail / chain of custody, consistent with agent_documents etc.)
