import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

/**
 * Dispatcher console placeholder ("/dispatcher"). M1 adds the role guard
 * (dispatcher or admin only); live map, queues, SOS console land starting
 * M4 (docs/operations/dispatcher-playbook.md).
 */
export default async function DispatcherHomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "dispatcher" && profile.role !== "admin")) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-[var(--text-secondary)]">
        PROTEGO — dispecerat (M1: autentificat ca {profile.role})
      </p>
      <a href="/dispatcher/queue" className="text-sm font-semibold text-[var(--gold)] underline">
        Coada de asignare (M3)
      </a>
    </main>
  );
}
