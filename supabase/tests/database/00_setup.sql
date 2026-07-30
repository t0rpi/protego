-- Shared pgTAP test helpers. Not wrapped in begin/rollback — the
-- functions defined here need to persist across the other numbered test
-- files in this directory, which each run in their own transaction.
-- Local/dev-only: never applied outside `supabase test db`.
--
-- pg_prove treats every .sql file under supabase/tests/database as a TAP
-- source, so this file needs a valid plan/finish too, even though its
-- real job is defining shared fixtures, not asserting anything.

create extension if not exists pgtap with schema extensions;

select plan(1);

create schema if not exists tests;

-- Minimal auth.users row good enough to satisfy the profiles FK and to
-- drive RLS via auth.uid() — these users never actually authenticate
-- through GoTrue, so the password is a placeholder, never a real hash.
create or replace function tests.create_test_user(identifier text, phone text default null)
returns uuid
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, phone, encrypted_password,
    email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    identifier || '@test.protego.local',
    phone,
    'test-not-a-real-hash',
    now(), case when phone is not null then now() else null end,
    '{}'::jsonb, jsonb_build_object('full_name', identifier),
    now(), now()
  );

  return v_user_id;
end;
$$;

-- Switches the current session to look like an authenticated request from
-- the given user (mirrors what PostgREST sets up per-request in prod).
create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end;
$$;

-- Once a test file calls tests.authenticate_as() the first time, the
-- session's active role becomes 'authenticated' for the rest of the
-- transaction (that's the point — it's simulating a real request). Any
-- *subsequent* call to a tests.* function in that same file (e.g.
-- switching to a second persona) is then made AS 'authenticated', not
-- postgres — and schema-qualified calls require USAGE on the schema
-- itself, which is not granted to any role by default. Without this,
-- only the first tests.* call in a file (made while still superuser)
-- succeeds; every later one fails with "permission denied for schema tests".
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

select ok(true, 'shared test helpers (tests.*) loaded');

select * from finish();
