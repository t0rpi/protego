begin;

select plan(12);

select tests.create_test_user('alice-agentext') as alice_id \gset
select tests.create_test_user('bob-agentext') as bob_id \gset
select tests.create_test_user('carol-agentext') as carol_id \gset
select tests.create_test_user('dana-agentext') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id in (:'bob_id'::uuid, :'carol_id'::uuid);

insert into public.agents (id) values (:'bob_id'::uuid), (:'carol_id'::uuid);

select tests.authenticate_as(:'bob_id'::uuid);

-- 1-2: agent can flip their own availability
select lives_ok(
  format('update public.agents set is_available = true where id = %L', :'bob_id'::text),
  'agent can update their own is_available'
);

select is(
  (select is_available from public.agents where id = :'bob_id'::uuid),
  true,
  'is_available actually flipped to true'
);

-- 3: isolation — bob cannot touch carol's availability
select is(
  (select count(*) from public.agents where id = :'carol_id'::uuid and is_available = true)::int,
  0,
  'bob updating his own row does not affect carol'
);

-- 4-5: an agent cannot self-approve status through the same
-- update grant/policy that lets them flip availability — the
-- column-ownership trigger, not the grant, is the real boundary.
select throws_ok(
  format('update public.agents set status = %L where id = %L', 'approved', :'bob_id'::text),
  'P0001',
  null,
  'agent cannot change their own status even though they can update the row'
);

select is(
  (select status::text from public.agents where id = :'bob_id'::uuid),
  'in_review',
  'status remains in_review after the blocked self-update attempt'
);

select tests.authenticate_as(:'dana_id'::uuid);

-- 6: dispatcher-driven onboarding progression
select lives_ok(
  format('update public.agents set status = %L where id = %L', 'approved', :'bob_id'::text),
  'dispatcher can move an agent in_review -> approved'
);

-- 7: no skipping straight to active
select throws_ok(
  format('update public.agents set status = %L where id = %L', 'active', :'carol_id'::text),
  'P0001',
  null,
  'in_review -> active is rejected — cannot skip approved'
);

-- 8-9: carol's full happy path
select lives_ok(
  format('update public.agents set status = %L where id = %L', 'approved', :'carol_id'::text),
  'in_review -> approved succeeds'
);

select lives_ok(
  format('update public.agents set status = %L where id = %L', 'active', :'carol_id'::text),
  'approved -> active succeeds once approved'
);

-- 10-12: blocked + reinstatement path
select lives_ok(
  format('update public.agents set status = %L where id = %L', 'blocked', :'carol_id'::text),
  'active -> blocked succeeds (e.g. dispatcher acting on expired documents)'
);

select throws_ok(
  format('update public.agents set status = %L where id = %L', 'active', :'carol_id'::text),
  'P0001',
  null,
  'blocked -> active directly is rejected — must go through approved again'
);

select lives_ok(
  format('update public.agents set status = %L where id = %L', 'approved', :'carol_id'::text),
  'blocked -> approved succeeds (reinstatement path)'
);

select * from finish();

rollback;
