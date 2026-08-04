-- Chained rides (founder-approved, 2026-08-04): a Protect Ride client
-- with the wait-at-destination add-on can continue to a new address
-- mid-mission instead of ending it. New enum values only -- ALTER TYPE
-- ... ADD VALUE cannot be used in the same transaction it runs in, so
-- these are isolated in their own migration ahead of the one that
-- actually references them (same lesson already applied elsewhere this
-- project for enum-typed columns).
alter type public.notification_event add value 'destination_changed';
alter type public.payment_type add value 'segment_auth';
