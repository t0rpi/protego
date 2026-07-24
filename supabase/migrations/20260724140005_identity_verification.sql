-- M1 — identity_verifications: the client's level-2 identity check
-- (CI + selfie). Reviewed manually by a dispatcher/admin in MVP — no
-- automated ID checks. Approval flips profiles.verification_level via
-- the SECURITY DEFINER function below, never a raw UPDATE from the
-- client's own session (a client can never self-approve).
-- Source: docs/product/prd.md §7; docs/testing/acceptance-tests.md M1.

create type public.identity_verification_status as enum ('pending', 'approved', 'rejected');

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  id_card_path text not null,
  selfie_path text not null,
  status public.identity_verification_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now()
);

alter table public.identity_verifications enable row level security;

create policy "client can submit own verification"
  on public.identity_verifications for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "client can read own verification"
  on public.identity_verifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "dispatcher and admin can read all verifications"
  on public.identity_verifications for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

-- Deliberately no UPDATE policy for any role: status changes only through
-- review_identity_verification() below, so neither a client (self-approve)
-- nor a dispatcher (bulk update, bypassing the audit trail) can touch the
-- row directly.

create function public.review_identity_verification(
  p_verification_id uuid,
  p_decision public.identity_verification_status,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_reviewer_role public.user_role;
begin
  v_reviewer_role := public.current_user_role();

  if v_reviewer_role not in ('dispatcher', 'admin') then
    raise exception 'only dispatcher or admin can review identity verifications';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  select user_id into v_user_id
  from public.identity_verifications
  where id = p_verification_id;

  if v_user_id is null then
    raise exception 'verification % not found', p_verification_id;
  end if;

  update public.identity_verifications
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reviewer_note = p_note
  where id = p_verification_id;

  if p_decision = 'approved' then
    update public.profiles set verification_level = 2 where id = v_user_id;
  end if;

  perform public.log_audit_event(
    auth.uid(), v_reviewer_role::text, 'verification_' || p_decision::text,
    'identity_verifications', p_verification_id,
    jsonb_build_object('user_id', v_user_id, 'note', p_note)
  );
end;
$$;

grant execute on function public.review_identity_verification(uuid, public.identity_verification_status, text)
  to authenticated;

-- Private bucket for the uploaded ID card + selfie images — never public.
insert into storage.buckets (id, name, public)
values ('identity-documents', 'identity-documents', false)
on conflict (id) do nothing;

-- Path convention: identity-documents/<user_id>/<id-card|selfie>-<uuid>.<ext>
-- so ownership is derivable from the path's first segment alone.
create policy "client can upload own identity documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "client can read own identity documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "dispatcher and admin can read identity documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'identity-documents'
    and public.current_user_role() in ('dispatcher', 'admin')
  );
