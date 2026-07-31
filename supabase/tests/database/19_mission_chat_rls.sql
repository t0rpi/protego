begin;

select plan(9);

select tests.create_test_user('alice-chat') as alice_id \gset
select tests.create_test_user('bob-chat') as bob_id \gset
select tests.create_test_user('carol-chat') as carol_id \gset
select tests.create_test_user('dana-chat') as dana_id \gset

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
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_fixture_chat', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_id'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_id'::uuid);

-- 1: the assigned agent can message
select lives_ok(
  format(
    'insert into public.mission_chat_messages (mission_id, sender_id, body) values (%L, %L, %L)',
    :'mission_id'::text, :'bob_id'::text, 'sunt pe drum'
  ),
  'the assigned agent can send a chat message on their own mission'
);

-- 2: the client can message
select tests.authenticate_as(:'alice_id'::uuid);
select lives_ok(
  format(
    'insert into public.mission_chat_messages (mission_id, sender_id, body) values (%L, %L, %L)',
    :'mission_id'::text, :'alice_id'::text, 'perfect, te astept'
  ),
  'the client can send a chat message on their own mission'
);

-- 3: an uninvolved agent cannot
select tests.authenticate_as(:'carol_id'::uuid);
select throws_ok(
  format(
    'insert into public.mission_chat_messages (mission_id, sender_id, body) values (%L, %L, %L)',
    :'mission_id'::text, :'carol_id'::text, 'should not be allowed'
  ),
  '42501',
  null,
  'an uninvolved agent cannot post into someone else''s mission chat'
);

-- 4-6: read isolation
select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select count(*) from public.mission_chat_messages where mission_id = :'mission_id'::uuid)::int,
  2,
  'the client sees both messages on their own mission'
);

select tests.authenticate_as(:'carol_id'::uuid);
select is(
  (select count(*) from public.mission_chat_messages where mission_id = :'mission_id'::uuid)::int,
  0,
  'an uninvolved agent sees none of it'
);

select tests.authenticate_as(:'dana_id'::uuid);
select is(
  (select count(*) from public.mission_chat_messages where mission_id = :'mission_id'::uuid)::int,
  2,
  'dispatcher can read the mission chat (design: "monitorizată de dispecerat")'
);

-- 7-8: fixed record — no edit/delete for anyone
select tests.authenticate_as(:'alice_id'::uuid);
select id as message_id from public.mission_chat_messages
  where mission_id = :'mission_id'::uuid and sender_id = :'alice_id'::uuid \gset

select throws_ok(
  format('update public.mission_chat_messages set body = %L where id = %L', 'edited', :'message_id'::text),
  '42501',
  null,
  'no role has an update grant on mission_chat_messages'
);

select throws_ok(
  format('delete from public.mission_chat_messages where id = %L', :'message_id'::text),
  '42501',
  null,
  'no role has a delete grant on mission_chat_messages'
);

-- 9: retention placeholder is a real, readable config value
select is(
  (select value::text from public.platform_settings where key = 'chat_retention_days'),
  '90',
  'chat_retention_days exists as an editable, disclosed placeholder (compliance-checklist.md §3)'
);

select * from finish();

rollback;
