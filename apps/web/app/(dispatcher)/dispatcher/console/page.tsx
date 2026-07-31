import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { ConsoleClient } from "./console-client";

/**
 * The full dispatcher console (design HANDOFF.md §5 dispatcher row;
 * MASTERPROMPT §5C) — map & queue, SOS console, high-risk queue, shift
 * handover, all in one tabbed view. Supersedes /dispatcher/queue's
 * minimal M3 scope (that route still works, just isn't the primary
 * link anymore) — agent verification/payments/reports stay wireframe-
 * only per the design inventory, out of this milestone's scope.
 */
export default async function DispatcherConsolePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || (profile.role !== "dispatcher" && profile.role !== "admin")) {
    redirect("/login");
  }

  return <ConsoleClient />;
}
