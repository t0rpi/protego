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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-[var(--text-secondary)]">
        PROTEGO — admin (autentificat ca {profile.role})
      </p>
      <div className="flex gap-4 text-sm font-semibold text-[var(--gold)] underline">
        <a href="/admin/pricing">Prețuri</a>
        <a href="/admin/fleet">Flotă</a>
        <a href="/admin/payments">Plăți</a>
        <a href="/admin/payouts">Loturi de plată</a>
      </div>
    </main>
  );
}
