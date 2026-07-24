"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

/**
 * Dispatcher/admin login (email + password via Supabase Auth). Note: no
 * design copy exists for this screen — design/strings.ro.json's `auth.*`
 * section is the client app's phone-OTP flow, and design/HANDOFF.md §5's
 * dispatcher screen inventory doesn't list a login screen at all. Minimal
 * Romanian copy here as a placeholder; needs real design/i18n keys later.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.refresh();
    router.push("/dispatcher");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          PROTEGO — Dispecerat / Admin
        </h1>

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@protego.ro"
          autoComplete="email"
          required
          className="rounded-md border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3 text-[var(--text-primary)]"
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Parolă"
          autoComplete="current-password"
          required
          className="rounded-md border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3 text-[var(--text-primary)]"
        />

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[var(--gold)] px-4 py-3 font-semibold text-[var(--text-on-gold)] disabled:opacity-50"
        >
          {loading ? "Se autentifică…" : "Autentificare"}
        </button>
      </form>
    </main>
  );
}
