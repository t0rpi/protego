begin;

select plan(9);

select tests.create_test_user('alice-future') as alice_id \gset
select tests.create_test_user('dana-future') as dana_id \gset

update public.profiles set role = 'admin' where id = :'dana_id'::uuid;

-- subscriptions, groups and partners are schema-ready for M8/M9/M10 but
-- must be completely inert until then (roadmap.md governance rule) —
-- deny-all for EVERY role, including admin, since no grant exists at all.

select tests.authenticate_as(:'alice_id'::uuid);

select throws_ok(
  'select count(*) from public.subscriptions',
  '42501',
  null,
  'client has no access to subscriptions at all (future-ready, inert)'
);

select throws_ok(
  format('insert into public.subscriptions (user_id, plan) values (%L, %L)', :'alice_id'::text, 'drum_sigur'),
  '42501',
  null,
  'client cannot insert into subscriptions'
);

select throws_ok(
  'select count(*) from public.groups',
  '42501',
  null,
  'client has no access to groups at all (future-ready, inert)'
);

select throws_ok(
  format('insert into public.groups (initiator_id) values (%L)', :'alice_id'::text),
  '42501',
  null,
  'client cannot insert into groups'
);

select throws_ok(
  'select count(*) from public.partners',
  '42501',
  null,
  'client has no access to partners at all (future-ready, inert)'
);

select tests.authenticate_as(:'dana_id'::uuid);

select throws_ok(
  'select count(*) from public.subscriptions',
  '42501',
  null,
  'even admin has no access to subscriptions — deny-all is unconditional, not role-based'
);

select throws_ok(
  'select count(*) from public.groups',
  '42501',
  null,
  'even admin has no access to groups'
);

select throws_ok(
  'select count(*) from public.partners',
  '42501',
  null,
  'even admin has no access to partners'
);

select throws_ok(
  format('insert into public.partners (company_name) values (%L)', 'Rogue Security SRL'),
  '42501',
  null,
  'even admin cannot insert into partners'
);

select * from finish();

rollback;
