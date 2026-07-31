import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

/**
 * Dispatcher entry point ("/dispatcher") — role guard, then straight to
 * the full console (M4: map & queue, SOS, high-risk, handover). The
 * M3-era minimal queue page still exists at /dispatcher/queue but is no
 * longer the primary link.
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

  redirect("/dispatcher/console");
}
