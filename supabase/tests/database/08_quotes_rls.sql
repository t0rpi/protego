begin;

select plan(7);

select tests.create_test_user('alice-quote') as alice_id \gset
select tests.create_test_user('bob-quote') as bob_id \gset
select tests.create_test_user('dana-quote') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2
from public.services where key = 'hourly'
returning id as mission_id \gset

select throws_ok(
  format(
    'insert into public.quotes (mission_id, breakdown, total_estimate) values (%L, %L, %L)',
    :'mission_id'::text, '[]', '1.00'
  ),
  '42501',
  null,
  'no role has a direct insert grant on quotes — only create_quote_for_mission() can write it'
);

select lives_ok(
  format('select public.create_quote_for_mission(%L)', :'mission_id'::text),
  'the mission''s own client can request a quote for it'
);

select ok(
  (select count(*) from public.quotes where mission_id = :'mission_id'::uuid) = 1,
  'exactly one quote row now exists for the mission'
);

select ok(
  (select total_estimate from public.quotes where mission_id = :'mission_id'::uuid) = 459.80,
  'the stored total matches compute_quote''s own math: (180*2 + 20) * 1.21 = 459.80'
);

select tests.authenticate_as(:'bob_id'::uuid);

select is(
  (select count(*) from public.quotes where mission_id = :'mission_id'::uuid)::int,
  0,
  'another client cannot read alice''s quote'
);

select throws_ok(
  format('select public.create_quote_for_mission(%L)', :'mission_id'::text),
  'P0001',
  null,
  'another client cannot request a quote for someone else''s mission'
);

select tests.authenticate_as(:'dana_id'::uuid);

select ok(
  (select count(*) from public.quotes where mission_id = :'mission_id'::uuid) = 1,
  'dispatcher can read the quote for review purposes'
);

select * from finish();

rollback;
