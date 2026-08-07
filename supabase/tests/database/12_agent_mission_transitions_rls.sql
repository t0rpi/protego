begin;

select plan(21);

select tests.create_test_user('alice-transit') as alice_id \gset
select tests.create_test_user('bob-transit') as bob_id \gset
select tests.create_test_user('carol-transit') as carol_id \gset
select tests.create_test_user('dave-transit') as dave_id \gset
select tests.create_test_user('dana-transit') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id in (:'bob_id'::uuid, :'carol_id'::uuid, :'dave_id'::uuid);
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values
  (:'bob_id'::uuid, 'active', true),
  (:'carol_id'::uuid, 'active', true),
  (:'dave_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);

-- Mission A: the full happy path (assigned -> enroute -> arrived -> active -> done)
-- F3 fix (2026-08-07, audit-findings.md): a fixed literal date is only
-- "safely in the future" until the real clock catches up to it, at
-- which point create_quote_for_mission()'s urgent-coefficient check
-- silently starts firing. Computed dynamically (next Tuesday 14:00
-- UTC) so it never expires.
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, scheduled_at)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2,
  date_trunc('week', now()) + interval '1 week' + interval '1 day' + interval '14 hours'
from public.services where key = 'hourly'
returning id as mission_a \gset
update public.missions set status = 'quoted' where id = :'mission_a'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_a'::uuid, 'auth', 'pi_fixture_a', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_a'::uuid;
select public.create_quote_for_mission(:'mission_a'::uuid);

-- Mission B: for the raw-bypass negative tests
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_b \gset
update public.missions set status = 'quoted' where id = :'mission_b'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_b'::uuid, 'auth', 'pi_fixture_b', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_b'::uuid;

-- Mission C: for the column-ownership test
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, pickup_address)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, 'original address' from public.services where key = 'hourly'
returning id as mission_c \gset
update public.missions set status = 'quoted' where id = :'mission_c'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_c'::uuid, 'auth', 'pi_fixture_c', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_c'::uuid;

-- Mission D: isolation (carol must not touch bob's assignment)
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_d \gset
update public.missions set status = 'quoted' where id = :'mission_d'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_d'::uuid, 'auth', 'pi_fixture_d', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_d'::uuid;

-- Mission E: agent_cancel_mission happy path + reassignment
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_e \gset
update public.missions set status = 'quoted' where id = :'mission_e'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_e'::uuid, 'auth', 'pi_fixture_e', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_e'::uuid;

-- Mission F: agent_cancel_mission wrong-caller
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_f \gset
update public.missions set status = 'quoted' where id = :'mission_f'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_f'::uuid, 'auth', 'pi_fixture_f', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_f'::uuid;

-- Mission G: agent_cancel_mission wrong-status (already active)
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_g \gset
update public.missions set status = 'quoted' where id = :'mission_g'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_g'::uuid, 'auth', 'pi_fixture_g', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_g'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);

select public.create_mission_offer(:'mission_a'::uuid, :'bob_id'::uuid) as offer_a \gset
select public.create_mission_offer(:'mission_b'::uuid, :'bob_id'::uuid) as offer_b \gset
select public.create_mission_offer(:'mission_c'::uuid, :'bob_id'::uuid) as offer_c \gset
select public.create_mission_offer(:'mission_d'::uuid, :'bob_id'::uuid) as offer_d \gset
select public.create_mission_offer(:'mission_e'::uuid, :'dave_id'::uuid) as offer_e \gset
select public.create_mission_offer(:'mission_f'::uuid, :'dave_id'::uuid) as offer_f \gset
select public.create_mission_offer(:'mission_g'::uuid, :'dave_id'::uuid) as offer_g \gset

select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_a'::uuid);
select public.accept_mission_offer(:'offer_b'::uuid);
select public.accept_mission_offer(:'offer_c'::uuid);
select public.accept_mission_offer(:'offer_d'::uuid);

select tests.authenticate_as(:'dave_id'::uuid);
select public.accept_mission_offer(:'offer_e'::uuid);
select public.accept_mission_offer(:'offer_f'::uuid);
select public.accept_mission_offer(:'offer_g'::uuid);

select tests.authenticate_as(:'bob_id'::uuid);

-- 1-2: one-tap status flow on mission A
select lives_ok(
  format('update public.missions set status = %L where id = %L', 'enroute', :'mission_a'::text),
  'the assigned agent can mark assigned -> enroute'
);

select lives_ok(
  format('update public.missions set status = %L where id = %L', 'arrived', :'mission_a'::text),
  'the assigned agent can mark enroute -> arrived'
);

-- 3-4: verification-code gate
select throws_ok(
  format('select public.start_mission_protection(%L, %L)', :'mission_a'::text, '0000'),
  'P0001',
  null,
  'starting protection with the wrong code is rejected'
);

select lives_ok(
  format(
    'select public.start_mission_protection(%L, (select verification_code from public.missions where id = %L))',
    :'mission_a'::text, :'mission_a'::text
  ),
  'starting protection with the correct code succeeds'
);

select is(
  (select status::text from public.missions where id = :'mission_a'::uuid),
  'active',
  'mission A is now active'
);

-- 5-9: completion + earnings
select tests.authenticate_as(:'carol_id'::uuid);

