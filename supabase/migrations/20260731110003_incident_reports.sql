-- M3 — incident_reports: agent-filed incident reports during/after a
-- mission (repository-audit.md §3.4/§6). Evidence is stored as a jsonb
-- array of storage paths — a placeholder shape (M3 scope explicitly
-- says "evidence placeholders"); the upload bucket + real capture flow
-- can be wired without a schema change later.
--
-- Deliberately separate from SOS (M4, realtime) — an incident report is
-- an after/during-the-fact written account routed to dispatch, not a
-- live emergency signal (agentApp.incidentNote: "for immediate danger
-- use the emergency button, not the form").

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  incident_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  description text not null,
  evidence jsonb not null default '[]'::jsonb, -- [{path, uploaded_at}, ...] — placeholder shape
  created_at timestamptz not null default now()
);

alter table public.incident_reports enable row level security;

create policy "agent can insert own incident reports"
  on public.incident_reports for insert
  to authenticated
  with check (
    agent_id = auth.uid()
    and exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = incident_reports.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  );

create policy "agent can read own incident reports"
  on public.incident_reports for select
  to authenticated
  using (agent_id = auth.uid());

create policy "dispatcher and admin can read all incident reports"
  on public.incident_reports for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select, insert on public.incident_reports to authenticated;
-- No update/delete grant for anyone — an incident report, once filed,
-- is a fixed record (chain of custody, same reasoning as agent_documents).
