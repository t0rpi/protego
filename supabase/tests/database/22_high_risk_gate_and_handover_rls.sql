begin;

select plan(11);

select tests.create_test_user('alice-highrisk') as alice_id \gset
select tests.create_test_user('bob-highrisk') as bob_id \gset
select tests.create_test_user('dana-highrisk') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id = :'bob_id'::uuid;
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values (:'bob_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, context_threat_known)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, true from public.services where key = 'hourly'
returning id as risky_mission_id \gset
update public.missions set status = 'quoted' where id = :'risky_mission_id'::uuid;
update public.missions set status = 'review' where id = :'risky_mission_id'::uuid;

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, context_threat_known)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, true from public.services where key = 'hourly'
returning id as risky_mission2_id \gset
update public.missions set status = 'quoted' where id = :'risky_mission2_id'::uuid;
update public.missions set status = 'review' where id = :'risky_mission2_id'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);

-- 1: confirming without a logged call is refused (design dispatcher.level2Gate)
select throws_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'risky_mission_id'::text),
  'P0001',
  null,
  'a dispatcher cannot confirm a high-risk mission without a logged call'
);

-- 2: logging the call
select lives_ok(
  format(
    'insert into public.call_intents (mission_id, initiated_by, target_user_id, purpose) values (%L, %L, %L, %L)',
    :'risky_mission_id'::text, :'dana_id'::text, :'alice_id'::text, 'high_risk_review_call'
  ),
  'the dispatcher can log a call intent for the high-risk mission'
);

-- 3: confirming now succeeds
select lives_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'risky_mission_id'::text),
  'confirming succeeds once a call is logged (and level-2 verification already held)'
);

-- 4: request_more_info on the other review mission
select lives_ok(
  format('select public.request_more_info(%L, %L)', :'risky_mission2_id'::text, 'nevoie de mai multe detalii despre amenintare'),
  'dispatcher can request more info on a mission in review'
);

select is(
  (select count(*) from public.audit_log where entity = 'missions' and action = 'requested_more_info' and entity_id = :'risky_mission2_id'::uuid)::int,
  1,
  'requesting more info is journaled to audit_log'
);

-- 5: request_more_info on a non-review mission is refused
select throws_ok(
  format('select public.request_more_info(%L, %L)', :'risky_mission_id'::text, 'too late, already confirmed'),
  'P0001',
  null,
  'request_more_info is refused once the mission is no longer in review'
);

-- 6: a non-dispatcher cannot hand over a shift
select tests.authenticate_as(:'bob_id'::uuid);
select throws_ok(
  'select public.create_shift_handover(''test note'')',
  'P0001',
  null,
  'only a dispatcher or admin can hand over a shift'
);

-- 7-10: the handover snapshot itself
select tests.authenticate_as(:'dana_id'::uuid);
select public.create_shift_handover('predau tura, totul e sub control') as handover_id \gset

select ok(
  (select :'risky_mission2_id'::uuid = any(pending_high_risk_mission_ids) from public.shift_handovers where id = :'handover_id'::uuid),
  'the pending high-risk mission is captured in the handover snapshot'
);

select is(
  (select note from public.shift_handovers where id = :'handover_id'::uuid),
  'predau tura, totul e sub control',
  'the handover note is stored as written'
);

select is(
  (select count(*) from public.audit_log where entity = 'shift_handovers' and action = 'shift_handover' and entity_id = :'handover_id'::uuid)::int,
  1,
  'the handover itself is journaled to audit_log'
);

-- 11: read isolation on shift_handovers
select tests.authenticate_as(:'bob_id'::uuid);
select is(
  (select count(*) from public.shift_handovers where id = :'handover_id'::uuid)::int,
  0,
  'an agent cannot read shift handover records'
);

select * from finish();

rollback;
