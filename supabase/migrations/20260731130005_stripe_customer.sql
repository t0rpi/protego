-- M5 — Stripe customer linkage, needed for the optional saved payment
-- method (SetupIntent) and for the high-risk "confirm now, charge the
-- saved card" flow. The card/payment-method itself is never stored in
-- our DB — only Stripe's customer id, so Edge Functions can look up
-- "does this client have a saved default payment method" directly from
-- Stripe at confirm time, rather than mirroring card data anywhere.

alter table public.profiles add column stripe_customer_id text;

alter table public.profiles
  add constraint profiles_stripe_customer_id_key unique (stripe_customer_id);

-- Readable already via the existing broad `grant select on
-- public.profiles` (20260724140001) — table-level column grants cover
-- columns added later too. No update grant for this column at all: it
-- is written only by Edge Functions using the service_role key, which
-- bypasses grants entirely — a client can never redirect their own
-- payments to an arbitrary Stripe customer by setting this themselves.
