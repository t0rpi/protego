-- M2 — seed data: the 4 MVP (wave 1) services and their Oradea pricing.
-- Idempotent (ON CONFLICT DO NOTHING/DO UPDATE) so this is safe to apply
-- to both local dev and the real pilot project without special-casing —
-- unlike supabase/seed.sql (local-dev-only, never pushed), this is a
-- real data migration: Oradea is the confirmed pilot city (MASTERPROMPT
-- v2.2 §2.15) and needs these rows to exist for the app to function at
-- all, not just for local testing.
--
-- PRICE VALUES — confirmed vs. placeholder, do not confuse the two:
--   confirmed (MASTERPROMPT §2.6, business-rules.md §1):
--     180 lei/h/agent, 60 lei/h vehicle, 20 lei platform fee,
--     VAT 21%, escort min 1h, hourly min 2h, hourly degressive
--     threshold 8h, free cancellation 60 min.
--   NOT confirmed anywhere in the project docs — set to neutral
--   placeholders (0 / 1.0, i.e. "no effect yet") rather than invented:
--     per_km (Protect Ride), coef_night, coef_weekend, coef_urgent,
--     degressive_rate (the discount factor itself — only the 8h
--     THRESHOLD is confirmed, not how much cheaper hours beyond it
--     are). All are admin-editable from day one; per business-rules.md
--     "niciun preț nu este hardcodat", these placeholders are real DB
--     config that flows through the same engine as confirmed values,
--     never a special case.

insert into public.services (key, name, wave) values
  ('shield', 'Shield', 1),
  ('protect_ride', 'Protect Ride', 1),
  ('escort', 'Escortă', 1),
  ('hourly', 'Protecție cu ora', 1)
on conflict (key) do nothing;

-- Shield exists in the catalog (it is part of the MVP wave) but stays
-- switched off in every city until M6's dispatcher-readiness gate opens
-- it for public launch (MASTERPROMPT §5C, roadmap.md M6) — this reuses
-- the same on/off switch as any other service, not a special flag.
insert into public.service_city_status (service_id, city, enabled)
select id, 'Oradea', false from public.services where key = 'shield'
on conflict (service_id, city) do nothing;

insert into public.service_city_status (service_id, city, enabled)
select id, 'Oradea', true from public.services where key in ('protect_ride', 'escort', 'hourly')
on conflict (service_id, city) do nothing;

insert into public.pricing_config (
  service_id, city, base, per_hour_agent, per_hour_vehicle, per_km,
  coef_night, coef_weekend, coef_urgent,
  min_billing_hours, degressive_threshold_hours, degressive_rate,
  platform_fee, vat_rate, free_cancel_minutes
)
select id, 'Oradea', 0, 180, 60, 0, 1.0, 1.0, 1.0, 0, null, 1.0, 20, 0.21, 60
from public.services where key = 'protect_ride'
on conflict (service_id, city) do nothing;

insert into public.pricing_config (
  service_id, city, base, per_hour_agent, per_hour_vehicle, per_km,
  coef_night, coef_weekend, coef_urgent,
  min_billing_hours, degressive_threshold_hours, degressive_rate,
  platform_fee, vat_rate, free_cancel_minutes
)
select id, 'Oradea', 0, 180, 60, 0, 1.0, 1.0, 1.0, 1, null, 1.0, 20, 0.21, 60
from public.services where key = 'escort'
on conflict (service_id, city) do nothing;

insert into public.pricing_config (
  service_id, city, base, per_hour_agent, per_hour_vehicle, per_km,
  coef_night, coef_weekend, coef_urgent,
  min_billing_hours, degressive_threshold_hours, degressive_rate,
  platform_fee, vat_rate, free_cancel_minutes
)
select id, 'Oradea', 0, 180, 60, 0, 1.0, 1.0, 1.0, 2, 8, 1.0, 20, 0.21, 60
from public.services where key = 'hourly'
on conflict (service_id, city) do nothing;
