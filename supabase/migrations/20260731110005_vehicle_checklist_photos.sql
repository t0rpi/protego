-- M3 — vehicle checklist photos: the agent-side half of the
-- client-vehicle rule (business-rules.md §5), deferred from M2 (see the
-- header comment in 20260731100004_mission_vehicle_checklists.sql).
-- Six mandatory positions, matching packages/domain's
-- VEHICLE_CHECKLIST_PHOTO_KEYS exactly: front, back, left, right, km, fuel.

-- Private bucket, path convention <mission_id>/<photo_key>-<uuid>.<ext>
-- so ownership is derivable from the path's first segment — same
-- pattern as identity-documents (20260724140005), just keyed by mission
-- rather than user, since the relevant identity here is "which agent
-- currently holds an accepted offer for this mission", not a fixed owner.
insert into storage.buckets (id, name, public)
values ('vehicle-checklists', 'vehicle-checklists', false)
on conflict (id) do nothing;

create policy "agent can upload own mission's checklist photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-checklists'
    and exists (
      select 1 from public.mission_offers mo
      where mo.agent_id = auth.uid()
        and mo.status = 'accepted'
        and mo.mission_id::text = (storage.foldername(name))[1]
    )
  );

create policy "agent can read own mission's checklist photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-checklists'
    and exists (
      select 1 from public.mission_offers mo
      where mo.agent_id = auth.uid()
        and mo.status = 'accepted'
        and mo.mission_id::text = (storage.foldername(name))[1]
    )
  );

create policy "client can read own mission's checklist photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-checklists'
    and exists (
      select 1 from public.missions m
      where m.client_id = auth.uid()
        and m.id::text = (storage.foldername(name))[1]
    )
  );

create policy "dispatcher and admin can read all checklist photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-checklists'
    and public.current_user_role() in ('dispatcher', 'admin')
  );

-- Agents can now write the photos column — the M2 migration granted the
-- other 3 columns to authenticated for clients and deliberately withheld
-- this one. Postgres column grants are additive per-role, and both
-- client and agent share the single 'authenticated' role, so a grant
-- alone can't stop an agent session from also touching
-- consent_signed_at/insurance_confirmed/client_signature_at (or a client
-- from touching photos) as long as SOME row policy passes for their
-- session — RLS policies are OR'd together for row access, not
-- column-scoped. The trigger below closes that gap directly, the same
-- way enforce_mission_transition() already polices `missions` beyond
-- what RLS alone can express.
grant update (photos) on public.mission_vehicle_checklists to authenticated;

-- Postgres row security requires a row to be SELECT-visible before an
-- UPDATE-specific policy's USING clause is even consulted for it — an
-- UPDATE policy with no matching SELECT policy silently updates zero
-- rows rather than erroring (confirmed empirically while building this
-- milestone — see the identical fix + longer comment on `missions` in
-- 20260731110007_mission_transitions_agent.sql).
create policy "agent can read own mission's checklist"
  on public.mission_vehicle_checklists for select
  to authenticated
  using (
    exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = mission_vehicle_checklists.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  );

create policy "agent can update own mission's checklist photos"
  on public.mission_vehicle_checklists for update
  to authenticated
  using (
    exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = mission_vehicle_checklists.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  )
  with check (
    exists (
      select 1 from public.mission_offers mo
      where mo.mission_id = mission_vehicle_checklists.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
    )
  );

create function public.enforce_vehicle_checklist_column_ownership()
returns trigger
language plpgsql
as $$
declare
  v_is_client boolean;
  v_is_agent boolean;
begin
  if public.current_user_role() in ('dispatcher', 'admin') then
    return NEW;
  end if;

  select exists(select 1 from public.missions m where m.id = NEW.mission_id and m.client_id = auth.uid())
    into v_is_client;
  select exists(
    select 1 from public.mission_offers mo
    where mo.mission_id = NEW.mission_id and mo.agent_id = auth.uid() and mo.status = 'accepted'
  ) into v_is_agent;

  if v_is_agent and not v_is_client then
    if NEW.consent_signed_at is distinct from OLD.consent_signed_at
       or NEW.insurance_confirmed is distinct from OLD.insurance_confirmed
       or NEW.client_signature_at is distinct from OLD.client_signature_at then
      raise exception 'an agent may only update the photos column on a vehicle checklist';
    end if;
  end if;

  if v_is_client and not v_is_agent then
    if NEW.photos is distinct from OLD.photos then
      raise exception 'a client may not update the photos column on a vehicle checklist — that is agent-side';
    end if;
  end if;

  return NEW;
end;
$$;

create trigger mission_vehicle_checklists_enforce_column_ownership
  before update on public.mission_vehicle_checklists
  for each row execute function public.enforce_vehicle_checklist_column_ownership();

-- Mirrors packages/domain's isPhotoChecklistComplete() exactly — used by
-- start_mission_protection() (20260731110007) to gate arrived->active
-- for client-vehicle missions. `photos` values are storage paths
-- (non-empty strings), so "present and non-empty" is what "complete" means.
create function public.is_vehicle_photo_checklist_complete(p_photos jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(
    (select bool_and(coalesce(length(p_photos ->> key), 0) > 0)
     from unnest(array['front', 'back', 'left', 'right', 'km', 'fuel']) as key),
    false
  );
$$;
