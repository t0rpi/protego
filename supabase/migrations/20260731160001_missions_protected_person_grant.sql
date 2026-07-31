-- Fixes a real bug found in founder QA (M7): booking wizard's goToQuote()
-- update (apps/mobile/app/(client)/booking/[service].tsx) always writes
-- protected_person_id (even as null), but 20260731100003_missions.sql's
-- column-restricted update grant omitted it -- an oversight, not a
-- deploy-drift issue (missing from the migration source itself, not just
-- unapplied). Reproduced live: PostgREST returned 42501 "permission denied
-- for table missions" on every goToQuote() call, for both Protect Ride and
-- Escorta, regardless of questionnaire answers -- consistent with the
-- update firing unconditionally on that step.
grant update (protected_person_id) on public.missions to authenticated;
