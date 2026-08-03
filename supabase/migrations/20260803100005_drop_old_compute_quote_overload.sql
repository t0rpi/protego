-- CREATE OR REPLACE FUNCTION only replaces a function when the argument
-- TYPE list matches exactly -- adding the two new trailing default
-- params in 20260803100003 changed the type list, so Postgres created a
-- second overload instead of replacing the original, leaving the old
-- 9-arg compute_quote() live and unused. No caller in this codebase
-- invokes it (create_quote_for_mission always passes all 11 args now),
-- but leaving a stale overload around is a real ambiguity risk for any
-- future caller that doesn't pass the last two args positionally
-- exactly right. Drop it explicitly.
drop function if exists public.compute_quote(text, text, int, numeric, numeric, text, boolean, boolean, boolean);
