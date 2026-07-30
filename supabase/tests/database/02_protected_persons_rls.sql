begin;

select plan(5);

select tests.create_test_user('alice-pp') as alice_id \gset
select tests.create_test_user('bob-pp') as bob_id \gset
select tests.create_test_user('dana-pp') as dana_id \gset

update public.profiles set role = 'dispatcher' where id = :'dana_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

select lives_ok(
  format(
    'insert into public.protected_persons (owner_id, full_name, relation) values (%L, %L, %L)',
    :'alice_id'::text, 'Alice''s Child', 'child'
  ),
  'client can insert their own protected person'
);

select is(
  (select count(*) from public.protected_persons where owner_id = :'alice_id'::uuid)::int,
  1,
  'client sees their own protected person'
);

select tests.authenticate_as(:'bob_id'::uuid);

select is(
  (select count(*) from public.protected_persons where owner_id = :'alice_id'::uuid)::int,
  0,
  'client cannot see another client''s protected person'
);

select throws_ok(
  format(
    'insert into public.protected_persons (owner_id, full_name) values (%L, %L)',
    :'alice_id'::text, 'Malicious insert'
  ),
  '42501',
  null,
  'client cannot insert a protected person owned by someone else'
);

select tests.authenticate_as(:'dana_id'::uuid);

select is(
  (select count(*) from public.protected_persons where owner_id = :'alice_id'::uuid)::int,
  1,
  'dispatcher can read any client''s protected persons'
);

select * from finish();

rollback;
