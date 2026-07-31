begin;

select plan(17);

select tests.create_test_user('alice-offers') as alice_id \gset
select tests.create_test_user('bob-offers') as bob_id \gset
select tests.create_test_user('carol-offers') as carol_id \gset
select tests.create_test_user('erik-offers') as erik_id \gset
select tests.create_test_user('frank-offers') as frank_id \gset
select tests.create_test_user('gina-offers') as gina_id \gset
select tests.create_test_user('dana-offers') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent'
  where id in (:'bob_id'::uuid, :'carol_id'::uuid, :'erik_id'::uuid, :'frank_id'::uuid, :'gina_id'::uuid);
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

-- bob: active + available — the "everything works" agent
insert into public.agents (id, status, is_available) values (:'bob_id'::uuid, 'active', true);
-- carol: active but NOT available
insert into public.agents (id, status, is_available) values (:'carol_id'::uuid, 'active', false);
-- erik: not active yet (in_review)
insert into public.agents (id, status, is_available) values (:'erik_id'::uuid, 'in_review', true);
-- frank: active + available, but has an expired document
insert into public.agents (id, status, is_available) values (:'frank_id'::uuid, 'active', true);
-- gina: active + available — used for the decline/expire flows
insert into public.agents (id, status, is_available) values (:'gina_id'::uuid, 'active', true);

select tests.authenticate_as(:'frank_id'::uuid);
insert into public.agent_documents (agent_id, type, file_path, expires_at)
values (:'frank_id'::uuid, 'cazier', 'agent-documents/frank/cazier.pdf', current_date - 1);

select tests.authenticate_as(:'alice_id'::uuid);

-- Helper pattern repeated per mission: draft -> quoted -> confirmed,
-- on_foot/hourly so none of the client-vehicle checklist machinery is
-- involved — this file is about offers, not that rule.
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, pickup_address)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, 'Str. Exemplu 10, Oradea' from public.services where key = 'hourly'
returning id as mission1_id \gset
update public.missions set status = 'quoted' where id = :'mission1_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission1_id'::uuid, 'auth', 'pi_fixture_m1', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission1_id'::uuid;

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission2_id \gset
update public.missions set status = 'quoted' where id = :'mission2_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission2_id'::uuid, 'auth', 'pi_fixture_m2', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission2_id'::uuid;

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission3_id \gset
update public.missions set status = 'quoted' where id = :'mission3_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission3_id'::uuid, 'auth', 'pi_fixture_m3', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission3_id'::uuid;

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission4_id \gset
update public.missions set status = 'quoted' where id = :'mission4_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission4_id'::uuid, 'auth', 'pi_fixture_m4', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission4_id'::uuid;

-- mission5 stays in draft — used for the "not in the unassigned pool" case
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission5_id \gset

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission6_id \gset
update public.missions set status = 'quoted' where id = :'mission6_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission6_id'::uuid, 'auth', 'pi_fixture_m6', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission6_id'::uuid;

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission7_id \gset
update public.missions set status = 'quoted' where id = :'mission7_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission7_id'::uuid, 'auth', 'pi_fixture_m7', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission7_id'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);

-- 1: dispatcher creates an offer to bob for mission1
select lives_ok(
  format('select public.create_mission_offer(%L, %L)', :'mission1_id'::text, :'bob_id'::text),
  'dispatcher can create an offer for an active, available, document-valid agent'
);

select id as offer1_id from public.mission_offers where mission_id = :'mission1_id'::uuid \gset

-- 2: a second offer on the same mission while one is still pending is refused
select throws_ok(
  format('select public.create_mission_offer(%L, %L)', :'mission1_id'::text, :'bob_id'::text),
  'P0001',
  null,
  'a mission already carrying a pending offer cannot receive a second one'
);

select tests.authenticate_as(:'bob_id'::uuid);

-- 3: address masked while the offer is still pending
select is(
  (select pickup_address from public.agent_mission_briefs where offer_id = :'offer1_id'::uuid),
  null,
  'pickup_address is masked while the offer is pending'
);

