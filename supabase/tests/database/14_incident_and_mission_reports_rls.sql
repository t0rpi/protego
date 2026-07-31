begin;

select plan(10);

select tests.create_test_user('alice-reports') as alice_id \gset
select tests.create_test_user('bob-reports') as bob_id \gset
select tests.create_test_user('carol-reports') as carol_id \gset
select tests.create_test_user('dana-reports') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id in (:'bob_id'::uuid, :'carol_id'::uuid);
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values
  (:'bob_id'::uuid, 'active', true),
  (:'carol_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_id \gset
update public.missions set status = 'quoted' where id = :'mission_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_fixture_reports', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_id'::uuid;

-- an unrelated, unassigned mission (nobody has an accepted offer on it)
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as other_mission_id \gset

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_id'::uuid);

-- 1: bob can file an incident report on a mission he holds an accepted offer for
select lives_ok(
  format(
    'insert into public.incident_reports (mission_id, agent_id, incident_type, severity, description) values (%L, %L, %L, %L, %L)',
    :'mission_id'::text, :'bob_id'::text, 'client_dispute', 'low', 'client raised their voice, resolved calmly'
  ),
  'the assigned agent can file an incident report for their own mission'
);

select id as incident_id from public.incident_reports where mission_id = :'mission_id'::uuid \gset

-- 2: bob has no accepted offer on the unrelated mission
select throws_ok(
  format(
    'insert into public.incident_reports (mission_id, agent_id, incident_type, severity, description) values (%L, %L, %L, %L, %L)',
    :'other_mission_id'::text, :'bob_id'::text, 'client_dispute', 'low', 'should not be allowed'
  ),
  '42501',
  null,
  'an agent cannot file an incident report for a mission they have no accepted offer on'
);

-- 3-4: read isolation
select tests.authenticate_as(:'carol_id'::uuid);

select is(
  (select count(*) from public.incident_reports where id = :'incident_id'::uuid)::int,
  0,
  'an uninvolved agent cannot read another agent''s incident report'
);

select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select count(*) from public.incident_reports where id = :'incident_id'::uuid)::int,
  1,
  'dispatcher can read the incident report'
);

-- 5: clients have no visibility into incident reports at all (dispatcher-internal)
select tests.authenticate_as(:'alice_id'::uuid);

select is(
  (select count(*) from public.incident_reports where id = :'incident_id'::uuid)::int,
  0,
  'the mission''s own client cannot read the incident report'
);

-- 6-7: once filed, a report is a fixed record — no update/delete grant for anyone
select tests.authenticate_as(:'bob_id'::uuid);

select throws_ok(
  format('update public.incident_reports set severity = %L where id = %L', 'high', :'incident_id'::text),
  '42501',
  null,
  'no role has an update grant on incident_reports'
);

select throws_ok(
  format('delete from public.incident_reports where id = %L', :'incident_id'::text),
  '42501',
  null,
  'no role has a delete grant on incident_reports'
);

-- 8-10: mission_reports, written only by complete_mission()
update public.missions set status = 'enroute' where id = :'mission_id'::uuid;
update public.missions set status = 'arrived' where id = :'mission_id'::uuid;
select public.start_mission_protection(
  :'mission_id'::uuid,
  (select verification_code from public.missions where id = :'mission_id'::uuid)
);
select public.complete_mission(:'mission_id'::uuid, 'mission completed without incident');

select is(
  (select count(*) from public.mission_reports where mission_id = :'mission_id'::uuid)::int,
  1,
  'complete_mission() wrote the guided report'
);

select tests.authenticate_as(:'alice_id'::uuid);

select is(
  (select count(*) from public.mission_reports where mission_id = :'mission_id'::uuid)::int,
  1,
  'the mission''s own client can read its completion report'
);

select tests.authenticate_as(:'carol_id'::uuid);

select is(
  (select count(*) from public.mission_reports where mission_id = :'mission_id'::uuid)::int,
  0,
  'an uninvolved agent cannot read someone else''s mission report'
);

select * from finish();

rollback;
