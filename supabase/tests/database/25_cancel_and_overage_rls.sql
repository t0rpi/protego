begin;

select plan(14);

select tests.create_test_user('alice-cancel') as alice_id \gset
select tests.create_test_user('bob-cancel') as bob_id \gset
select tests.create_test_user('dana-cancel') as dana_id \gset
select tests.create_test_user('admin-cancel') as admin_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'admin' where id = :'admin_id'::uuid;
update public.profiles set role = 'agent' where id = :'bob_id'::uuid;
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values (:'bob_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);

-- 1: cancelling a draft mission is always fee-free (no payment exists,
-- no confirmed-mission fee logic applies)
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_draft \gset

select is(
  (select public.cancel_mission_by_client(:'mission_draft'::uuid)),
  0.00,
  'cancelling a draft mission is free (fee=0)'
);

select is(
  (select status::text from public.missions where id = :'mission_draft'::uuid),
  'cancelled_client',
  'the draft mission is now cancelled_client'
);

-- 2: a confirmed mission scheduled comfortably outside the free window
-- (2h from now, free_cancel_minutes default=60) cancels for free
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, scheduled_at)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, now() + interval '2 hours' from public.services where key = 'hourly'
returning id as mission_free \gset
update public.missions set status = 'quoted' where id = :'mission_free'::uuid;
select public.create_quote_for_mission(:'mission_free'::uuid);
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_free'::uuid, 'auth', 'pi_cancel_free', '338.80', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_free'::uuid;

select is(
  (select public.cancel_mission_by_client(:'mission_free'::uuid)),
  0.00,
  'cancelling a confirmed mission still 2h out (inside the 60-minute free window) is free'
);

-- 3: a confirmed mission scheduled only 10 minutes out (breaches the
-- 60-minute free window) charges the v2.3 §22 fee. Being <=30 minutes
-- out also makes create_quote_for_mission() treat this as urgent
-- (coef 1.20): 130*2*1.20=312 labor, +20 platform, *1.21 VAT = 401.72;
-- fee = 401.72 * 0.30 = 120.516.
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, scheduled_at)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, now() + interval '10 minutes' from public.services where key = 'hourly'
returning id as mission_late \gset
update public.missions set status = 'quoted' where id = :'mission_late'::uuid;
select public.create_quote_for_mission(:'mission_late'::uuid);
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_late'::uuid, 'auth', 'pi_cancel_late', '401.72', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_late'::uuid;

select is(
  (select public.cancel_mission_by_client(:'mission_late'::uuid)),
  120.516,
  'cancelling just 10 minutes before a scheduled, confirmed mission charges 30% of the (urgent-coefficient) estimate (120.516)'
);

-- 4: an immediate (scheduled_at is null) confirmed mission is never
-- "within" the free window once confirmed (disclosed interpretation)
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_immediate \gset
update public.missions set status = 'quoted' where id = :'mission_immediate'::uuid;
select public.create_quote_for_mission(:'mission_immediate'::uuid);
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_immediate'::uuid, 'auth', 'pi_cancel_immediate', '338.80', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_immediate'::uuid;

-- P1b pricing decision (founder, 2026-08-07, option B): a null
-- scheduled_at ("Acum") is no longer urgent at all -- create_quote_for_
-- mission() used to treat "no scheduled_at" as always urgent, which is
-- exactly the bug that decision fixed. This mission now gets the same
-- non-urgent 338.80 total as the "still 2h out" case above (130*2+20,
-- *1.21 VAT), so its fee is 338.80*0.30=101.64, not the old 120.516.
select is(
  (select public.cancel_mission_by_client(:'mission_immediate'::uuid)),
  101.64,
  'an immediate (no scheduled_at) confirmed booking is never "within" the free window, so the fee still applies -- at the non-urgent total'
);

-- 5: only the mission's own client can cancel it
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_wrongcaller \gset

select tests.authenticate_as(:'bob_id'::uuid);
select throws_ok(
  format('select public.cancel_mission_by_client(%L)', :'mission_wrongcaller'::text),
  'P0001',
  null,
  'an uninvolved user cannot cancel someone else''s mission'
);