select is(
  (select verification_code from public.agent_mission_briefs where offer_id = :'offer1_id'::uuid),
  null,
  'verification_code is masked while the offer is pending'
);

-- 4: bob accepts
select lives_ok(
  format('select public.accept_mission_offer(%L)', :'offer1_id'::text),
  'the offered agent can accept a pending, unexpired offer'
);

select is(
  (select status::text from public.missions where id = :'mission1_id'::uuid),
  'assigned',
  'accepting the offer moves the mission confirmed -> assigned'
);

-- 5: address unmasked after acceptance
select is(
  (select pickup_address is not null from public.agent_mission_briefs where offer_id = :'offer1_id'::uuid),
  true,
  'pickup_address is revealed once the offer is accepted'
);

-- 6: isolation — carol never sees bob's brief
select tests.authenticate_as(:'carol_id'::uuid);

select is(
  (select count(*) from public.agent_mission_briefs where offer_id = :'offer1_id'::uuid)::int,
  0,
  'another agent cannot see a brief that is not theirs'
);

select tests.authenticate_as(:'dana_id'::uuid);

-- 7: agent not available
select throws_ok(
  format('select public.create_mission_offer(%L, %L)', :'mission2_id'::text, :'carol_id'::text),
  'P0001',
  null,
  'an offer cannot be created for an agent who is not available'
);

-- 8: agent not active
select throws_ok(
  format('select public.create_mission_offer(%L, %L)', :'mission3_id'::text, :'erik_id'::text),
  'P0001',
  null,
  'an offer cannot be created for an agent who is not active yet'
);

-- 9: agent with an expired document — repository-audit.md §6, automatic, no override
select throws_ok(
  format('select public.create_mission_offer(%L, %L)', :'mission4_id'::text, :'frank_id'::text),
  'P0001',
  null,
  'an offer cannot be created for an agent with an expired document'
);

-- 10: mission not in the unassigned pool (still draft)
select throws_ok(
  format('select public.create_mission_offer(%L, %L)', :'mission5_id'::text, :'gina_id'::text),
  'P0001',
  null,
  'an offer cannot be created for a mission that is not in the confirmed/unassigned pool'
);

-- 11: decline flow
select public.create_mission_offer(:'mission6_id'::uuid, :'gina_id'::uuid) as offer6_id \gset

select tests.authenticate_as(:'gina_id'::uuid);

select lives_ok(
  format('select public.decline_mission_offer(%L)', :'offer6_id'::text),
  'the offered agent can decline a pending offer'
);

-- Checked via the dispatcher, not gina: a declined offer never reaches
-- 'accepted', so gina never gains the accepted-offer SELECT policy on
-- missions — by design, declining doesn't hand her any visibility.
select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select elevated_priority from public.missions where id = :'mission6_id'::uuid),
  true,
  'declining sets elevated_priority so the mission is prioritized for re-offering'
);

-- 12-13: expire flow
select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission7_id'::uuid, :'gina_id'::uuid) as offer7_id \gset

select tests.authenticate_as(:'gina_id'::uuid);

select throws_ok(
  format('select public.expire_mission_offer(%L)', :'offer7_id'::text),
  'P0001',
  null,
  'an offer that has not reached its 45s expiry yet cannot be expired'
);

select tests.clear_authentication();
update public.mission_offers set expires_at = now() - interval '1 second' where id = :'offer7_id'::uuid;
select tests.authenticate_as(:'gina_id'::uuid);

select lives_ok(
  format('select public.expire_mission_offer(%L)', :'offer7_id'::text),
  'the offered agent can expire their own offer once its 45s window has passed'
);

-- 14: an offer past expiry can no longer be accepted, even if still "pending"
select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission6_id'::uuid, :'gina_id'::uuid) as offer6b_id \gset

select tests.clear_authentication();
update public.mission_offers set expires_at = now() - interval '1 second' where id = :'offer6b_id'::uuid;
select tests.authenticate_as(:'gina_id'::uuid);

select throws_ok(
  format('select public.accept_mission_offer(%L)', :'offer6b_id'::text),
  'P0001',
  null,
  'an expired offer cannot be accepted even while its row still says pending'
);

select * from finish();

rollback;
