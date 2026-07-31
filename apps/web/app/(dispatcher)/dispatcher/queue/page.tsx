import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { QueueClient } from "./queue-client";

/**
 * Unassigned mission queue ("/dispatcher/queue") — M3's "minimal
 * additions only" scope: the returned/expired-offer queue with elevated
 * priority, plus manual offer creation to a chosen agent. The full
 * dispatcher console (map, live queues, SOS) is M4.
 */
export default async function DispatcherQueuePage() {
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

  return <QueueClient />;
}
