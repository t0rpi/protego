import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { PayoutsAdminClient } from "./payouts-admin-client";

/**
 * Weekly payout batches ("/admin/payouts") — audit §4: payout stays OUT
 * of Stripe for the pilot (Romanian collaborators paid by bank
 * transfer). This aggregates agent_earnings, lets admin review and mark
 * a batch paid, and exports a CSV (agent, IBAN, amount) — no real money
 * movement happens anywhere in this milestone.
 */
export default async function AdminPayoutsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  return <PayoutsAdminClient />;
}
