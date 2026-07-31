begin;

select plan(9);

select tests.create_test_user('alice-photos') as alice_id \gset
select tests.create_test_user('bob-photos') as bob_id \gset
select tests.create_test_user('dana-photos') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id = :'bob_id'::uuid;
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values (:'bob_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'client_vehicle', 1, 2 from public.services where key = 'hourly'
returning id as mission_id \gset

update public.missions set status = 'quoted' where id = :'mission_id'::uuid;

insert into public.mission_vehicle_checklists (mission_id, consent_signed_at, insurance_confirmed, client_signature_at)
values (:'mission_id'::uuid, now(), true, now());

select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_fixture_photos', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_id'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_id'::uuid);
update public.missions set status = 'enroute' where id = :'mission_id'::uuid;
update public.missions set status = 'arrived' where id = :'mission_id'::uuid;

-- 1: zero photos
select throws_ok(
  format(
    'select public.start_mission_protection(%L, (select verification_code from public.missions where id = %L))',
    :'mission_id'::text, :'mission_id'::text
  ),
  'P0001',
  null,
  'a client-vehicle mission cannot start protection with zero checklist photos'
);

-- 2: partial photos (1 of 6)
update public.mission_vehicle_checklists set photos = '{"front": "vehicle-checklists/x/front.jpg"}'::jsonb
where mission_id = :'mission_id'::uuid;

select throws_ok(
  format(
    'select public.start_mission_protection(%L, (select verification_code from public.missions where id = %L))',
    :'mission_id'::text, :'mission_id'::text
  ),
  'P0001',
  null,
  'a client-vehicle mission cannot start protection with an incomplete (1 of 6) photo checklist'
);

-- 3: the agent can write the full 6-photo checklist
select lives_ok(
  format(
    'update public.mission_vehicle_checklists set photos = %L where mission_id = %L',
    '{"front":"a/front.jpg","back":"a/back.jpg","left":"a/left.jpg","right":"a/right.jpg","km":"a/km.jpg","fuel":"a/fuel.jpg"}',
    :'mission_id'::text
  ),
  'the assigned agent can write all 6 checklist photos'
);

-- 4-5: protection starts once the checklist is complete
select lives_ok(
  format(
    'select public.start_mission_protection(%L, (select verification_code from public.missions where id = %L))',
    :'mission_id'::text, :'mission_id'::text
  ),
  'starting protection succeeds once the 6-photo checklist is complete'
);

select is(
  (select status::text from public.missions where id = :'mission_id'::uuid),
  'active',
  'the client-vehicle mission is now active'
);

-- 6-7: a client may not touch the photos column, even though they can
-- update the same table for their own 3 fields
select tests.authenticate_as(:'alice_id'::uuid);

select throws_ok(
  format(
    'update public.mission_vehicle_checklists set photos = %L where mission_id = %L',
    '{"front":"tampered.jpg"}', :'mission_id'::text
  ),
  'P0001',
  null,
  'a client cannot update the photos column on their own mission''s checklist'
);

select is(
  (select photos ->> 'front' from public.mission_vehicle_checklists where mission_id = :'mission_id'::uuid),
  'a/front.jpg',
  'the photos column is unchanged after the client''s blocked attempt'
);

-- 8-9: an agent may not touch the client-only columns, even though they
-- can update the same table for the photos column
select tests.authenticate_as(:'bob_id'::uuid);

-- clock_timestamp(), not now() — now() is fixed at transaction start
-- (constant for this whole file, since the file is one transaction),
-- so alice's original consent_signed_at and a naive now() here would be
-- bit-for-bit identical and never trip the trigger's IS DISTINCT FROM
-- check at all.
select throws_ok(
  format(
    'update public.mission_vehicle_checklists set consent_signed_at = clock_timestamp() where mission_id = %L',
    :'mission_id'::text
  ),
  'P0001',
  null,
  'an agent cannot update consent_signed_at on a mission''s vehicle checklist'
);

select is(
  (select insurance_confirmed from public.mission_vehicle_checklists where mission_id = :'mission_id'::uuid),
  true,
  'the client-provided fields remain intact after the agent''s blocked attempt'
);

select * from finish();

rollback;
