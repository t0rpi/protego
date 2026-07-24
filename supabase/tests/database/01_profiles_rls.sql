begin;

select plan(7);

select tests.create_test_user('alice-profiles') as alice_id \gset
select tests.create_test_user('bob-profiles') as bob_id \gset
select tests.create_test_user('dana-profiles') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

select is(
  (select count(*) from public.profiles where id = :'alice_id'::uuid)::int,
  1,
  'client can read own profile'
);

select is(
  (select count(*) from public.profiles where id = :'bob_id'::uuid)::int,
  0,
  'client cannot read another client''s profile'
);

select lives_ok(
  format('update public.profiles set full_name = %L where id = %L', 'Alice Updated', :'alice_id'::text),
  'client can update own full_name'
);

select throws_ok(
  format('update public.profiles set role = %L where id = %L', 'admin', :'alice_id'::text),
  'client cannot change own role — column grant denies it, not just RLS'
);

select throws_ok(
  format('update public.profiles set verification_level = 2 where id = %L', :'alice_id'::text),
  'client cannot self-grant verification_level 2 — column grant denies it'
);

select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select count(*) from public.profiles where id in (:'alice_id'::uuid, :'bob_id'::uuid))::int,
  2,
  'dispatcher can read all profiles'
);

set local role anon;

select is(
  (select count(*) from public.profiles)::int,
  0,
  'anon (unauthenticated) has zero access to profiles'
);

reset role;

select * from finish();

rollback;
