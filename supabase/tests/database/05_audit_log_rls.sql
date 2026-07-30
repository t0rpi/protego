begin;

select plan(4);

select tests.create_test_user('alice-audit') as alice_id \gset
select tests.create_test_user('dana-audit') as dana_id \gset

update public.profiles set role = 'admin' where id = :'dana_id'::uuid;

-- handle_new_user already logged a 'registration' entry for each fixture above.

select tests.authenticate_as(:'alice_id'::uuid);

select is(
  (select count(*) from public.audit_log)::int,
  0,
  'non-admin client has zero visibility into audit_log'
);

select throws_ok(
  format('insert into public.audit_log (action, entity) values (%L, %L)', 'fake', 'profiles'),
  '42501',
  null,
  'no role can insert into audit_log directly — only log_audit_event() (SECURITY DEFINER) can'
);

select tests.authenticate_as(:'dana_id'::uuid);

select ok(
  (select count(*) from public.audit_log where action = 'registration' and entity_id = :'alice_id'::uuid) = 1,
  'admin can read audit_log and sees the registration entry for alice'
);

select throws_ok(
  format('delete from public.audit_log where entity_id = %L', :'alice_id'::text),
  '42501',
  null,
  'even admin cannot delete audit_log rows directly — no grant exists for it'
);

select * from finish();

rollback;
