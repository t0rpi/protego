begin;

select plan(22);

select tests.create_test_user('alice-fleet') as alice_id \gset
select tests.create_test_user('bob-fleet') as bob_id \gset
select tests.create_test_user('carol-fleet') as carol_id \gset
select tests.create_test_user('admin-fleet') as admin_id \gset

update public.profiles set role = 'agent' where id in (:'bob_id'::uuid, :'carol_id'::uuid);
update public.profiles set role = 'admin' where id = :'admin_id'::uuid;

insert into public.agents (id, status, is_available) values
  (:'bob_id'::uuid, 'active', true),
  (:'carol_id'::uuid, 'active', true);

-- === vehicles ===

select tests.authenticate_as(:'admin_id'::uuid);
select lives_ok(
  format(
    'insert into public.vehicles (make, model, year, color, plate) values (%L, %L, %L, %L, %L)',
    'Dacia', 'Duster', '2023', 'Grey', 'BH-01-PRO'
  ),
  'admin can create a vehicle'
);

select vehicles.id as vehicle_id from public.vehicles vehicles where plate = 'BH-01-PRO' \gset

select tests.authenticate_as(:'bob_id'::uuid);
select is(
  (select count(*) from public.vehicles where id = :'vehicle_id'::uuid)::int,
  1,
  'any authenticated user (e.g. an agent) can read the fleet'
);

select throws_ok(
  format(
    'insert into public.vehicles (make, model, plate) values (%L, %L, %L)',
    'Rogue', 'Car', 'XX-99-XXX'
  ),
  '42501',
  null,
  'a non-admin cannot insert a vehicle'
);

-- vehicles' only UPDATE/DELETE policy is "admin can manage vehicles" —
-- for a non-admin this is a pure RLS row mismatch (table grant exists,
-- but no row is visible to the policy), so the statement itself
-- succeeds and silently touches 0 rows, same as pricing_config/agents.
select lives_ok(
  format('update public.vehicles set active = false where id = %L', :'vehicle_id'::text),
  'a non-admin''s update attempt executes without error (RLS filters it silently)'
);

select is(
  (select active from public.vehicles where id = :'vehicle_id'::uuid),
  true,
  'the vehicle is unchanged — the non-admin could not actually edit it'
);

select lives_ok(
  format('delete from public.vehicles where id = %L', :'vehicle_id'::text),
  'a non-admin''s delete attempt executes without error (RLS filters it silently)'
);

select is(
  (select count(*) from public.vehicles where id = :'vehicle_id'::uuid)::int,
  1,
  'the vehicle still exists — the non-admin could not actually delete it'
);

select tests.authenticate_as(:'admin_id'::uuid);
select lives_ok(
  format('update public.vehicles set active = false where id = %L', :'vehicle_id'::text),
  'admin can update a vehicle'
);

select lives_ok(
  format('delete from public.vehicles where id = %L', :'vehicle_id'::text),
  'admin can delete a vehicle'
);

-- === agents.iban self-service ===

select tests.authenticate_as(:'bob_id'::uuid);
select lives_ok(
  format('update public.agents set iban = %L where id = %L', 'RO49AAAA1B31007593840000', :'bob_id'::text),
  'an agent can self-report their own IBAN'
);

-- the agents update row policy is "id = auth.uid()" — targeting
-- carol's row as bob is not a raised exception, just a silent
-- zero-row UPDATE (same pattern as pricing_config's admin-only policy).
update public.agents set iban = 'RO00HACK0000000000000000' where id = :'carol_id'::uuid;

select is(
  (select iban from public.agents where id = :'carol_id'::uuid),
  null,
  'an agent cannot set another agent''s IBAN — the row policy silently excludes it'
);

select throws_ok(
  format('update public.agents set status = %L where id = %L', 'blocked', :'bob_id'::text),
  'P0001',
  null,
  'setting iban self-service does not open the door to self-service status changes'
);

-- === payout batches ===

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, scheduled_at)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, '2026-08-03T10:00:00Z' from public.services where key = 'hourly'
returning id as mission_x \gset

select tests.clear_authentication();
set local role service_role;
insert into public.agent_earnings (mission_id, agent_id, amount, created_at)
values (:'mission_x'::uuid, :'bob_id'::uuid, 143.00, '2026-08-03T12:00:00Z');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours, scheduled_at)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2, '2026-08-04T10:00:00Z' from public.services where key = 'hourly'
returning id as mission_y \gset

select tests.clear_authentication();
set local role service_role;
insert into public.agent_earnings (mission_id, agent_id, amount, created_at)
values (:'mission_y'::uuid, :'bob_id'::uuid, 57.00, '2026-08-04T12:00:00Z');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);

select throws_ok(
  'select public.create_payout_batch(''2026-08-03'')',
  'P0001',
  null,
  'a non-admin cannot create a payout batch'
);

select tests.authenticate_as(:'admin_id'::uuid);
select throws_ok(
  'select public.create_payout_batch(''2026-08-04'')',
  'P0001',
  null,
  'week_start must be a Monday (2026-08-04 is a Tuesday)'
);

select public.create_payout_batch('2026-08-03') as batch_id \gset

select is(
  (select sum(amount) from public.payout_batch_items where batch_id = :'batch_id'::uuid and agent_id = :'bob_id'::uuid)::numeric,
  200.00,
  'the payout batch aggregates the full ISO week''s agent_earnings correctly (143 + 57 = 200)'
);

select throws_ok(
  'select public.create_payout_batch(''2026-08-03'')',
  '23505',
  null,
  're-running for the same week_start is refused (unique constraint)'
);

select tests.authenticate_as(:'bob_id'::uuid);
select is(
  (select count(*) from public.payout_batch_items where batch_id = :'batch_id'::uuid)::int,
  1,
  'the agent can read their own payout batch item'
);

select tests.authenticate_as(:'carol_id'::uuid);
select is(
  (select count(*) from public.payout_batch_items where batch_id = :'batch_id'::uuid)::int,
  0,
  'an uninvolved agent cannot read someone else''s payout batch item'
);

select throws_ok(
  format('select public.mark_payout_batch_paid(%L)', :'batch_id'::text),
  'P0001',
  null,
  'a non-admin cannot mark a payout batch as paid'
);

select tests.authenticate_as(:'admin_id'::uuid);
select lives_ok(
  format('select public.mark_payout_batch_paid(%L)', :'batch_id'::text),
  'admin can mark a payout batch as paid'
);

select throws_ok(
  format('select public.mark_payout_batch_paid(%L)', :'batch_id'::text),
  'P0001',
  null,
  'marking an already-paid batch as paid again is refused'
);

select is(
  (select status::text from public.payout_batches where id = :'batch_id'::uuid),
  'paid',
  'the batch status is now paid'
);

select * from finish();

rollback;
