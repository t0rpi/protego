-- M1 fix — RLS policies only restrict ROWS; Postgres still requires an
-- explicit table-level GRANT before a role can touch a table at all, and
-- newly created tables grant nothing to `authenticated`/`anon` by
-- default. profiles and audit_log already have explicit grants in their
-- own migrations (both intentionally column/command-restricted); this
-- migration adds the same explicit baseline for the rest of the M1
-- tables — a gap the local pgTAP suite (supabase/tests/database) caught:
-- every authenticated-role statement against these tables failed with
-- "permission denied for table X", never even reaching the RLS check.

grant select, insert, update, delete on public.protected_persons to authenticated;

-- agents: only select (own row / dispatcher+admin) and update (status,
-- dispatcher+admin only) have policies — see agents_and_documents.sql.
grant select, update on public.agents to authenticated;

-- agent_documents: select + insert (agent, own) and update (dispatcher/
-- admin) have policies; no delete policy exists, so no delete grant.
grant select, insert, update on public.agent_documents to authenticated;

-- identity_verifications: select + insert (client, own) and select
-- (dispatcher/admin) have policies; status changes go only through
-- review_identity_verification() (SECURITY DEFINER), so no update/delete
-- grant — this is deliberate, not an oversight (see that migration).
grant select, insert on public.identity_verifications to authenticated;
