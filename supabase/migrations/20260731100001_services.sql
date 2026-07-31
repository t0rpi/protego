-- M2 — services: the catalog, with a wave attribute (1-4) and per-city
-- on/off switches. Activating a future wave is a config change (a row +
-- a switch), never new code — MASTERPROMPT §5D, docs/architecture/
-- repository-audit.md §3.2 ("services").

create table public.services (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  wave smallint not null check (wave between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.services is
  'Catalog of all PROTEGO services across all waves. Wave 1 = MVP (shield, protect_ride, escort, hourly). A service existing here does not mean it is bookable anywhere — see service_city_status.';

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;

-- Every authenticated role needs to read the catalog to build a booking
-- flow or an admin screen; only admin can change it.
create policy "authenticated can read services"
  on public.services for select
  to authenticated
  using (true);

create policy "admin can manage services"
  on public.services for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select on public.services to authenticated;
grant insert, update, delete on public.services to authenticated;

-- Per-city activation switch — this is the actual "is this bookable
-- right now" gate. A service can exist in the catalog (e.g. shield,
-- wave 1) while being switched off in every city until its milestone
-- gate opens (shield's public launch is gated on M6, not M2).
create table public.service_city_status (
  service_id uuid not null references public.services (id) on delete cascade,
  city text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, city)
);

create trigger service_city_status_set_updated_at
  before update on public.service_city_status
  for each row execute function public.set_updated_at();

alter table public.service_city_status enable row level security;

create policy "authenticated can read service city status"
  on public.service_city_status for select
  to authenticated
  using (true);

create policy "admin can manage service city status"
  on public.service_city_status for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select on public.service_city_status to authenticated;
grant insert, update, delete on public.service_city_status to authenticated;
