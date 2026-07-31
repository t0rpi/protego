-- M5 — fleet management (founder-requested) and the weekly payout
-- batch (audit §4: "payout săptămânal" — kept OUT of Stripe for the
-- pilot; Romanian collaborators are paid by bank transfer, so this is
-- an aggregation + CSV export + admin review workflow, never real
-- money movement).

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  year smallint,
  color text,
  plate text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

alter table public.vehicles enable row level security;

create policy "authenticated can read vehicles"
  on public.vehicles for select
  to authenticated
  using (true);

create policy "admin can manage vehicles"
  on public.vehicles for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select on public.vehicles to authenticated;
grant insert, update, delete on public.vehicles to authenticated;

-- Agents self-report their own IBAN for payout purposes — same
-- self-service column as is_available (M3), extended here rather than
-- opening a new grant/trigger pattern.
alter table public.agents add column iban text;

create or replace function public.enforce_agent_column_ownership()
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
    raise exception 'an agent may only update their own is_available/iban columns';
  end if;

  return NEW;
end;
$$;

grant update (iban) on public.agents to authenticated;

create type public.payout_batch_status as enum ('draft', 'paid');

-- service_role has no implicit table-level grant in this local dev
-- cluster (RLS bypass and table GRANT are separate concerns) — an
-- explicit insert grant here lets M5's payout-batch pgTAP fixtures seed
-- agent_earnings rows directly with controlled created_at values
-- (mirrors the same service_role-fixture pattern used for payments in
-- 20260731130003_payments.sql). `authenticated` still has no
-- insert/update/delete grant at all — complete_mission() remains the
-- only real-traffic write path.
grant insert on public.agent_earnings to service_role;

create table public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  status public.payout_batch_status not null default 'draft',
  created_by uuid references public.profiles (id),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payout_batches enable row level security;

create policy "admin can manage payout batches"
  on public.payout_batches for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select on public.payout_batches to authenticated;
-- insert/update reserved for the functions below only (not a direct
-- admin table grant) — batches are always created via aggregation, never
-- hand-typed, so create_payout_batch()/mark_payout_batch_paid() are the
-- sole write path despite the admin policy existing (policy governs
-- rows an admin COULD touch if they had a grant; no insert/update grant
-- is actually given here).

create table public.payout_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batches (id) on delete cascade,
  agent_id uuid not null references public.agents (id),
  amount numeric(10, 2) not null,
  missions_count integer not null,
  created_at timestamptz not null default now(),

  unique (batch_id, agent_id)
);

alter table public.payout_batch_items enable row level security;

create policy "agent can read own payout batch items"
  on public.payout_batch_items for select
  to authenticated
  using (agent_id = auth.uid());

create policy "admin can read all payout batch items"
  on public.payout_batch_items for select
  to authenticated
  using (public.current_user_role() = 'admin');

grant select on public.payout_batch_items to authenticated;
-- No write grant for anyone — only create_payout_batch() writes this table.

-- Aggregates agent_earnings for the ISO week starting at p_week_start
-- (must be a Monday — matches agent_weekly_earnings' date_trunc('week', ...)
-- convention from M3) into a new draft batch. One batch per week
-- (unique week_start) — re-running for an existing week is refused
-- rather than silently creating a duplicate.
create function public.create_payout_batch(p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_week_end timestamptz;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'only admin can create a payout batch';
  end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday';
  end if;

  insert into public.payout_batches (week_start, created_by)
  values (p_week_start, auth.uid())
  returning id into v_batch_id;

  v_week_end := p_week_start::timestamptz + interval '7 days';

  insert into public.payout_batch_items (batch_id, agent_id, amount, missions_count)
  select v_batch_id, agent_id, sum(amount), count(*)
  from public.agent_earnings
  where created_at >= p_week_start::timestamptz and created_at < v_week_end
  group by agent_id;

  perform public.log_audit_event(
    auth.uid(), 'admin', 'payout_batch_created', 'payout_batches', v_batch_id,
    jsonb_build_object('week_start', p_week_start)
  );

  return v_batch_id;
end;
$$;

grant execute on function public.create_payout_batch(date) to authenticated;

create function public.mark_payout_batch_paid(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'only admin can mark a payout batch paid';
  end if;
  if not exists (select 1 from public.payout_batches where id = p_batch_id and status = 'draft') then
    raise exception 'batch % not found or already paid', p_batch_id;
  end if;

  update public.payout_batches set status = 'paid', paid_at = now() where id = p_batch_id;

  perform public.log_audit_event(
    auth.uid(), 'admin', 'payout_batch_paid', 'payout_batches', p_batch_id, null
  );
end;
$$;

grant execute on function public.mark_payout_batch_paid(uuid) to authenticated;
