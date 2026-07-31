begin;

select plan(16);

select tests.create_test_user('alice-pay') as alice_id \gset
select tests.create_test_user('bob-pay') as bob_id \gset
select tests.create_test_user('dana-pay') as dana_id \gset
select tests.create_test_user('admin-pay') as admin_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'admin' where id = :'admin_id'::uuid;
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_id \gset
update public.missions set status = 'quoted' where id = :'mission_id'::uuid;
select public.create_quote_for_mission(:'mission_id'::uuid);

-- 1: confirming without any payment authorization is refused (replaces
-- M2's payment_stub_confirmed boolean)
select throws_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'mission_id'::text),
  'P0001',
  null,
  'quoted -> confirmed is refused without a successful payment authorization'
);

-- 2-3: service_role-only functions are unreachable for a plain client
select throws_ok(
  format('select public.record_webhook_event(%L, %L)', 'evt_x', 'payment_intent.succeeded'),
  '42501',
  null,
  'a client cannot call record_webhook_event directly — service_role only'
);

select throws_ok(
  format(
    'select public.record_payment_event(%L, %L, %L, %L, %L)',
    :'mission_id'::text, 'auth', 'pi_test_1', '459.80', 'requires_capture'
  ),
  '42501',
  null,
  'a client cannot call record_payment_event directly — service_role only'
);

-- 4-5: webhook idempotency (as service_role, simulating the Edge Function)
select tests.clear_authentication();
set local role service_role;

select is(
  public.record_webhook_event('evt_test_1', 'payment_intent.amount_capturable_updated'),
  true,
  'a new webhook event id is recorded and reported as new'
);

select is(
  public.record_webhook_event('evt_test_1', 'payment_intent.amount_capturable_updated'),
  false,
  'a redelivered webhook event id is reported as already-seen (idempotent)'
);

-- 6: record_payment_event creates the auth row
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_test_1', 459.80, 'requires_capture') as payment_id \gset

select is(
  (select status::text from public.payments where id = :'payment_id'::uuid),
  'requires_capture',
  'record_payment_event created the auth payment row with the given status'
);

-- 7: re-recording the SAME (stripe_payment_intent_id, type) upserts rather
-- than duplicating (redelivered webhook, same event content)
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_test_1', 459.80, 'succeeded');

select is(
  (select count(*) from public.payments where stripe_payment_intent_id = 'pi_test_1' and type = 'auth')::int,
  1,
  'recording the same PaymentIntent+type twice upserts one row, not two'
);

reset role;

-- 8: quoted -> confirmed now succeeds, once a real payment auth exists
select tests.authenticate_as(:'alice_id'::uuid);

-- the upsert above moved status to 'succeeded' — reset it to
-- requires_capture to test the realistic pre-confirm state
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_test_1', 459.80, 'requires_capture');
reset role;

select tests.authenticate_as(:'alice_id'::uuid);
select lives_ok(
  format('update public.missions set status = %L where id = %L', 'confirmed', :'mission_id'::text),
  'quoted -> confirmed now succeeds once a requires_capture auth payment exists'
);

-- 9: confirm_mission_after_payment is also service_role-only
select throws_ok(
  'select public.confirm_mission_after_payment(gen_random_uuid())',
  '42501',
  null,
  'a client cannot call confirm_mission_after_payment directly'
);

-- 10-12: payments RLS isolation
select is(
  (select count(*) from public.payments where mission_id = :'mission_id'::uuid)::int,
  1,
  'the mission''s own client can read its payments'
);

select tests.authenticate_as(:'bob_id'::uuid);
select is(
  (select count(*) from public.payments where mission_id = :'mission_id'::uuid)::int,
  0,
  'an uninvolved user cannot read someone else''s payments'
);

select tests.authenticate_as(:'dana_id'::uuid);
select is(
  (select count(*) from public.payments where mission_id = :'mission_id'::uuid)::int,
  1,
  'dispatcher can read all payments (business-rules.md §7 operational visibility)'
);

-- 13-14: no direct write grant on payments for anyone
select throws_ok(
  format(
    'insert into public.payments (mission_id, stripe_payment_intent_id, type, amount) values (%L, %L, %L, %L)',
    :'mission_id'::text, 'pi_fake', 'auth', '1'
  ),
  '42501',
  null,
  'no role has a direct insert grant on payments'
);

select throws_ok(
  format('update public.payments set status = %L where mission_id = %L', 'succeeded', :'mission_id'::text),
  '42501',
  null,
  'no role has a direct update grant on payments'
);

-- 15: stripe_webhook_events has no table grant at all for authenticated
-- (not just an RLS filter) — a direct SELECT is a hard permission
-- error, not a silent empty result.
select throws_ok(
  'select count(*) from public.stripe_webhook_events',
  '42501',
  null,
  'authenticated cannot read stripe_webhook_events at all (no table grant)'
);

-- 16: audit trail for the payment event (audit_log is admin-only —
-- dispatcher does NOT have read access, unlike payments itself)
select tests.authenticate_as(:'admin_id'::uuid);
select ok(
  (select count(*) from public.audit_log where entity = 'payments')::int >= 1,
  'payment events are journaled to audit_log'
);

select * from finish();

rollback;
