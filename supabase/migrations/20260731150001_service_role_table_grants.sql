-- M7 — fixes a real gap found while verifying Stripe end-to-end against
-- the deployed project: `service_role` had NO table-level grant at all
-- on several tables (profiles, missions — confirmed via direct REST
-- calls returning 42501 "permission denied for table X"), even though
-- it correctly bypasses RLS. RLS bypass and table GRANTs are separate
-- Postgres concerns (same lesson as M1's authenticated/anon grants
-- fix, 20260724140006_grants.sql) — service_role apparently never got
-- its own blanket grant on this project for tables from the earliest
-- migrations. payments (M5) worked fine, which is what surfaced the
-- inconsistency rather than a uniform "nothing works" failure.
--
-- Every Edge Function's admin client (getSupabaseAdminClient() in
-- supabase/functions/_shared/clients.ts) queries tables DIRECTLY via
-- PostgREST for several operations (missions, quotes, profiles,
-- payout_batches, etc.) — not exclusively through SECURITY DEFINER
-- RPCs, which run as their owner and were never affected by this gap.
-- Without this fix, those direct table calls would fail in production
-- exactly as they failed here during manual verification.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
