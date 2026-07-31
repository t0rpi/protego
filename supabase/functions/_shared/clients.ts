// Shared Deno-side helpers for all payment Edge Functions
// (repository-audit.md §4: "Toate apelurile Stripe sunt server-only").
//
// Self-contained deliberately — does NOT import packages/supabase's
// generated types (that package targets Node/bundler resolution, not
// Deno's import graph, and this isn't a place worth fighting module
// resolution for) — reasonable, disclosed simplification.

import Stripe from "npm:stripe@17";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * M7 QA fix — Google Maps Platform key, server-only (Places
 * Autocomplete + Directions), same trust boundary as
 * STRIPE_SECRET_KEY: never shipped to the mobile app, only these two
 * proxy functions (places-autocomplete, route-distance) ever see it.
 */
export function getGoogleMapsApiKey(): string {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set (supabase secrets set GOOGLE_MAPS_API_KEY=...)");
  }
  return key;
}

export function getStripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set (supabase secrets set STRIPE_SECRET_KEY=sk_test_...)");
  }
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

/**
 * service_role client — bypasses RLS entirely, same trust boundary as
 * every SECURITY DEFINER function granted `to service_role` in the
 * migrations (record_payment_event, confirm_mission_after_payment,
 * record_webhook_event). Never expose this key to any client app.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }
  return createClient(url, serviceRoleKey);
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * A client that carries the caller's own JWT, so RPC calls into
 * SECURITY DEFINER functions resolve auth.uid() to the actual caller
 * (agent/client), not the service role — needed for anything that
 * reuses an existing RLS-scoped function (complete_mission(),
 * cancel_mission_by_client(), request_mission_overage()) rather than a
 * service_role-only one.
 */
export function getUserScopedClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authHeader || !url || !anonKey) {
    throw new Error("missing Authorization header or SUPABASE_URL/SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
}

/**
 * Verifies the caller's JWT and returns their user id — Edge Functions
 * receive the caller's own access token in the Authorization header
 * (not the service-role key), so this checks identity the same way an
 * RLS-scoped Postgres call would, before the function goes on to use
 * the admin client for anything privileged.
 */
export async function getCallerUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("missing Authorization header");
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set");
  }
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("invalid or expired session");
  }
  return data.user.id;
}
