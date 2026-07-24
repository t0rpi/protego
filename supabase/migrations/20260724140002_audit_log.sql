-- M1 — audit_log: append-only log of critical actions. M1 writes to it:
-- registration, verification decisions, role changes. SOS/incidents/
-- payments land at M4/M5 (data-model.md §1, "audit_log").
-- Source: docs/architecture/repository-audit.md §3.2, §6.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only. Every row is written by the SECURITY DEFINER function log_audit_event() — no role, including admin, has a direct INSERT/UPDATE/DELETE grant.';

alter table public.audit_log enable row level security;

-- Only admin reads the audit trail (data-model.md §4).
create policy "admin can read audit_log"
  on public.audit_log for select
  to authenticated
  using (public.current_user_role() = 'admin');

revoke all on public.audit_log from authenticated, anon;
grant select on public.audit_log to authenticated;

create function public.log_audit_event(
  p_actor_id uuid,
  p_actor_role text,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_payload jsonb default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, payload)
  values (p_actor_id, p_actor_role, p_action, p_entity, p_entity_id, p_payload);
$$;

-- New auth.users row → create the matching profile + log registration.
-- Level 1 is granted immediately: by the time auth.users gets a row,
-- phone OTP (if that's the signup method) or email confirmation has
-- already succeeded (acceptance-tests.md M1: "se înregistrează cu
-- telefon (OTP) și email" → "contul e creat cu ... nivel de verificare 1").
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, verification_level, full_name)
  values (new.id, 'client', 1, new.raw_user_meta_data ->> 'full_name');

  perform public.log_audit_event(
    new.id, 'client', 'registration', 'profiles', new.id,
    jsonb_build_object('email', new.email, 'phone', new.phone)
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin-only, audited role changes. Dispatcher/agent/client never get a
-- direct UPDATE grant on profiles.role (see profiles_and_roles.sql).
create function public.set_user_role(p_user_id uuid, p_new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role public.user_role;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'only admin can change user roles';
  end if;

  select role into v_old_role from public.profiles where id = p_user_id;

  if v_old_role is null then
    raise exception 'user % not found', p_user_id;
  end if;

  update public.profiles set role = p_new_role where id = p_user_id;

  perform public.log_audit_event(
    auth.uid(), 'admin', 'role_change', 'profiles', p_user_id,
    jsonb_build_object('from', v_old_role, 'to', p_new_role)
  );
end;
$$;

grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
