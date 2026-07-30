begin;

select plan(9);

select tests.create_test_user('alice-idv') as alice_id \gset
select tests.create_test_user('bob-idv') as bob_id \gset
select tests.create_test_user('donna-idv') as donna_id \gset

update public.profiles set role = 'dispatcher' where id = :'donna_id'::uuid;

select tests.authenticate_as(:'alice_id'::uuid);

insert into public.identity_verifications (user_id, id_card_path, selfie_path)
values (
  :'alice_id'::uuid,
  'identity-documents/' || :'alice_id' || '/ci.jpg',
  'identity-documents/' || :'alice_id' || '/selfie.jpg'
)
returning id as verification_id \gset

select is(
  (select count(*) from public.identity_verifications where id = :'verification_id'::uuid)::int,
  1,
  'client can read their own submitted verification'
);

select tests.authenticate_as(:'bob_id'::uuid);

select is(
  (select count(*) from public.identity_verifications where id = :'verification_id'::uuid)::int,
  0,
  'another client cannot read someone else''s verification'
);

select tests.authenticate_as(:'alice_id'::uuid);

-- No UPDATE grant exists at all on this table for `authenticated` (only
-- select/insert — see identity_verification.sql), so this fails at the
-- grant level with a hard permission error, before any RLS policy would
-- even be consulted.
select throws_ok(
  format('update public.identity_verifications set status = %L where id = %L', 'approved', :'verification_id'::text),
  '42501',
  null,
  'client''s own direct update attempt is denied'
);

select is(
  (select status::text from public.identity_verifications where id = :'verification_id'::uuid),
  'pending',
  'status remains pending — the client could not actually self-approve'
);

-- The function's own role check does `raise exception` with no explicit
-- SQLSTATE, so plpgsql's default P0001 (raise_exception) applies here —
-- not 42501, since this isn't a grant/RLS denial but an application-level check.
select throws_ok(
  format('select public.review_identity_verification(%L, %L, %L)', :'verification_id'::text, 'approved', 'self-approval attempt'),
  'P0001',
  null,
  'client cannot call review_identity_verification themselves'
);

select tests.authenticate_as(:'donna_id'::uuid);

select lives_ok(
  format('select public.review_identity_verification(%L, %L, %L)', :'verification_id'::text, 'approved', 'looks good'),
  'dispatcher can review and approve a verification'
);

select is(
  (select status::text from public.identity_verifications where id = :'verification_id'::uuid),
  'approved',
  'verification status is now approved'
);

select tests.authenticate_as(:'alice_id'::uuid);

select is(
  (select verification_level from public.profiles where id = :'alice_id'::uuid)::int,
  2,
  'client''s verification_level is now 2 after dispatcher approval'
);

select tests.clear_authentication();

select is(
  (
    select count(*) from public.audit_log
    where entity = 'identity_verifications'
      and action = 'verification_approved'
      and entity_id = :'verification_id'::uuid
  )::int,
  1,
  'the approval is recorded in audit_log'
);

select * from finish();

rollback;
