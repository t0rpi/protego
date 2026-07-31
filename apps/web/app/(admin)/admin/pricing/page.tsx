import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { PricingAdminClient } from "./pricing-admin-client";

/**
 * Admin pricing + service-switch config ("/admin/pricing"). Admin-only
 * (same guard pattern as /admin). acceptance-tests.md M2: editing a
 * price here must reflect in a brand-new quote immediately, with no
 * redeploy — enforced by the fact that this writes straight to
 * pricing_config, the same table compute_quote() reads from.
 */
export default async function AdminPricingPage() {
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

  return <PricingAdminClient />;
}
