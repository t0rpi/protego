import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type ProtegoSupabaseClient = SupabaseClient<Database>;

/**
 * Thin factory around supabase-js so apps/web and apps/mobile share one
 * typed client, each supplying its own platform env values (Next.js
 * `NEXT_PUBLIC_*` vs Expo `EXPO_PUBLIC_*` — see .env.example).
 *
 * Never pass a service-role key here — this client is for browser/app
 * contexts only (CLAUDE.md: "no service-role key client-side"). Server-only
 * code (route handlers, Edge Functions) should create its own admin client
 * directly with @supabase/supabase-js where the service-role key is read
 * from a server-only env var.
 */
export function createSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): ProtegoSupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "createSupabaseClient: supabaseUrl and supabaseAnonKey are required (check your app's .env.local)."
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
