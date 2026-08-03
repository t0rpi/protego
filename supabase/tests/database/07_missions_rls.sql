begin;

select plan(20);

select tests.create_test_user('alice-mission') as alice_id \gset
select tests.create_test_user('bob-mission') as bob_id \gset
select tests.create_test_user('dana-mission') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
-- Level-2 verification is required to confirm a mission (M1 gate,
-- attached here per the plan in packages/domain/src/verification/rules.ts).
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

-- 1-3: creating a normal-risk, on-foot mission and the system-owned columns
insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2
from public.services where key = 'hourly'
returning id as normal_mission_id \gset

select is(
  (select risk_level from public.missions where id = :'normal_mission_id'::uuid),
  'normal',
  'a mission with no known threat is risk_level=normal by default'
);

select ok(
  (select verification_code from public.missions where id = :'normal_mission_id'::uuid) ~ '^[0-9]{4}$',
  'a 4-digit verification_code is generated automatically'
);

select throws_ok(
  format('update public.missions set verification_code = %L where id = %L', '0000', :'normal_mission_id'::text),
  '42501',
  null,
  'verification_code has no update grant — a client can never pick their own code'
);

-- 4: draft -> quoted requires the service to be enabled in that city
insert into public.missions (client_id, service_id, city, mobility, agent_count)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1
from public.services where key = 'shield'
returning id as shield_mission_id \gset

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'quoted', :'shield_mission_id'::text),
  'P0001',
  null,
  'draft -> quoted is refused when the service is disabled in that city (shield/Oradea)'
);

-- 5: draft -> quoted succeeds for the normal mission (service enabled)
select lives_ok(
  format('update public.missions set status = %L where id = %L', 'quoted', :'normal_mission_id'::text),
  'draft -> quoted succeeds once service/mobility/city are set and the service is enabled'
);

-- 6-7: quoted -> confirmed requires the payment stub first
select throws_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'normal_mission_id'::text),
  'P0001',
  null,
  'quoted -> confirmed is refused before the payment stub is confirmed'
);

-- M5: a payment authorization now replaces the old payment_stub_confirmed
-- boolean — record it as service_role (the only role allowed to write
-- public.payments), then resume as alice.
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'normal_mission_id'::uuid, 'auth', 'pi_fixture_normal', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);

select lives_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'normal_mission_id'::text),
  'quoted -> confirmed succeeds once risk=normal, verification_level=2 and a payment authorization are all satisfied'
);

-- 8-13: the high-risk path — never auto-confirms
insert into public.missions (client_id, service_id, city, mobility, agent_count, context_threat_known)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, true
from public.services where key = 'hourly'
returning id as risky_mission_id \gset

select is(
  (select risk_level from public.missions where id = :'risky_mission_id'::uuid),
  'high',
  'context_threat_known=true forces risk_level=high, regardless of any risk_level the client sent'
);

select lives_ok(
  format('update public.missions set status = %L where id = %L', 'quoted', :'risky_mission_id'::text),
  'draft -> quoted still works for a high-risk mission'
);

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'risky_mission_id'::text),
  'P0001',
  null,
  'quoted -> confirmed is refused directly for a high-risk mission — must go through review'
);

select lives_ok(
  format('update public.missions set status = %L where id = %L', 'review', :'risky_mission_id'::text),
  'quoted -> review succeeds for a high-risk mission'
);

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'risky_mission_id'::text),
  'P0001',
  null,
  'the client themselves cannot confirm their own high-risk mission out of review'
);

select tests.authenticate_as(:'dana_id'::uuid);

-- M4 (dispatcher.level2Gate): confirming a high-risk mission also
-- requires a logged dispatcher call — see 22_high_risk_gate_and_handover_rls.sql
-- for the dedicated gate tests; this fixture just needs the call logged
-- so this M2-era test's original assertion still holds.
insert into public.call_intents (mission_id, initiated_by, target_user_id, purpose)
values (:'risky_mission_id'::uuid, :'dana_id'::uuid, :'alice_id'::uuid, 'high_risk_review_call');

select lives_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'risky_mission_id'::text),
  'a dispatcher CAN confirm a high-risk mission out of review — the only allowed path'
);

-- 14-18: the client-vehicle rule
select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'client_vehicle', 1, 2
from public.services where key = 'hourly'
returning id as vehicle_mission_id \gset

update public.missions set status = 'quoted' where id = :'vehicle_mission_id'::uuid;

select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'vehicle_mission_id'::uuid, 'auth', 'pi_fixture_vehicle', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'vehicle_mission_id'::text),
  'P0001',
  null,
  'client-vehicle mission cannot confirm with no checklist row at all'
);

insert into public.mission_vehicle_checklists (mission_id) values (:'vehicle_mission_id'::uuid);

select throws_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'vehicle_mission_id'::text),
  'P0001',
  null,
  'client-vehicle mission cannot confirm with an incomplete checklist (consent/insurance/signature all missing)'
);

update public.mission_vehicle_checklists
set consent_signed_at = now(), insurance_confirmed = true, client_signature_at = now()
where mission_id = :'vehicle_mission_id'::uuid;

-- M3 gives `authenticated` a broad column grant on `photos` (needed for
-- the agent's own use) and a client passes their own row policy on this
-- table, so this is no longer a bare grant-level 42501 — it is now
-- explicitly rejected by enforce_vehicle_checklist_column_ownership()
-- (20260731110005), a real exception raised after RLS already let the
-- row through.
select throws_ok(
  format(
    'update public.mission_vehicle_checklists set photos = %L where mission_id = %L',
    '{"front":"x"}', :'vehicle_mission_id'::text
  ),
  'P0001',
  null,
  'a client cannot update the photos column — that is agent-side, explicitly rejected (M3)'
);

select lives_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'vehicle_mission_id'::text),
  'client-vehicle mission confirms once consent+insurance+signature are all recorded (photos not required yet)'
);

-- Founder QA (2026-08-03): the mobile app's .upsert() call sends
-- Prefer: resolution=merge-duplicates, which PostgREST turns into
-- INSERT ... ON CONFLICT (mission_id) DO UPDATE -- and that DO UPDATE
-- clause needs UPDATE privilege on mission_id itself (the conflict
-- target), not just the 3 client-owned columns. A plain insert-then-
-- update (like the tests above) never exercises this path, so it
-- shipped without a grant on mission_id until this was caught live.
select lives_ok(
  format(
    $$insert into public.mission_vehicle_checklists (mission_id, consent_signed_at, insurance_confirmed, client_signature_at)
      values (%L, now(), true, now())
      on conflict (mission_id) do update set
        consent_signed_at = excluded.consent_signed_at,
        insurance_confirmed = excluded.insurance_confirmed,
        client_signature_at = excluded.client_signature_at$$,
    :'vehicle_mission_id'::text
  ),
  'the client upsert path (INSERT ... ON CONFLICT DO UPDATE, what PostgREST actually generates) does not hit a permission error (20260804100001)'
);

-- 19-20: isolation
select tests.authenticate_as(:'bob_id'::uuid);

select is(
  (select count(*) from public.missions where id in (:'normal_mission_id'::uuid, :'risky_mission_id'::uuid, :'vehicle_mission_id'::uuid))::int,
  0,
  'another client cannot see alice''s missions'
);

select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select count(*) from public.missions where id in (:'normal_mission_id'::uuid, :'risky_mission_id'::uuid, :'vehicle_mission_id'::uuid, :'shield_mission_id'::uuid))::int,
  4,
  'dispatcher can read all of alice''s missions'
);

select * from finish();

rollback;