-- 6: a mission that's already done cannot be cancelled
select tests.authenticate_as(:'alice_id'::uuid);
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_done \gset
update public.missions set status = 'quoted' where id = :'mission_done'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_done'::uuid, 'auth', 'pi_cancel_done', '338.80', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_done'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_done'::uuid, :'bob_id'::uuid) as offer_done \gset
select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_done'::uuid);
update public.missions set status = 'assigned' where id = :'mission_done'::uuid;
update public.missions set status = 'enroute' where id = :'mission_done'::uuid;
update public.missions set status = 'arrived' where id = :'mission_done'::uuid;
select public.start_mission_protection(
  :'mission_done'::uuid,
  (select verification_code from public.missions where id = :'mission_done'::uuid)
);
select public.complete_mission(:'mission_done'::uuid, 'all good');

select tests.authenticate_as(:'alice_id'::uuid);
select throws_ok(
  format('select public.cancel_mission_by_client(%L)', :'mission_done'::text),
  'P0001',
  null,
  'a mission that is already done cannot be cancelled'
);

-- 7: a raw client-side UPDATE to cancelled_client (bypassing the
-- function entirely) is refused — must go through cancel_mission_by_client()
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_bypass \gset

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'cancelled_client', :'mission_bypass'::text),
  'P0001',
  null,
  'a raw UPDATE to cancelled_client is refused — cancel_mission_by_client() is the only path'
);

-- 8: audit_log captures the cancellation (admin-only read)
select tests.authenticate_as(:'admin_id'::uuid);
select ok(
  (select count(*) from public.audit_log where action = 'mission_cancelled' and entity_id = :'mission_late'::uuid) >= 1,
  'mission cancellation is journaled to audit_log'
);
select tests.authenticate_as(:'alice_id'::uuid);

-- === overage ===

-- 9: request_mission_overage requires an active mission
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_overage \gset
update public.missions set status = 'quoted' where id = :'mission_overage'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_overage'::uuid, 'auth', 'pi_overage', '338.80', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_overage'::uuid;

select throws_ok(
  format('select public.request_mission_overage(%L, %L)', :'mission_overage'::text, '2'),
  'P0001',
  null,
  'an extension cannot be requested before the mission is active'
);

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_overage'::uuid, :'bob_id'::uuid) as offer_overage \gset
select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_overage'::uuid);
update public.missions set status = 'assigned' where id = :'mission_overage'::uuid;
update public.missions set status = 'enroute' where id = :'mission_overage'::uuid;
update public.missions set status = 'arrived' where id = :'mission_overage'::uuid;
select public.start_mission_protection(
  :'mission_overage'::uuid,
  (select verification_code from public.missions where id = :'mission_overage'::uuid)
);

-- 10: the mission's own client can request a 2h extension: 130*2=260 labor, +21% VAT = 314.60
select tests.authenticate_as(:'alice_id'::uuid);
select is(
  (select ((public.request_mission_overage(:'mission_overage'::uuid, 2)) ->> 'total')::numeric),
  314.60,
  'a 2h overage on Hourly bills 130*2=260 labor + 21% VAT = 314.60'
);

select is(
  (select count(*) from public.quotes where mission_id = :'mission_overage'::uuid and kind = 'overage')::int,
  1,
  'the overage request created exactly one kind=overage quote'
);

-- 11: overage does not apply to Protect Ride
insert into public.missions (client_id, service_id, city, mobility, agent_count, distance_km)
select :'alice_id'::uuid, id, 'Oradea', 'protego_vehicle', 1, 10 from public.services where key = 'protect_ride'
returning id as mission_ride \gset
update public.missions set status = 'quoted' where id = :'mission_ride'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_ride'::uuid, 'auth', 'pi_ride', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_ride'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_ride'::uuid, :'bob_id'::uuid) as offer_ride \gset
select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_ride'::uuid);
update public.missions set status = 'assigned' where id = :'mission_ride'::uuid;
update public.missions set status = 'enroute' where id = :'mission_ride'::uuid;
update public.missions set status = 'arrived' where id = :'mission_ride'::uuid;
select public.start_mission_protection(
  :'mission_ride'::uuid,
  (select verification_code from public.missions where id = :'mission_ride'::uuid)
);

select tests.authenticate_as(:'alice_id'::uuid);
select throws_ok(
  format('select public.request_mission_overage(%L, %L)', :'mission_ride'::text, '1'),
  'P0001',
  null,
  'Protect Ride is distance-based — overage (extra hours) does not apply to it'
);

-- 12: only the mission's own client can request an extension
select tests.authenticate_as(:'bob_id'::uuid);
select throws_ok(
  format('select public.request_mission_overage(%L, %L)', :'mission_overage'::text, '1'),
  'P0001',
  null,
  'an uninvolved user (even the assigned agent) cannot request an overage on someone else''s mission'
);

select * from finish();

rollback;
