-- P2c QA fix (founder, 2026-08-08): "agent gets no clear notification of
-- a new mission offer ... vague." Root cause, confirmed by reading
-- notify_event() (20260731120005_notifications.sql): every push sent a
-- static title of 'PROTEGO' and a body of `p_event::text` -- i.e. the
-- literal raw enum value ("offer_received", "mission_confirmed", ...)
-- as the entire message body. That is genuinely what "vague" meant --
-- not a client-side rendering bug, the server was never given readable
-- copy to send in the first place. Reproduces notify_event() exactly,
-- changing only the title/body construction to a per-event Romanian
-- message (this app's primary/only shipped locale so far — see
-- packages/config/src/i18n, ro is the only content actually written for
-- push, matching how the rest of the notification/SMS stub copy in this
-- migration was never localized either).
create or replace function public.notify_event(
  p_user_id uuid,
  p_event public.notification_event,
  p_mission_id uuid default null,
  p_payload jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs public.notification_preferences%rowtype;
  v_token record;
  v_status text;
  v_title text := 'PROTEGO';
  v_body text;
begin
  select * into v_prefs from public.notification_preferences where user_id = p_user_id;

  v_body := case p_event
    when 'offer_received' then 'Ai o ofertă nouă de misiune — 45 de secunde să accepți sau să refuzi.'
    when 'mission_confirmed' then 'Misiunea ta a fost confirmată.'
    when 'agent_arrived' then 'Agentul tău a ajuns la locul de preluare.'
    when 'mission_completed' then 'Misiunea s-a încheiat. Mulțumim!'
    when 'sos_acknowledged' then 'Alerta ta SOS a fost preluată de dispecerat.'
    else p_event::text
  end;

  if coalesce(v_prefs.push_enabled, true) then
    for v_token in select expo_push_token from public.push_tokens where user_id = p_user_id loop
      v_status := 'stub_logged';
      begin
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          body := jsonb_build_object(
            'to', v_token.expo_push_token,
            'title', v_title,
            'body', v_body,
            'data', coalesce(p_payload, '{}'::jsonb)
          )
        );
        v_status := 'attempted';
      exception when others then
        -- Best-effort only — a missing/unreachable pg_net egress in
        -- this environment must never block the notification_log
        -- record from being written (that record is the real,
        -- pgTAP-tested contract; the HTTP call is not).
        v_status := 'stub_logged';
      end;

      insert into public.notification_log (user_id, event, channel, mission_id, payload, provider_status)
      values (p_user_id, p_event, 'push', p_mission_id, p_payload, v_status);
    end loop;
  end if;

  if coalesce(v_prefs.sms_enabled, true) then
    insert into public.notification_log (user_id, event, channel, mission_id, payload, provider_status)
    values (p_user_id, p_event, 'sms', p_mission_id, p_payload, 'stub_logged');
  end if;
end;
$$;
