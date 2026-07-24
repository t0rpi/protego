-- M1 — agents + agent_documents: agent-role profile extension and their
-- credential documents (expiry-gated, auto-blocking). The onboarding UI
-- itself (upload, interview, trial mission) is M3 — this migration only
-- lays the schema + RLS foundation M1 needs.
-- Source: docs/architecture/repository-audit.md §3.2;
-- docs/product/supply-model.md §2 (statuses, expiring documents).

create type public.agent_source as enum ('elite', 'verified');
create type public.agent_status as enum ('in_review', 'approved', 'active', 'blocked');
create type public.agent_document_type as enum ('atestat_igpr', 'cazier', 'ci', 'permis', 'asigurare');
create type public.agent_document_status as enum ('valid', 'expiring', 'expired');

create table public.agents (
  id uuid primary key references public.profiles (id) on delete cascade,
  source public.agent_source not null default 'verified',
  -- in_review -> approved -> active, or -> blocked (expired docs).
  -- No status skips "active" without going through "approved" first
  -- (acceptance-tests.md M3) — enforced when M3 builds the transition
  -- functions; this migration only establishes the column + default.
  status public.agent_status not null default 'in_review',
  rating numeric(2, 1),
  badges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

alter table public.agents enable row level security;

create policy "agent can read own agent profile"
  on public.agents for select
  to authenticated
  using (id = auth.uid());

create policy "dispatcher and admin can read all agents"
  on public.agents for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

-- Status transitions are a dispatcher/operations decision (supply-
-- model.md §2), never self-service by the agent.
create policy "dispatcher and admin can update agent status"
  on public.agents for update
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'))
  with check (public.current_user_role() in ('dispatcher', 'admin'));

create table public.agent_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  type public.agent_document_type not null,
  file_path text not null,
  expires_at date,
  status public.agent_document_status not null default 'valid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agent_documents_set_updated_at
  before update on public.agent_documents
  for each row execute function public.set_updated_at();

alter table public.agent_documents enable row level security;

-- Agents can add and view their own documents, but not edit or delete
-- them afterwards (chain-of-custody: expires_at/status changes come only
-- from the expiry job or a dispatcher/admin review, never the agent).
create policy "agent can insert own documents"
  on public.agent_documents for insert
  to authenticated
  with check (agent_id = auth.uid());

create policy "agent can read own documents"
  on public.agent_documents for select
  to authenticated
  using (agent_id = auth.uid());

create policy "dispatcher and admin can read all agent documents"
  on public.agent_documents for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

create policy "dispatcher and admin can update agent documents"
  on public.agent_documents for update
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'))
  with check (public.current_user_role() in ('dispatcher', 'admin'));
