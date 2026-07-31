import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { FleetAdminClient } from "./fleet-admin-client";

/**
 * Fleet management ("/admin/fleet") — founder-requested vehicle CRUD
 * (make, model, year, color, plate, active toggle). data-model.md's
 * `vehicles` concept existed only on paper before this milestone; the
 * table itself is new (M5).
 */
export default async function AdminFleetPage() {
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

  return <FleetAdminClient />;
}
