-- M3 — mission_reports: the guided completion report (agentApp.doneTitle
-- /doneNote — "filled in automatically from your statuses, review and
-- send"). One row per mission, written exclusively by complete_mission()
-- (see 20260731110007_mission_transitions_agent.sql) as part of the
-- active->done transition, never a direct client/agent insert — this
-- keeps "a mission reached done" and "a report exists for it" atomic.

create table public.mission_reports (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade unique,
  agent_id uuid not null references public.agents (id) on delete cascade,
  summary text,
  created_at timestamptz not null default now()
);

alter table public.mission_reports enable row level security;

create policy "agent can read own mission reports"
  on public.mission_reports for select
  to authenticated
  using (agent_id = auth.uid());

create policy "client can read own mission's report"
  on public.mission_reports for select
  to authenticated
  using (
    exists (select 1 from public.missions m where m.id = mission_id and m.client_id = auth.uid())
  );

create policy "dispatcher and admin can read all mission reports"
  on public.mission_reports for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.mission_reports to authenticated;
-- No insert/update/delete grant for anyone — only complete_mission() writes this table.
