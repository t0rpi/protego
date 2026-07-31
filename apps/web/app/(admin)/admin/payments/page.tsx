import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { PaymentsAdminClient } from "./payments-admin-client";

/**
 * Payments overview ("/admin/payments") — audit §4 / business-rules.md
 * §7: "Dispeceratul are vizibilitate asupra preautorizărilor, capturilor
 * și refund-urilor... Disputele de plată se escaladează către rolul
 * Admin/financiar". Read-only here — no refund/dispute action buttons,
 * since business-rules.md is explicit that those go through a separate
 * procedure, not ad-hoc from this screen.
 */
export default async function AdminPaymentsPage() {
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

  return <PaymentsAdminClient />;
}
