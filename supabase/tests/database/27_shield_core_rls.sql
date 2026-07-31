begin;

select plan(35);

select tests.create_test_user('alice-shield') as alice_id \gset
select tests.create_test_user('bob-shield') as bob_id \gset
select tests.create_test_user('carol-shield') as carol_id \gset
select tests.create_test_user('dana-shield') as dana_id \gset
select tests.create_test_user('admin-shield') as admin_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'admin' where id = :'admin_id'::uuid;

-- 1-2: the M6 gate defaults OFF and is admin-only to flip
select is(
  (select (value #>> '{}')::boolean from public.platform_settings where key = 'shield_public_enabled'),
  false,
  'shield_public_enabled defaults to false (the roadmap gate)'
);

-- platform_settings' write grant is broad (authenticated) but its only
-- write policy is admin-only — same "table grant exists, RLS filters
-- the row" pattern as pricing_config/vehicles: a non-admin's UPDATE
-- executes without error but silently touches 0 rows.
select tests.authenticate_as(:'alice_id'::uuid);
update public.platform_settings set value = 'true'::jsonb where key = 'shield_public_enabled';

select is(
  (select (value #>> '{}')::boolean from public.platform_settings where key = 'shield_public_enabled'),
  false,
  'a non-admin''s update to the Shield gate matches zero rows — value stays false'
);

-- 3: while the gate is off, every standalone Shield entry point refuses
select throws_ok(
  'select public.trigger_shield_sos(46.07, 21.92)',
  'P0001',
  null,
  'standalone SOS is refused while Shield is not publicly activated'
);

select throws_ok(
  'select public.log_fake_call()',
  'P0001',
  null,
  'fake call logging is refused while Shield is not publicly activated'
);

select throws_ok(
  format('select public.start_walk_with_me(%L, %L)', 'Str. Test 1, Oradea', '30'),
  'P0001',
  null,
  'Walk With Me is refused while Shield is not publicly activated'
);

-- 4: admin flips the gate on
select tests.authenticate_as(:'admin_id'::uuid);
select lives_ok(
  format('update public.platform_settings set value = %L where key = %L', 'true', 'shield_public_enabled'),
  'admin can flip the Shield public-activation gate'
);

select is(
  (select public.is_shield_public_enabled()),
  true,
  'is_shield_public_enabled() reflects the flipped flag'
);

-- === standalone SOS, identical dispatcher treatment ===

select tests.authenticate_as(:'alice_id'::uuid);
select public.trigger_shield_sos(46.07, 21.92) as sos_event_id \gset

select is(
  (select source::text from public.shield_events where id = :'sos_event_id'::uuid),
  'shield',
  'a standalone SOS is recorded with source=shield, no mission'
);

select is(
  (select mission_id from public.shield_events where id = :'sos_event_id'::uuid),
  null,
  'a standalone SOS has no mission_id'
);

select is(
  (select count(*) from public.shield_share_links where owner_id = :'alice_id'::uuid and source_event_id = :'sos_event_id'::uuid)::int,
  1,
  'triggering a standalone SOS auto-creates a trusted-circle share link for it'
);

-- The exact same functions M4 wrote for mission-source SOS work
-- unmodified on a shield-source event — proves identical dispatcher
-- treatment (repository-audit.md Sec5.2/Sec3.5) without any source-specific
-- branching anywhere in acknowledge_sos/update_sos_protocol_step/resolve_sos.
select tests.authenticate_as(:'dana_id'::uuid);
select lives_ok(
  format('select public.acknowledge_sos(%L)', :'sos_event_id'::text),
  'a dispatcher acknowledges a shield-source SOS exactly like a mission-source one'
);

select public.update_sos_protocol_step(:'sos_event_id'::uuid, 'p1', true);
select public.update_sos_protocol_step(:'sos_event_id'::uuid, 'p2', true);
select public.update_sos_protocol_step(:'sos_event_id'::uuid, 'p3', true);
select public.update_sos_protocol_step(:'sos_event_id'::uuid, 'p4', true);

select lives_ok(
  format('select public.resolve_sos(%L, %L)', :'sos_event_id'::text, 'confirmed safe by phone'),
  'the resolve-gate (protocol complete + journal) works identically for a shield-source event'
);

-- Now that the linked SOS event is resolved, the auto-share link goes
-- "expired" (get_shared_shield_status treats resolved/cancelled events
-- as an ended share window).
select is(
  (select public.get_shared_shield_status(
    (select token from public.shield_share_links where source_event_id = :'sos_event_id'::uuid)
  ) ->> 'status'),
  'expired',
  'the auto-share link tied to a resolved SOS event now reports expired'
);

-- === fake call ===

select tests.authenticate_as(:'bob_id'::uuid);
select public.log_fake_call() as fake_call_id \gset

select is(
  (select status::text from public.shield_events where id = :'fake_call_id'::uuid),
  'resolved',
  'a fake call is logged already-resolved — no dispatcher action is ever needed'
);

select is(
  (select event_type::text from public.shield_events where id = :'fake_call_id'::uuid),
  'fake_call',
  'the fake call event_type is recorded correctly'
);

-- === trusted circle contacts ===

select lives_ok(
  format(
    'insert into public.shield_contacts (owner_id, name, phone) values (%L, %L, %L)',
    :'bob_id'::text, 'Mama', '+40712345678'
  ),
  'a user can add their own trusted-circle contact'
);

select is(
  (select count(*) from public.shield_contacts where owner_id = :'bob_id'::uuid)::int,
  1,
  'exactly one contact now exists for bob'
);

select tests.authenticate_as(:'carol_id'::uuid);
select is(
  (select count(*) from public.shield_contacts where owner_id = :'bob_id'::uuid)::int,
  0,
  'another user cannot read someone else''s trusted circle'
);

select throws_ok(
  format(
    'insert into public.shield_contacts (owner_id, name, phone) values (%L, %L, %L)',
    :'bob_id'::text, 'Rogue', '+40700000000'
  ),
  '42501',
  null,
  'a user cannot insert a contact into someone else''s trusted circle (RLS with check)'
);

-- === manual share link + live location ===

select tests.authenticate_as(:'carol_id'::uuid);
select public.create_shield_share_link() as manual_token \gset

select is(
  (select public.get_shared_shield_status(:'manual_token'::text) ->> 'status'),
  'active',
  'a manually-created share link (no source event) starts out active'
);

select public.record_shield_location(46.08, 21.93);

select is(
  (select (public.get_shared_shield_status(:'manual_token'::text) -> 'position' ->> 'lat')::numeric),
  46.08,
  'the latest recorded location is exposed through the share link'
);

select tests.authenticate_as(:'bob_id'::uuid);
select is(
  (select count(*) from public.shield_locations where owner_id = :'carol_id'::uuid)::int,
  0,
  'another user cannot read someone else''s location pings directly'
);

-- === Walk With Me ===

select tests.authenticate_as(:'alice_id'::uuid);
select public.start_walk_with_me('Str. Exemplu 10, Oradea', 30) as wwm_id \gset

select is(
  (select status from public.walk_with_me_sessions where id = :'wwm_id'::uuid),
  'active',
  'a new Walk With Me session starts active'
);

select is(
  (select grace_minutes from public.walk_with_me_sessions where id = :'wwm_id'::uuid)::int,
  10,
  'the session snapshots the platform_settings wwm_grace_minutes default (10)'
);

select tests.authenticate_as(:'bob_id'::uuid);
select throws_ok(
  format('select public.check_in_walk_with_me(%L)', :'wwm_id'::text),
  'P0001',
  null,
  'only the walker can check in to their own Walk With Me session'
);

select tests.authenticate_as(:'alice_id'::uuid);
select lives_ok(
  format('select public.extend_walk_with_me(%L, %L)', :'wwm_id'::text, '10'),
  'the walker can extend their own active session by +10 minutes'
);

select lives_ok(
  format('select public.check_in_walk_with_me(%L)', :'wwm_id'::text),
  'the walker can check in (arrived safely)'
);

select is(
  (select status from public.walk_with_me_sessions where id = :'wwm_id'::uuid),
  'checked_in',
  'the session is now checked_in'
);

-- === Walk With Me: the un-checked-in escalation path ===

select public.start_walk_with_me('Str. Necunoscuta 1, Oradea', 20) as wwm_overdue_id \gset

select tests.clear_authentication();
update public.walk_with_me_sessions set expires_at = now() - interval '1 second' where id = :'wwm_overdue_id'::uuid;

select lives_ok(
  'select public.expire_stale_walk_with_me_sessions()',
  'the sweep function runs without error (phase 1: notify circle)'
);

select is(
  (select status from public.walk_with_me_sessions where id = :'wwm_overdue_id'::uuid),
  'expired_notified',
  'an overdue session with no check-in moves to expired_notified'
);

-- Simulate the grace period having also elapsed, then sweep again.
update public.walk_with_me_sessions set notified_at = now() - interval '11 minutes' where id = :'wwm_overdue_id'::uuid;
select public.expire_stale_walk_with_me_sessions();

select is(
  (select status from public.walk_with_me_sessions where id = :'wwm_overdue_id'::uuid),
  'escalated',
  'once the grace period also elapses without check-in, the session escalates to dispatcher'
);

select ok(
  (select shield_event_id from public.walk_with_me_sessions where id = :'wwm_overdue_id'::uuid) is not null,
  'the escalation created a linked shield_event'
);

select is(
  (select event_type::text from public.shield_events where id = (
    select shield_event_id from public.walk_with_me_sessions where id = :'wwm_overdue_id'::uuid
  )),
  'wwm_expired',
  'the escalated shield_event has event_type=wwm_expired'
);

select tests.authenticate_as(:'dana_id'::uuid);
select is(
  (select count(*) from public.walk_with_me_sessions where id = :'wwm_overdue_id'::uuid)::int,
  1,
  'a dispatcher can read an escalated Walk With Me session'
);

select tests.authenticate_as(:'carol_id'::uuid);
select is(
  (select count(*) from public.walk_with_me_sessions where id = :'wwm_overdue_id'::uuid)::int,
  0,
  'an uninvolved user cannot read someone else''s (even escalated) Walk With Me session'
);

select * from finish();

rollback;
