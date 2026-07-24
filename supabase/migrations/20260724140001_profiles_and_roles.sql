-- M1 — profiles: 1:1 extension of auth.users carrying PROTEGO-specific
-- account data (role, progressive verification level). This is the
-- "users" entity from docs/architecture/data-model.md §1 — auth.users
-- (managed by Supabase Auth) holds the actual credentials (email/phone/
-- password), this table holds everything RLS elsewhere keys off of.
-- Source: docs/architecture/repository-audit.md §3.2, §3.6;
-- docs/product/prd.md §7 (progressive verification).

create type public.user_role as enum ('client', 'agent', 'dispatcher', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  -- 1 = phone/email verified at signup (sufficient to explore/estimate
  -- prices); 2 = CI + selfie approved by a dispatcher (required before
  -- confirming the first mission — PRD §7, acceptance-tests.md M1).
  verification_level smallint not null default 1 check (verification_level in (1, 2)),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Extends auth.users 1:1. role and verification_level are the two columns nearly every RLS policy in this project reads.';

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- SECURITY DEFINER so RLS policies elsewhere can check the caller's role
-- without recursing back through profiles' own RLS (a well-known trap:
-- a policy on profiles that queries profiles under RLS would deadlock).
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Client: sees only their own profile (data-model.md §4).
create policy "users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Dispatcher/admin: operational read access to all profiles — needed to
-- run the agent-verification queue and identity-verification review
-- (dispatcher-playbook.md §6, prd.md §7).
create policy "dispatcher and admin can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

-- Users may update their own row, but role/verification_level are never
-- writable this way (see column grant below) — those change exclusively
-- through the SECURITY DEFINER functions in the audit_log and
-- identity_verification migrations, each of which is itself audited.
create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
