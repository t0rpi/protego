begin;

select plan(18);

select tests.create_test_user('alice-sos') as alice_id \gset
select tests.create_test_user('bob-sos') as bob_id \gset
select tests.create_test_user('carol-sos') as carol_id \gset
select tests.create_test_user('dana-sos') as dana_id \gset

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
update public.missions set status = 'enroute' where id = :'mission_id'::uuid;
update public.missions set status = 'arrived' where id = :'mission_id'::uuid;
select public.start_mission_protection(
  :'mission_id'::uuid,
  (select verification_code from public.missions where id = :'mission_id'::uuid)
);

-- 1: an uninvolved agent cannot trigger SOS on someone else's mission
select tests.authenticate_as(:'carol_id'::uuid);
select throws_ok(
  format('select public.trigger_sos(%L, %L, %L)', :'mission_id'::text, '46.95', '21.92'),
  'P0001',
  null,
  'an uninvolved agent cannot trigger SOS on a mission that isn''t theirs'
);

-- 2-3: the client triggers SOS on their own active mission — this is
-- also where we measure the DB-side latency of the write path
-- (insert + notify_event, including the best-effort push attempt).
-- This is NOT an end-to-end Realtime-channel-to-dispatcher-UI
-- measurement (that needs a live app/websocket harness this suite
-- doesn't have) — it is the one link in that chain a database test can
-- actually observe: how long the row takes to exist and be queryable.
select tests.authenticate_as(:'alice_id'::uuid);

select clock_timestamp() as t0 \gset
select public.trigger_sos(:'mission_id'::uuid, 46.9501, 21.9202) as event_id \gset
select clock_timestamp() as t1 \gset

select ok(
  (select count(*) from public.shield_events where id = :'event_id'::uuid)::int = 1,
  'trigger_sos() created exactly one event, visible immediately in the same transaction'
);

select ok(
  extract(epoch from :'t1'::timestamptz - :'t0'::timestamptz) < 0.5,
  format(
    'DB-side SOS write path (insert + notify_event) completed in %s ms — well inside the 1.5s/3s system budget (repository-audit.md §5.2), though this measures only the DB leg, not full Realtime delivery',
    round(extract(epoch from :'t1'::timestamptz - :'t0'::timestamptz) * 1000)
  )
);

-- 4-6: read access
select is(
  (select count(*) from public.shield_events where id = :'event_id'::uuid)::int,
  1,
  'the triggering client can read their own event'
);

select tests.authenticate_as(:'carol_id'::uuid);
select is(
  (select count(*) from public.shield_events where id = :'event_id'::uuid)::int,
  0,
  'an uninvolved agent cannot read someone else''s SOS event'
);

select tests.authenticate_as(:'dana_id'::uuid);
select is(
  (select count(*) from public.shield_events where id = :'event_id'::uuid)::int,
  1,
  'dispatcher can read all SOS events'
);

-- 7: a non-dispatcher cannot acknowledge
select tests.authenticate_as(:'bob_id'::uuid);
select throws_ok(
  format('select public.acknowledge_sos(%L)', :'event_id'::text),
  'P0001',
  null,
  'only a dispatcher or admin can acknowledge an SOS event'
);

-- 8: dispatcher acknowledges
select tests.authenticate_as(:'dana_id'::uuid);
select lives_ok(
  format('select public.acknowledge_sos(%L)', :'event_id'::text),
  'dispatcher can acknowledge the event'
);

select is(
  (select status::text from public.shield_events where id = :'event_id'::uuid),
  'acknowledged',
  'event status is now acknowledged'
);

-- 9: acknowledging it fires a notification back to the triggering client
select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select count(*) from public.notification_log where user_id = :'alice_id'::uuid and event = 'sos_acknowledged')::int,
  1,
  'the triggering client is notified once dispatch acknowledges'
);

-- 10-11: the resolve gate — journal AND all 4 protocol steps required
select tests.authenticate_as(:'dana_id'::uuid);
select throws_ok(
  format('select public.resolve_sos(%L, %L)', :'event_id'::text, ''),
  'P0001',
  null,
  'resolving without a journal entry is refused'
);

select public.update_sos_protocol_step(:'event_id'::uuid, 'p1', true);
select public.update_sos_protocol_step(:'event_id'::uuid, 'p2', true);
select public.update_sos_protocol_step(:'event_id'::uuid, 'p3', true);

select throws_ok(
  format('select public.resolve_sos(%L, %L)', :'event_id'::text, 'client is safe, false alarm confirmed by phone'),
  'P0001',
  null,
  'resolving with an incomplete protocol checklist (3 of 4 steps) is refused even with a journal'
);

-- 12: completing all 4 steps + journal succeeds
select public.update_sos_protocol_step(:'event_id'::uuid, 'p4', true);
select lives_ok(
  format('select public.resolve_sos(%L, %L)', :'event_id'::text, 'client is safe, false alarm confirmed by phone'),
  'resolving succeeds once all 4 steps are checked and a journal is written'
);

select is(
  (select status::text from public.shield_events where id = :'event_id'::uuid),
  'resolved',
  'event status is now resolved'
);

-- 13: audit trail
select ok(
  (select count(*) from public.audit_log where entity = 'shield_events' and entity_id = :'event_id'::uuid)::int >= 3,
  'trigger/acknowledge/resolve all left an audit_log entry'
);

-- 14-16: the agent's own emergency button + cancel-as-false-alarm
select tests.authenticate_as(:'bob_id'::uuid);
select public.trigger_sos(:'mission_id'::uuid, 46.9505, 21.9205) as event2_id \gset

select is(
  (select source::text from public.shield_events where id = :'event2_id'::uuid),
  'mission',
  'the agent''s emergency button logs the same mission-sourced event type'
);

select lives_ok(
  format('select public.cancel_sos(%L)', :'event2_id'::text),
  'the person who triggered an SOS can cancel it as a false alarm'
);

select tests.authenticate_as(:'alice_id'::uuid);
select public.trigger_sos(:'mission_id'::uuid, 46.9501, 21.9202) as event3_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select throws_ok(
  format('select public.cancel_sos(%L)', :'event3_id'::text),
  'P0001',
  null,
  'only the person who triggered the SOS can cancel it — bob cannot cancel alice''s event'
);

select * from finish();

rollback;