select throws_ok(
  format('select public.complete_mission(%L, %L)', :'mission_a'::text, 'not my mission'),
  'P0001',
  null,
  'an agent who is not assigned to the mission cannot complete it'
);

select tests.authenticate_as(:'bob_id'::uuid);

select lives_ok(
  format('select public.complete_mission(%L, %L)', :'mission_a'::text, 'all good, client dropped off safely'),
  'the assigned agent can complete an active mission'
);

select is(
  (select status::text from public.missions where id = :'mission_a'::uuid),
  'done',
  'mission A is now done'
);

select is(
  (select count(*) from public.mission_reports where mission_id = :'mission_a'::uuid)::int,
  1,
  'completing the mission wrote exactly one guided report'
);

-- v2.3 (M5): complete_mission() recomputes the final labor component
-- from REAL duration with no coefficients (min-billing floor still
-- applies: 130*2h=260), then applies agent_share_pct=0.55 to that —
-- not to the (possibly coefficient-inflated) initial quote total.
select is(
  (select amount from public.agent_earnings where mission_id = :'mission_a'::uuid),
  143.00,
  'agent earnings = final recomputed labor (130*2=260, no coefficients at completion) x agent_share_pct (0.55) = 143.00'
);

-- 10: isolation on mission D. Carol has no accepted offer here, so she
-- has neither the SELECT nor UPDATE policy match on this row — Postgres
-- RLS makes the row invisible to her UPDATE entirely, which is a silent
-- zero-row no-op, not a raised exception (unlike the trigger-raised
-- exceptions below, which fire only once RLS has already let a
-- structurally-valid row through).
select tests.authenticate_as(:'carol_id'::uuid);

select lives_ok(
  format('update public.missions set status = %L where id = %L', 'enroute', :'mission_d'::text),
  'an update statement itself does not error for a row RLS makes invisible'
);

select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select status::text from public.missions where id = :'mission_d'::uuid),
  'assigned',
  'but the row was never actually touched — an agent with no accepted offer cannot drive this mission''s status'
);

-- 11: raw bypass of arrived -> active on mission B
select tests.authenticate_as(:'bob_id'::uuid);
update public.missions set status = 'enroute' where id = :'mission_b'::uuid;
update public.missions set status = 'arrived' where id = :'mission_b'::uuid;

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'active', :'mission_b'::text),
  'P0001',
  null,
  'a raw UPDATE cannot bypass start_mission_protection() for arrived -> active'
);

-- 12: raw bypass of active -> done, once legitimately active
select public.start_mission_protection(
  :'mission_b'::uuid,
  (select verification_code from public.missions where id = :'mission_b'::uuid)
);

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'done', :'mission_b'::text),
  'P0001',
  null,
  'a raw UPDATE cannot bypass complete_mission() for active -> done'
);

-- 13: column ownership — an assigned agent may only move status, not booking fields
select throws_ok(
  format(
    'update public.missions set status = %L, pickup_address = %L where id = %L',
    'enroute', 'hacked address', :'mission_c'::text
  ),
  'P0001',
  null,
  'an assigned agent cannot smuggle a booking-field change in alongside a status update'
);

-- 14-17: agent cancellation + reassignment on mission E
select tests.authenticate_as(:'dave_id'::uuid);

select lives_ok(
  format('select public.agent_cancel_mission(%L)', :'mission_e'::text),
  'the assigned agent can release their assignment back to the pool'
);

-- Checked via the dispatcher, not dave: cancellation downgrades dave's
-- own offer to 'declined', so he immediately loses the accepted-offer
-- SELECT policy on this mission — by design, releasing the assignment
-- doesn't leave him with lingering visibility into it.
select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select status::text from public.missions where id = :'mission_e'::uuid),
  'confirmed',
  'mission E returned to confirmed (the unassigned pool)'
);

select is(
  (select elevated_priority from public.missions where id = :'mission_e'::uuid),
  true,
  'mission E is flagged elevated_priority after the agent cancellation'
);

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_e'::uuid, :'bob_id'::uuid) as offer_e2 \gset

select tests.authenticate_as(:'bob_id'::uuid);

select lives_ok(
  format('select public.accept_mission_offer(%L)', :'offer_e2'::text),
  'a different agent can accept a fresh offer on the reassigned mission — dave''s stale offer does not interfere'
);

-- 18: wrong-caller cancellation on mission F
select tests.authenticate_as(:'carol_id'::uuid);

select throws_ok(
  format('select public.agent_cancel_mission(%L)', :'mission_f'::text),
  'P0001',
  null,
  'an agent not assigned to the mission cannot cancel someone else''s assignment'
);

-- 19: wrong-status cancellation on mission G (already active)
select tests.authenticate_as(:'dave_id'::uuid);
update public.missions set status = 'enroute' where id = :'mission_g'::uuid;
update public.missions set status = 'arrived' where id = :'mission_g'::uuid;
select public.start_mission_protection(
  :'mission_g'::uuid,
  (select verification_code from public.missions where id = :'mission_g'::uuid)
);

select throws_ok(
  format('select public.agent_cancel_mission(%L)', :'mission_g'::text),
  'P0001',
  null,
  'a mission that is already active can no longer be released back to the pool'
);

select * from finish();

rollback;
