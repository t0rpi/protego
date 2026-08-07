begin;

select plan(15);

-- Chained rides (founder-approved, 2026-08-04): a Protect Ride client
-- booked with the wait-at-destination add-on can continue mid-mission
-- to a new address instead of ending it. Billed increment only --
-- consumed wait minutes beyond the free allowance, plus the new leg's
-- distance -- explicitly no second base fare, no second platform fee.

select tests.create_test_user('alice-segment') as alice_id \gset
select tests.create_test_user('bob-segment') as bob_id \gset
select tests.create_test_user('carol-segment-agent') as carol_id \gset
select tests.create_test_user('dana-segment-dispatcher') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
insert into public.agents (id, status, is_available) values (:'carol_id'::uuid, 'active', true);

-- Direct compute_segment_quote() check -- authoritative math, mirrors
-- packages/domain's computeSegmentQuote test exactly (wait_free_minutes=5,
-- wait_per_minute_rate=2, per_km=5 for protect_ride/Oradea): consumed
-- 20min -> billable 15*2=30 wait, 10km*5*1=50 distance, subtotal 80,
-- +21% VAT = 96.80.
select is(
  (select (public.compute_segment_quote('Oradea', 20, 10, false, false, false) ->> 'total')::numeric),
  96.80,
  'compute_segment_quote: 15 billable min * 2 + 10km * 5 = 80 labor, +21% VAT = 96.80'
);

select is(
  (select (public.compute_segment_quote('Oradea', 20, 10, false, false, false) ->> 'labor_component')::numeric),
  80.00,
  'labor_component excludes VAT (no base fare, no platform fee, by design)'
);

select tests.authenticate_as(:'alice_id'::uuid);

-- An active Protect Ride mission booked with the wait add-on -- the
-- INSERT path is exempt from enforce_mission_transition()'s guard (it
-- only fires on UPDATE), so a fresh row can start directly at 'active'
-- for this fixture, same pattern already used in 08_quotes_rls.sql.
insert into public.missions (
  client_id, service_id, city, status, mobility, destination_address, distance_km, wait_at_destination_minutes
)
select :'alice_id'::uuid, id, 'Oradea', 'active', 'protego_vehicle', 'Strada Originala 1', 8, 30
from public.services where key = 'protect_ride'
returning id as mission_id \gset

-- F3 fix (2026-08-07, audit-findings.md): a raw client-authenticated
-- INSERT into mission_offers has no policy allowing it (correctly --
-- only create_mission_offer(), dispatcher/admin-gated, is meant to
-- write this table; granting INSERT to `authenticated` to make this
-- fixture "work" would be a real security regression, not a fix).
-- Same service_role-bypass pattern already used elsewhere in this
-- suite for fixtures that need to skip normal write paths (e.g.
-- record_payment_event() fixtures in 15_agent_earnings_rls.sql).
select tests.clear_authentication();
set local role service_role;
insert into public.mission_offers (mission_id, agent_id, status) values (:'mission_id'::uuid, :'carol_id'::uuid, 'accepted');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);

select lives_ok(
  format(
    'select public.request_mission_segment(%L, %L, %L, %L)',
    :'mission_id'::text, 'Strada Noua 2', '10', '20'
  ),
  'the mission''s own client can request a chained-ride continuation'
);

select ok(
  (select count(*) from public.mission_segments where mission_id = :'mission_id'::uuid) = 1,
  'exactly one segment row now exists for the mission'
);

select ok(
  (select segment_number from public.mission_segments where mission_id = :'mission_id'::uuid) = 2,
  'the first continuation is segment_number 2 (segment 1 is the implicit original destination)'
);

select ok(
  (select incremental_cost from public.mission_segments where mission_id = :'mission_id'::uuid) = 96.80,
  'the stored incremental_cost matches compute_segment_quote''s own math'
);

select ok(
  (select destination_address from public.missions where id = :'mission_id'::uuid) = 'Strada Noua 2',
  'the mission''s active destination moves to the new leg'
);

select ok(
  (select distance_km from public.missions where id = :'mission_id'::uuid) = 10,
  'the mission''s distance_km moves to the new leg''s km'
);

select ok(
  (select kind from public.quotes where id = (select quote_id from public.mission_segments where mission_id = :'mission_id'::uuid)) = 'segment',
  'the quote row created for the continuation is kind=''segment'''
);

select ok(
  exists (
    select 1 from public.notification_log
    where mission_id = :'mission_id'::uuid and user_id = :'carol_id'::uuid and event = 'destination_changed'
  ),
  'the assigned agent is notified of the new destination'
);

select ok(
  exists (
    select 1 from public.notification_log
    where mission_id = :'mission_id'::uuid and user_id = :'dana_id'::uuid and event = 'destination_changed'
  ),
  'the dispatcher is notified of the new destination'
);

-- Validation: no second base fare / no repeat charge for the original
-- leg -- the quote's breakdown only ever has wait/distance/vat labels.
select is(
  (
    select array_agg(line ->> 'label' order by line ->> 'label')
    from jsonb_array_elements(
      (select breakdown from public.quotes where id = (select quote_id from public.mission_segments where mission_id = :'mission_id'::uuid))
    ) as line
  ),
  array['distance', 'vat', 'wait_at_destination'],
  'a chained-ride quote never has a ''base'' or ''platform_fee'' line -- no second base fare, no repeat platform fee'
);

select tests.authenticate_as(:'bob_id'::uuid);

select is(
  (select count(*) from public.mission_segments where mission_id = :'mission_id'::uuid)::int,
  0,
  'another client cannot read alice''s mission segments'
);

select throws_ok(
  format(
    'select public.request_mission_segment(%L, %L, %L, %L)',
    :'mission_id'::text, 'Strada Furata 3', '5', '5'
  ),
  'P0001',
  null,
  'another client cannot request a continuation on someone else''s mission'
);

select tests.authenticate_as(:'alice_id'::uuid);

-- Validation: the waiting add-on is a precondition. A second mission
-- with no wait_at_destination_minutes booked must be rejected.
insert into public.missions (client_id, service_id, city, status, mobility, destination_address, distance_km)
select :'alice_id'::uuid, id, 'Oradea', 'active', 'protego_vehicle', 'Alta Adresa', 6
from public.services where key = 'protect_ride'
returning id as no_wait_mission_id \gset

select throws_ok(
  format(
    'select public.request_mission_segment(%L, %L, %L, %L)',
    :'no_wait_mission_id'::text, 'Oriunde', '3', '10'
  ),
  'P0001',
  null,
  'chained rides require the wait-at-destination add-on to have been booked'
);

select * from finish();

rollback;
