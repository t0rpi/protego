begin;

select plan(8);

select tests.create_test_user('alice-earnings') as alice_id \gset
select tests.create_test_user('bob-earnings') as bob_id \gset
select tests.create_test_user('carol-earnings') as carol_id \gset
select tests.create_test_user('dana-earnings') as dana_id \gset
select tests.create_test_user('admin-earnings') as admin_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'admin' where id = :'admin_id'::uuid;
update public.profiles set role = 'agent' where id in (:'bob_id'::uuid, :'carol_id'::uuid);
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values
  (:'bob_id'::uuid, 'active', true),
  (:'carol_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);

-- explicit weekday/daytime scheduled_at keeps the initial quote's
-- coefficients (and this test's expected earnings) deterministic
-- regardless of the real clock when the suite runs.
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, scheduled_at)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, '2026-08-04T14:00:00Z' from public.services where key = 'hourly'
returning id as mission_id \gset
update public.missions set status = 'quoted' where id = :'mission_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_fixture_earnings', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_id'::uuid;
select public.create_quote_for_mission(:'mission_id'::uuid);

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_id'::uuid);
update public.missions set status = 'enroute' where id = :'mission_id'::uuid;
update public.missions set status = 'arrived' where id = :'mission_id'::uuid;
select public.start_mission_protection(
  :'mission_id'::uuid,
  (select verification_code from public.missions where id = :'mission_id'::uuid)
);
select public.complete_mission(:'mission_id'::uuid, 'done, no incidents');

-- 1: the agent can read their own earnings row
select is(
  (select count(*) from public.agent_earnings where mission_id = :'mission_id'::uuid)::int,
  1,
  'bob can read his own earnings row'
);

-- 2: isolation
select tests.authenticate_as(:'carol_id'::uuid);

select is(
  (select count(*) from public.agent_earnings where mission_id = :'mission_id'::uuid)::int,
  0,
  'an uninvolved agent cannot read someone else''s earnings'
);

-- 3: dispatcher visibility
select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select count(*) from public.agent_earnings where mission_id = :'mission_id'::uuid)::int,
  1,
  'dispatcher can read all agent earnings'
);

-- 4: no direct write path — only complete_mission() populates this table
select tests.authenticate_as(:'bob_id'::uuid);

select throws_ok(
  format(
    'insert into public.agent_earnings (mission_id, agent_id, amount) values (%L, %L, %L)',
    :'mission_id'::text, :'bob_id'::text, '9999.00'
  ),
  '42501',
  null,
  'no role has a direct insert grant on agent_earnings'
);

-- 5-6: the weekly aggregation view
select is(
  (select total_amount from public.agent_weekly_earnings where agent_id = :'bob_id'::uuid),
  143.00,
  'agent_weekly_earnings aggregates to the same amount as the underlying ledger row'
);

select tests.authenticate_as(:'carol_id'::uuid);

select is(
  (select count(*) from public.agent_weekly_earnings where agent_id = :'bob_id'::uuid)::int,
  0,
  'the weekly earnings view respects the same per-agent isolation as the base table'
);

-- 7-8: agent_share_pct follows the exact same admin-only rule as every
-- other pricing_config column — no special-casing for the new column.
select tests.authenticate_as(:'admin_id'::uuid);

select lives_ok(
  format(
    'update public.pricing_config set agent_share_pct = %L where service_id = (select service_id from public.missions where id = %L)',
    '0.750', :'mission_id'::text
  ),
  'admin can edit agent_share_pct like any other pricing_config column'
);

select tests.authenticate_as(:'dana_id'::uuid);

-- pricing_config's only UPDATE policy is admin-only (see
-- 20260731100002_pricing_config.sql) — for a non-admin role this is a
-- pure RLS row mismatch, not a raised exception, so the UPDATE
-- statement itself succeeds but silently touches 0 rows.
update public.pricing_config set agent_share_pct = 0.900
where service_id = (select service_id from public.missions where id = :'mission_id'::uuid);

select is(
  (select agent_share_pct from public.pricing_config
   where service_id = (select service_id from public.missions where id = :'mission_id'::uuid)),
  0.750,
  'a dispatcher (non-admin) update to agent_share_pct matches zero rows — value stays as the admin left it'
);

select * from finish();

rollback;
