begin;

select plan(7);

select tests.create_test_user('alice-quote') as alice_id \gset
select tests.create_test_user('bob-quote') as bob_id \gset
select tests.create_test_user('dana-quote') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

-- an explicit, safely-in-the-future weekday/daytime scheduled_at keeps
-- this test deterministic — with no scheduled_at at all,
-- create_quote_for_mission() would treat the booking as urgent (and,
-- depending on the real clock when the suite runs, possibly night/
-- weekend too), making the expected total time-of-run-dependent under
-- v2.3's real coefficients (M2/M3 never had this risk: their
-- coefficients were 1.0 no-ops).
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, scheduled_at)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, '2026-08-04T14:00:00Z'
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
  (select total_estimate from public.quotes where mission_id = :'mission_id'::uuid) = 338.80,
  'the stored total matches compute_quote''s own math (v2.3 rates): (130*2 + 20) * 1.21 = 338.80'
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
