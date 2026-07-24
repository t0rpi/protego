-- M1 — protected_persons: people a client can book protection for besides
-- themselves (self/child/parent/...). Needed from MVP for "rezervare
-- pentru altcineva" (data-model.md §1; booking.md §5 in strings — used
-- starting M2, schema ready now alongside accounts).

create type public.protected_person_relation as enum ('self', 'child', 'parent', 'partner', 'other');

create table public.protected_persons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  relation public.protected_person_relation not null default 'self',
  date_of_birth date,
  created_at timestamptz not null default now()
);

alter table public.protected_persons enable row level security;

-- Client manages their own saved people freely (data-model.md §4:
-- "Client: acces doar la propriile ... protected_persons").
create policy "owner can manage own protected persons"
  on public.protected_persons for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "dispatcher and admin can read protected persons"
  on public.protected_persons for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));
