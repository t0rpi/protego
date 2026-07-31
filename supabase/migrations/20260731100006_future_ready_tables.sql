-- M2 — future-ready tables: created now so their eventual activation
-- (M8 subscriptions, M9 groups/Night split-payment, M10 partners) never
-- needs a breaking migration, per docs/architecture/data-model.md §2
-- and repository-audit.md §3.3. RLS is enabled with NO policies at
-- all — deny-all for every role, including admin — and NO grants
-- either, so these tables are inert: no application code reads or
-- writes them until the milestone that activates each one adds both
-- the policies and the feature. Roadmap governance (roadmap.md §
-- "Reguli de guvernanță"): "nu se activează tabela groups funcțional
-- înainte de M9, chiar dacă schema există."

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('drum_sigur', 'kids', 'senior', 'familie', 'business')),
  status text not null default 'inactive',
  renews_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Future-ready for Valul 2 / M8 (Drum Sigur, Kids, Senior, Familie, Business). Inert until then — see file header.';

alter table public.subscriptions enable row level security;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references public.profiles (id),
  mission_id uuid references public.missions (id),
  split_strategy text,
  created_at timestamptz not null default now()
);

comment on table public.groups is
  'Future-ready for PROTEGO Night split-payment (Valul 3 / M9, "Gardianul Serii"). The UX mechanism (who initiates, equal vs. custom split) is an open decision (open-decisions.md #6) deliberately not pre-decided by this schema. Inert until M9.';

alter table public.groups enable row level security;

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  license_no text,
  insurance text,
  commission_rate numeric(4, 3),
  created_at timestamptz not null default now()
);

comment on table public.partners is
  'Future-ready for the licensed-partner marketplace (Valul 4 / M10, commission 15-25%). Inert until then.';

alter table public.partners enable row level security;

-- No grants either — belt and suspenders alongside deny-all RLS.
