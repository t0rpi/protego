begin;

select plan(10);

select tests.create_test_user('alice-track') as alice_id \gset
select tests.create_test_user('bob-track') as bob_id \gset
select tests.create_test_user('carol-track') as carol_id \gset
select tests.create_test_user('dana-track') as dana_id \gset

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
update public.missions set payment_stub_confirmed = true, status = 'confirmed' where id = :'mission_id'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_id'::uuid);

-- 1: recording a location before the tracking window opens is refused
select throws_ok(
  format('select public.record_mission_location(%L, %L, %L)', :'mission_id'::text, '46.9500', '21.9200'),
  'P0001',
  null,
  'recording a location is refused before the mission reaches enroute'
);

update public.missions set status = 'enroute' where id = :'mission_id'::uuid;

-- 2: an uninvolved agent cannot record a location for this mission
select tests.authenticate_as(:'carol_id'::uuid);
select throws_ok(
  format('select public.record_mission_location(%L, %L, %L)', :'mission_id'::text, '46.9500', '21.9200'),
  'P0001',
  null,
  'only the assigned agent can record a location'
);

-- 3: the assigned agent can, once enroute
select tests.authenticate_as(:'bob_id'::uuid);
select lives_ok(
  format('select public.record_mission_location(%L, %L, %L)', :'mission_id'::text, '46.9500', '21.9200'),
  'the assigned agent can record a location once the mission is enroute'
);

-- 4-5: client can read it, uninvolved agent cannot
select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select count(*) from public.mission_tracking where mission_id = :'mission_id'::uuid)::int,
  1,
  'the mission''s own client can read tracking while enroute'
);

select tests.authenticate_as(:'carol_id'::uuid);
select is(
  (select count(*) from public.mission_tracking where mission_id = :'mission_id'::uuid)::int,
  0,
  'an uninvolved agent cannot read tracking for someone else''s mission'
);

-- 6: dispatcher can read it
select tests.authenticate_as(:'dana_id'::uuid);
select is(
  (select count(*) from public.mission_tracking where mission_id = :'mission_id'::uuid)::int,
  1,
  'dispatcher can read all tracking'
);

-- 7: the latest-location view reflects the recorded point
select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select lat from public.mission_latest_location where mission_id = :'mission_id'::uuid),
  46.950000,
  'mission_latest_location returns the recorded latitude'
);

-- 8-11: the window closes once the mission ends (acceptance-tests.md M4:
-- "locația e vizibilă exclusiv clientului asociat, exclusiv în timpul
-- misiunii active")
select tests.authenticate_as(:'bob_id'::uuid);
update public.missions set status = 'arrived' where id = :'mission_id'::uuid;
select public.start_mission_protection(
  :'mission_id'::uuid,
  (select verification_code from public.missions where id = :'mission_id'::uuid)
);

select lives_ok(
  format('select public.record_mission_location(%L, %L, %L)', :'mission_id'::text, '46.9510', '21.9210'),
  'the assigned agent can still record a location while active'
);

select public.complete_mission(:'mission_id'::uuid, 'done, no incidents');

select throws_ok(
  format('select public.record_mission_location(%L, %L, %L)', :'mission_id'::text, '46.9520', '21.9220'),
  'P0001',
  null,
  'recording a location is refused once the mission is done'
);

select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select count(*) from public.mission_tracking where mission_id = :'mission_id'::uuid)::int,
  0,
  'the client can no longer read tracking once the mission is done — the window is closed, not just stale'
);

select * from finish();

rollback;
