begin;

select plan(7);

select tests.create_test_user('aaron-agent') as aaron_id \gset
select tests.create_test_user('adam-agent') as adam_id \gset
select tests.create_test_user('donna-agent') as donna_id \gset

update public.profiles set role = 'dispatcher' where id = :'donna_id'::uuid;
update public.profiles set role = 'agent' where id = :'aaron_id'::uuid;
update public.profiles set role = 'agent' where id = :'adam_id'::uuid;

-- Agent-row creation is an M3 (onboarding) concern with no self-serve
-- INSERT policy yet (see migration comment) — fixtures are created
-- directly here, as the M1 schema intends.
insert into public.agents (id, source, status) values (:'aaron_id'::uuid, 'verified', 'in_review');
insert into public.agents (id, source, status) values (:'adam_id'::uuid, 'verified', 'in_review');
insert into public.agent_documents (agent_id, type, file_path, expires_at)
  values (:'aaron_id'::uuid, 'atestat_igpr', 'agents/aaron/atestat.pdf', current_date + interval '1 year');

select tests.authenticate_as(:'aaron_id'::uuid);

select is(
  (select count(*) from public.agents where id = :'aaron_id'::uuid)::int,
  1,
  'agent can read their own agent profile'
);

select is(
  (select count(*) from public.agents where id = :'adam_id'::uuid)::int,
  0,
  'agent cannot read another agent''s profile'
);

select is(
  (select count(*) from public.agent_documents where agent_id = :'aaron_id'::uuid)::int,
  1,
  'agent can read their own documents'
);

-- M3 gives agents their own UPDATE policy on this table (self-service
-- is_available), so a status change no longer fails as a silent RLS
-- mismatch — it now reaches the row and is explicitly rejected by
-- enforce_agent_column_ownership() (20260731110001), a real exception.
select throws_ok(
  format('update public.agents set status = %L where id = %L', 'active', :'aaron_id'::text),
  'P0001',
  null,
  'agent''s self-approval attempt is explicitly rejected by the column-ownership trigger (M3)'
);

select is(
  (select status::text from public.agents where id = :'aaron_id'::uuid),
  'in_review',
  'agent status is unchanged — the agent could not actually self-approve'
);

select tests.authenticate_as(:'donna_id'::uuid);

select is(
  (select count(*) from public.agents)::int,
  2,
  'dispatcher can read all agents'
);

select lives_ok(
  format('update public.agents set status = %L where id = %L', 'approved', :'aaron_id'::text),
  'dispatcher can update agent status'
);

select * from finish();

rollback;
