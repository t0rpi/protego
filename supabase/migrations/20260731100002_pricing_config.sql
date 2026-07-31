-- M2 — pricing_config: every numeric value the pricing engine reads.
-- CLAUDE.md: "Prices come from DB config, never constants." No value in
-- this table is a code constant anywhere in the app — see
-- packages/domain/src/pricing (client-side preview) and
-- public.compute_quote() (server-side, authoritative) in
-- 20260731100005_quotes.sql, both of which read this table exclusively.
-- Source: docs/product/business-rules.md §1.

create table public.pricing_config (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  city text not null,

  -- base building blocks
  base numeric(10, 2) not null default 0,
  per_hour_agent numeric(10, 2) not null default 0,
  per_hour_vehicle numeric(10, 2) not null default 0,
  per_km numeric(10, 2) not null default 0, -- Protect Ride only

  -- multiplicative coefficients (1.0 = no adjustment)
  coef_night numeric(4, 2) not null default 1.0,
  coef_weekend numeric(4, 2) not null default 1.0,
  coef_urgent numeric(4, 2) not null default 1.0,

  -- minimum billing + degressivity (business-rules.md §1, decisions #3, #11)
  min_billing_hours numeric(4, 2) not null default 0,
  degressive_threshold_hours numeric(4, 2), -- null = not applicable to this service
  degressive_rate numeric(4, 3) not null default 1.0, -- multiplier on hours beyond threshold; 1.0 = no discount yet (rate itself not confirmed anywhere — see seed migration note)

  -- fixed line items + tax
  platform_fee numeric(10, 2) not null default 0,
  vat_rate numeric(4, 3) not null default 0.21, -- Romania standard VAT, confirmed constant (CLAUDE.md §6)

  -- cancellation (business-rules.md §3, decision #9)
  free_cancel_minutes integer not null default 60,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (service_id, city)
);

comment on table public.pricing_config is
  'One row per (service, city). Every number the pricing engine uses, editable by admin, effective immediately for new quotes (acceptance-tests.md M2: no redeploy needed).';

create trigger pricing_config_set_updated_at
  before update on public.pricing_config
  for each row execute function public.set_updated_at();

alter table public.pricing_config enable row level security;

-- Clients need to read current prices to render a quote preview;
-- packages/domain's client-side preview and public.compute_quote() both
-- read this table.
create policy "authenticated can read pricing config"
  on public.pricing_config for select
  to authenticated
  using (true);

create policy "admin can manage pricing config"
  on public.pricing_config for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select on public.pricing_config to authenticated;
grant insert, update, delete on public.pricing_config to authenticated;
