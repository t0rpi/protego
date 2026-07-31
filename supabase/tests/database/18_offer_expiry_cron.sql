begin;

select plan(5);

-- 1: the scheduled sweep job exists (M3 debt: a real server-side
-- mechanism, not just the agent app's own countdown timer)
select ok(
  exists (select 1 from cron.job where jobname = 'expire-stale-mission-offers' and active),
  'the offer-expiry sweep is registered as an active pg_cron job'
);

select is(
  (select schedule from cron.job where jobname = 'expire-stale-mission-offers'),
  '*/15 * * * * *',
  'the sweep runs every 15 seconds — well inside the 45s offer window'
);

select tests.create_test_user('alice-cron') as alice_id \gset
select tests.create_test_user('bob-cron') as bob_id \gset
select tests.create_test_user('dana-cron') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id = :'bob_id'::uuid;
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values (:'bob_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_id \gset
update public.missions set status = 'quoted' where id = :'mission_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_fixture_cron', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_id'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

-- Simulate the window having passed without any client ever calling
-- expire_mission_offer() itself (app closed/backgrounded scenario).
select tests.clear_authentication();
update public.mission_offers set expires_at = now() - interval '1 second' where id = :'offer_id'::uuid;

-- 3: the sweep function (what the cron job actually runs) resolves it
select lives_ok(
  'select public.expire_stale_mission_offers()',
  'the sweep function runs without error'
);

select is(
  (select status::text from public.mission_offers where id = :'offer_id'::uuid),
  'expired',
  'a stale pending offer is expired by the sweep, with no client-side timer involved'
);

select is(
  (select elevated_priority from public.missions where id = :'mission_id'::uuid),
  true,
  'the mission is flagged elevated_priority by the sweep, same as the manual expiry path'
);

select * from finish();

rollback;
