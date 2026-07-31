begin;

select plan(12);

select tests.create_test_user('alice-notif') as alice_id \gset
select tests.create_test_user('bob-notif') as bob_id \gset
select tests.create_test_user('dana-notif') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id = :'bob_id'::uuid;
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values (:'bob_id'::uuid, 'active', true);

-- 1-2: push token self-service + isolation
select tests.authenticate_as(:'bob_id'::uuid);
select lives_ok(
  format(
    'insert into public.push_tokens (user_id, expo_push_token) values (%L, %L)',
    :'bob_id'::text, 'ExponentPushToken[bob-device]'
  ),
  'a user can register their own push token'
);

select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select count(*) from public.push_tokens where user_id = :'bob_id'::uuid)::int,
  0,
  'another user cannot read someone else''s push tokens'
);

-- 3: alice disables push before her mission reaches any notifying transition
select lives_ok(
  format(
    'insert into public.notification_preferences (user_id, push_enabled, sms_enabled) values (%L, %L, %L)',
    :'alice_id'::text, 'false', 'true'
  ),
  'a user can set their own notification preferences'
);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_id \gset
update public.missions set status = 'quoted' where id = :'mission_id'::uuid;
update public.missions set payment_stub_confirmed = true, status = 'confirmed' where id = :'mission_id'::uuid;

-- 4-5: mission_confirmed notified to alice — sms only, push disabled
select is(
  (select count(*) from public.notification_log where user_id = :'alice_id'::uuid and event = 'mission_confirmed' and channel = 'push')::int,
  0,
  'no push log row for alice — she disabled push'
);

select is(
  (select count(*) from public.notification_log where user_id = :'alice_id'::uuid and event = 'mission_confirmed' and channel = 'sms')::int,
  1,
  'an sms log row still exists for alice — sms stayed enabled (default)'
);

-- 6-7: offer_received notified to bob — default prefs, both channels,
-- and a real (registered) token means the push row actually gets written
select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select is(
  (select count(*) from public.notification_log where user_id = :'bob_id'::uuid and event = 'offer_received' and channel = 'push')::int,
  1,
  'a push log row exists for bob — default preferences + a registered token'
);

select is(
  (select count(*) from public.notification_log where user_id = :'bob_id'::uuid and event = 'offer_received' and channel = 'sms')::int,
  1,
  'an sms log row also exists for bob (sms stub always logs regardless of a push token)'
);

-- 8: agent_arrived notified to alice on the arrived transition — sms only, same as before
select public.accept_mission_offer(:'offer_id'::uuid);
update public.missions set status = 'enroute' where id = :'mission_id'::uuid;
update public.missions set status = 'arrived' where id = :'mission_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select count(*) from public.notification_log where user_id = :'alice_id'::uuid and event = 'agent_arrived' and channel = 'sms')::int,
  1,
  'agent_arrived is logged to alice via sms (push stays disabled)'
);

-- 9-10: isolation on notification_log
select is(
  (select count(*) from public.notification_log where user_id = :'bob_id'::uuid)::int,
  0,
  'alice cannot read bob''s notification log'
);

select tests.authenticate_as(:'dana_id'::uuid);
select ok(
  (select count(*) from public.notification_log where user_id = :'bob_id'::uuid)::int > 0,
  'dispatcher can read all notification logs'
);

-- 11-12: no direct write path — only notify_event() (internal) writes this table
select tests.authenticate_as(:'bob_id'::uuid);
select throws_ok(
  format(
    'insert into public.notification_log (user_id, event, channel) values (%L, %L, %L)',
    :'bob_id'::text, 'offer_received', 'push'
  ),
  '42501',
  null,
  'no role has a direct insert grant on notification_log'
);

select throws_ok(
  format('update public.push_tokens set expo_push_token = %L where user_id = %L', 'tampered', :'bob_id'::text),
  '42501',
  null,
  'no role has an update grant on push_tokens — register or delete, never edit in place'
);

select * from finish();

rollback;
