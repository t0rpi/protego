-- M6 — Shield public activation (repository-audit.md Sec5.2, roadmap.md
-- "M6 - Shield": "Se lanseaza public DOAR dupa ce dispeceratul
-- functioneaza stabil pe misiunile platite din M4-M5 ... conditie de
-- poarta (gate) obligatorie, nu optionala"). The gate itself is an
-- OPERATIONAL decision (has the dispatcher console actually been
-- proven on paid traffic?), not something code can verify — so this
-- is a plain admin-togglable platform_settings flag, default OFF,
-- mirroring chat_retention_days' pattern (20260731120004_mission_chat.sql).
-- Every standalone-Shield entry point below (no active mission
-- required) checks it and refuses while it's off; a paid mission's
-- own SOS path (trigger_sos(), M4) is untouched and never gated —
-- that one already went live at M4.

insert into public.platform_settings (key, value) values
  ('shield_public_enabled', 'false'::jsonb)
on conflict (key) do nothing;

comment on table public.platform_settings is
  'chat_retention_days: disclosed placeholder pending legal confirmation (compliance-checklist.md Sec3), no deletion job reads it yet. shield_public_enabled: the M6 roadmap gate — flips true only once M4-M5 are operationally validated on paid traffic, an admin decision, never a code condition. wwm_grace_minutes: disclosed placeholder (no source confirms an exact number) for the Walk With Me no-check-in grace window before dispatcher escalation.';

insert into public.platform_settings (key, value) values
  ('wwm_grace_minutes', '10'::jsonb)
on conflict (key) do nothing;

create function public.is_shield_public_enabled()
returns boolean
language sql
stable
as $$
  select coalesce((value #>> '{}')::boolean, false)
  from public.platform_settings
  where key = 'shield_public_enabled';
$$;

grant execute on function public.is_shield_public_enabled() to authenticated;

-- Standalone SOS (source='shield', no mission) — the M4 trigger_sos()
-- function stays mission-only and untouched; this is its free-tier
-- sibling. Auto-shares live location with the trusted circle the
-- moment SOS fires (repository-audit.md Sec5.2: "SOS declanseaza si
-- partajarea link-ului live catre cercul de incredere").
create function public.trigger_shield_sos(p_lat numeric default null, p_lng numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if not public.is_shield_public_enabled() then
    raise exception 'Shield is not yet publicly activated (M6 gate)';
  end if;

  insert into public.shield_events (source, event_type, triggered_by, mission_id, lat, lng)
  values ('shield', 'sos', auth.uid(), null, p_lat, p_lng)
  returning id into v_event_id;

  perform public.ensure_shield_share_link(auth.uid(), v_event_id);

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'sos_triggered', 'shield_events', v_event_id,
    jsonb_build_object('source', 'shield')
  );

  return v_event_id;
end;
$$;

grant execute on function public.trigger_shield_sos(numeric, numeric) to authenticated;

-- Fake call (design `fake.*`): purely a local client feature (schedules
-- an incoming-call screen on-device) — the only server involvement is
-- this analytics-free usage log (no location, no scenario text, no
-- caller-identity choice recorded), logged as a shield_event so the
-- existing event_type enum's 'fake_call' value has a real writer and
-- the row shows up in the same audit trail as everything else. No
-- dispatcher action is ever needed for this, so it is written already
-- resolved — it never goes through acknowledge_sos()/resolve_sos().
create function public.log_fake_call()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if not public.is_shield_public_enabled() then
    raise exception 'Shield is not yet publicly activated (M6 gate)';
  end if;

  insert into public.shield_events (source, event_type, triggered_by, mission_id, status, resolved_at)
  values ('shield', 'fake_call', auth.uid(), null, 'resolved', now())
  returning id into v_event_id;

  perform public.log_audit_event(
    auth.uid(), public.current_user_role()::text, 'fake_call_used', 'shield_events', v_event_id, null
  );

  return v_event_id;
end;
$$;

grant execute on function public.log_fake_call() to authenticated;
