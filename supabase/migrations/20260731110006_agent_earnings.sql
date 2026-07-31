-- M3 — agent earnings ledger. Written exclusively by complete_mission()
-- (20260731110007) as part of the active->done transition — the amount
-- is always mission price x a configurable share percentage read from
-- pricing_config, never a constant (CLAUDE.md: "Prices come from DB
-- config, never constants" applies equally to the agent's cut of that
-- price). Payout EXECUTION (actually moving money) is M5 — this
-- milestone only ever aggregates and displays.

alter table public.pricing_config
  add column agent_share_pct numeric(4, 3) not null default 0.700;

comment on column public.pricing_config.agent_share_pct is
  'Fraction of quotes.total_estimate paid to the agent per completed mission. NOT confirmed anywhere in project docs (no source states an exact split) — seeded to 0.70 as a disclosed, editable placeholder (same treatment as per_km/coefficients in 20260731100007_seed_mvp_services_pricing.sql), never presented as a confirmed business decision. Admin-editable from day one, same as every other pricing_config column.';

update public.pricing_config set agent_share_pct = 0.700;

create table public.agent_earnings (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade unique,
  agent_id uuid not null references public.agents (id) on delete cascade,
  amount numeric(10, 2) not null,
  currency text not null default 'RON',
  created_at timestamptz not null default now()
);

alter table public.agent_earnings enable row level security;

create policy "agent can read own earnings"
  on public.agent_earnings for select
  to authenticated
  using (agent_id = auth.uid());

create policy "dispatcher and admin can read all earnings"
  on public.agent_earnings for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

grant select on public.agent_earnings to authenticated;
-- No insert/update/delete grant for anyone — only complete_mission() writes this table.

-- Weekly payout aggregation (agentApp.payout: "Payout automat luni,
-- in contul {account}" — the automation itself is M5; this view is the
-- read-only figure that screen and a future dispatcher payout run would
-- both read from). ISO week, matching Romania/EU convention (Monday start).
create view public.agent_weekly_earnings
with (security_invoker = true)
as
select
  agent_id,
  date_trunc('week', created_at) as week_start,
  count(*) as missions_completed,
  sum(amount) as total_amount,
  currency
from public.agent_earnings
group by agent_id, date_trunc('week', created_at), currency;

comment on view public.agent_weekly_earnings is
  'Read-only aggregation for the earnings dashboard (agentApp.earningsTitle, day/week/month views) and a future dispatcher payout run. security_invoker=true (unlike agent_mission_briefs) because plain row-level filtering by agent_id is exactly what RLS on the underlying agent_earnings table already provides — no address-masking-style logic needed here, so there is no reason to bypass it.';

grant select on public.agent_weekly_earnings to authenticated;
