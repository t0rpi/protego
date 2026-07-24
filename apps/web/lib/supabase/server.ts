import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@protego/supabase";

/**
 * Server-side Supabase client for Server Components / Route Handlers.
 * Cookie writes are wrapped in try/catch because Server Components can't
 * set cookies — that's fine here since middleware refreshes the session
 * cookie on every request (see middleware.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — safe to ignore.
          }
        },
      },
    }
  );
}
