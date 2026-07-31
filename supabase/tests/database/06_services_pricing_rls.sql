begin;

select plan(9);

select tests.create_test_user('alice-svc') as alice_id \gset
select tests.create_test_user('dana-svc') as dana_id \gset

update public.profiles set role = 'admin' where id = :'dana_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

select ok(
  (select count(*) from public.services where key in ('shield', 'protect_ride', 'escort', 'hourly')) = 4,
  'authenticated can read the seeded services catalog'
);

select ok(
  (select enabled from public.service_city_status scs join public.services s on s.id = scs.service_id
   where s.key = 'shield' and scs.city = 'Oradea') = false,
  'shield is seeded as disabled in Oradea until M6'
);

select throws_ok(
  format('insert into public.services (key, name, wave) values (%L, %L, %L)', 'rogue', 'Rogue', 1),
  '42501',
  null,
  'non-admin cannot insert a new service (RLS WITH CHECK denies it)'
);

select ok(
  (select count(*) from public.pricing_config) >= 3,
  'authenticated can read pricing config'
);

-- non-admin's UPDATE has a table-level grant but RLS filters the row —
-- silent no-op, not an error (same pattern as agents.status in M1).
select lives_ok(
  format('update public.pricing_config set platform_fee = 999 where city = %L', 'Oradea'),
  'non-admin''s update attempt executes without error (RLS filters it silently)'
);

select ok(
  (select platform_fee from public.pricing_config pc join public.services s on s.id = pc.service_id
   where s.key = 'hourly' and pc.city = 'Oradea') = 20,
  'pricing is unchanged — the non-admin could not actually edit it'
);

-- The acceptance-tests.md M2 core requirement: admin edits a price,
-- a brand new quote reflects it immediately, with no redeploy.
select ok(
  (compute_quote('hourly', 'Oradea', 1, 2, null, 'on_foot', false, false, false) ->> 'total')::numeric = 459.80,
  'quote before admin price change: (180*2 + 20) * 1.21 = 459.80'
);

select tests.authenticate_as(:'dana_id'::uuid);

select lives_ok(
  format('update public.pricing_config set platform_fee = 30 where city = %L and service_id = (select id from public.services where key = %L)', 'Oradea', 'hourly'),
  'admin can edit pricing config'
);

select ok(
  (compute_quote('hourly', 'Oradea', 1, 2, null, 'on_foot', false, false, false) ->> 'total')::numeric = 471.90,
  'quote after admin price change reflects the new platform fee immediately: (180*2 + 30) * 1.21 = 471.90'
);

select * from finish();

rollback;
