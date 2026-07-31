-- M7 QA fix: founder dry-run testing showed a client can't know the exact
-- route distance in km, so the Protect Ride "where" step's km field should
-- be optional. compute_quote() already tolerates p_km being null (no
-- distance line, base fare only) -- but that silently produces an
-- unrealistically low quote for an actual ride rather than a usable
-- estimate. Adds an admin-editable, disclosed placeholder distance used
-- ONLY when the client leaves km blank, as a stopgap until real
-- geocoding/route calculation lands (not a confirmed average-ride figure
-- from any source -- same disclosed-placeholder treatment as
-- agent_share_pct in 20260731110006_agent_earnings.sql).
alter table public.pricing_config
  add column default_distance_km numeric(6, 2);

comment on column public.pricing_config.default_distance_km is
  'Estimated distance (km) substituted by compute_quote() when the client leaves the Protect Ride km field blank. Disclosed placeholder, not a confirmed average-ride figure from any source -- admin-editable, null = not applicable (non-protect_ride services never read this).';

update public.pricing_config pc
set default_distance_km = 8
from public.services s
where s.id = pc.service_id and s.key = 'protect_ride' and pc.city = 'Oradea';
