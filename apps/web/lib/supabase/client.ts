import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@protego/supabase";

/** Browser-side Supabase client, for Client Components (e.g. the login form). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
