-- M3 — agents extensions: availability toggle + the onboarding status
-- transition guard promised (but deferred) in
-- 20260724140004_agents_and_documents.sql, plus the document-expiry
-- check used by the offer/mission-start gates this milestone adds.
-- Source: docs/product/supply-model.md §2; repository-audit.md §6.

alter table public.agents
  add column is_available boolean not null default false;

comment on column public.agents.is_available is
  'Agent-controlled on/off switch (agentApp.available/unavailable). Only meaningful when status=active — an agent that is not active cannot receive offers regardless of this flag (see create_mission_offer()).';

-- Agents flip their own availability; nothing else about their own row
-- (status, rating, badges, source) is meant to be self-service.
create policy "agent can update own availability"
  on public.agents for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant update (is_available) on public.agents to authenticated;

-- The column grant above is narrow, but 20260724140006_grants.sql
-- already gave `authenticated` a BROAD (all-columns) update grant on
-- this table for the dispatcher/admin status-change use case. Since
-- both that role and the agent-self policy just added share the same
-- Postgres role, and RLS policies are OR'd together for row access
-- without themselves restricting which granted columns get touched, an
-- agent's session passing "agent can update own availability" could
-- otherwise also rewrite status/rating/badges/source on their own row.
-- Same gap, same fix pattern used throughout this milestone (missions,
-- mission_vehicle_checklists): a trigger comparing OLD/NEW is the real
-- column boundary, not the grant.
create function public.enforce_agent_column_ownership()
returns trigger
language plpgsql
as $$
begin
  if public.current_user_role() in ('dispatcher', 'admin') then
    return NEW;
  end if;

  if NEW.status is distinct from OLD.status
     or NEW.rating is distinct from OLD.rating
     or NEW.badges is distinct from OLD.badges
     or NEW.source is distinct from OLD.source
  then
    raise exception 'an agent may only update their own is_available column';
  end if;

  return NEW;
end;
$$;

create trigger agents_enforce_column_ownership
  before update on public.agents
  for each row execute function public.enforce_agent_column_ownership();

-- Whether an agent has ANY document that has already expired. Internal
-- helper only (no grant to authenticated) — called from
-- create_mission_offer() and start_mission_protection(), both
-- SECURITY DEFINER, same pattern as log_audit_event() in
-- 20260724140002_audit_log.sql. Deliberately checked live at the two
-- points that matter (offer creation, mission start) rather than via a
-- scheduled job flipping agents.status — that would leave a lag window
-- between a document expiring and the agent actually being blocked;
-- checking live has none. An agent with zero documents on file is not
-- treated as "expired" by this function (that is an onboarding-
-- completeness question, not this milestone's concern).
create function public.agent_has_no_expired_documents(p_agent_id uuid)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.agent_documents
    where agent_id = p_agent_id
      and expires_at is not null
      and expires_at < current_date
  );
$$;

-- Onboarding state machine: in_review -> approved -> active, no skipping
-- (acceptance-tests.md M3). Identity/role checks are already handled by
-- the existing "dispatcher and admin can update agent status" RLS
-- policy — this trigger only enforces transition ORDER, same division
-- of responsibility as enforce_mission_transition(). "blocked" is
-- reachable from approved/active (dispatcher decision, e.g. expired
-- documents surfaced to them, or misconduct) or as a rejection straight
-- out of in_review; recovery from blocked returns to "approved" (a
-- dispatcher must re-confirm readiness), never straight back to
-- "active" — this mirrors "no skipping" applying to reinstatement too.
create function public.enforce_agent_status_transition()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then

    if OLD.status = 'in_review' and NEW.status in ('approved', 'blocked') then
      null;
    elsif OLD.status = 'approved' and NEW.status in ('active', 'blocked') then
      null;
    elsif OLD.status = 'active' and NEW.status = 'blocked' then
      null;
    elsif OLD.status = 'blocked' and NEW.status = 'approved' then
      null;
    else
      raise exception 'agent status transition % -> % is not allowed (or not implemented yet)', OLD.status, NEW.status;
    end if;

  end if;

  return NEW;
end;
$$;

create trigger agents_enforce_status_transition
  before update on public.agents
  for each row execute function public.enforce_agent_status_transition();
