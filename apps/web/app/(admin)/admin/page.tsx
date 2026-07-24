import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

/**
 * Admin placeholder ("/admin"). M1 adds the role guard (admin only —
 * stricter than /dispatcher); pricing engine config, service switches per
 * city, audit log land starting M2+.
 */
export default async function AdminHomePage() {
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

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[var(--text-secondary)]">
        PROTEGO — admin (M1: autentificat ca {profile.role})
      </p>
    </main>
  );
}
