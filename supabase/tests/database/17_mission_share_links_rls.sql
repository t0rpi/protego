begin;

select plan(10);

select tests.create_test_user('alice-share') as alice_id \gset
select tests.create_test_user('bob-share') as bob_id \gset
select tests.create_test_user('dana-share') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;
update public.profiles set role = 'agent' where id = :'bob_id'::uuid;
update public.profiles set verification_level = 2 where id = :'alice_id'::uuid;

insert into public.agents (id, status, is_available) values (:'bob_id'::uuid, 'active', true);

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.missions (client_id, service_id, city, mobility, agent_count, duration_hours)
select :'alice_id'::uuid, id, 'Oradea', 'on_foot', 1, 2 from public.services where key = 'hourly'
returning id as mission_id \gset
update public.missions set status = 'quoted' where id = :'mission_id'::uuid;
select tests.clear_authentication();
set local role service_role;
select public.record_payment_event(:'mission_id'::uuid, 'auth', 'pi_fixture_share', '1.00', 'requires_capture');
reset role;
select tests.authenticate_as(:'alice_id'::uuid);
update public.missions set status = 'confirmed' where id = :'mission_id'::uuid;

select tests.authenticate_as(:'dana_id'::uuid);
select public.create_mission_offer(:'mission_id'::uuid, :'bob_id'::uuid) as offer_id \gset

select tests.authenticate_as(:'bob_id'::uuid);
select public.accept_mission_offer(:'offer_id'::uuid);
update public.missions set status = 'enroute' where id = :'mission_id'::uuid;
select public.record_mission_location(:'mission_id'::uuid, 46.95, 21.92);

-- 1: the client can create a share link for their own mission
select tests.authenticate_as(:'alice_id'::uuid);
select lives_ok(
  format('insert into public.mission_share_links (mission_id, created_by) values (%L, %L)', :'mission_id'::text, :'alice_id'::text),
  'the client can create a share link for their own mission'
);

select id as link_id, token as link_token from public.mission_share_links where mission_id = :'mission_id'::uuid \gset

-- 2-3: isolation on the raw table
select tests.authenticate_as(:'bob_id'::uuid);
select is(
  (select count(*) from public.mission_share_links where id = :'link_id'::uuid)::int,
  0,
  'an uninvolved agent cannot read the client''s share link row'
);

select tests.authenticate_as(:'dana_id'::uuid);
select is(
  (select count(*) from public.mission_share_links where id = :'link_id'::uuid)::int,
  1,
  'dispatcher can read share links'
);

-- 4-5: the public function, called as anon, works off the token alone
set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select public.get_shared_mission_status(:'link_token') ->> 'status'),
  'enroute',
  'anon can read live mission status through a valid token'
);

select is(
  (select public.get_shared_mission_status(:'link_token') ->> 'position') is not null,
  true,
  'anon sees a live position while the mission is enroute/arrived/active'
);

select is(
  (select public.get_shared_mission_status('not-a-real-token') ->> 'status'),
  'invalid',
  'an unknown token returns invalid, not an error'
);

reset role;

-- 6-7: revocation
select tests.authenticate_as(:'alice_id'::uuid);
select lives_ok(
  format('update public.mission_share_links set revoked_at = now() where id = %L', :'link_id'::text),
  'the client can revoke their own share link'
);

set local role anon;
select set_config('request.jwt.claims', '', true);
select is(
  (select public.get_shared_mission_status(:'link_token') ->> 'status'),
  'invalid',
  'a revoked token is treated as invalid'
);
reset role;

-- 8-10: a second link expires once the mission is actually done
select tests.authenticate_as(:'alice_id'::uuid);
insert into public.mission_share_links (mission_id, created_by) values (:'mission_id'::uuid, :'alice_id'::uuid)
returning token as link2_token \gset

select tests.authenticate_as(:'bob_id'::uuid);
update public.missions set status = 'arrived' where id = :'mission_id'::uuid;
select public.start_mission_protection(
  :'mission_id'::uuid,
  (select verification_code from public.missions where id = :'mission_id'::uuid)
);
select public.complete_mission(:'mission_id'::uuid, 'done, no incidents');

set local role anon;
select set_config('request.jwt.claims', '', true);
select is(
  (select public.get_shared_mission_status(:'link2_token') ->> 'status'),
  'expired',
  'a link to a done mission reports expired, not the raw terminal status'
);

select is(
  (select public.get_shared_mission_status(:'link2_token') ->> 'position') is null,
  true,
  'no position is ever returned once the mission has ended'
);
reset role;

select * from finish();

rollback;
