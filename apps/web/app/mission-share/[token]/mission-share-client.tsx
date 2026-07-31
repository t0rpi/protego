"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

interface SharedStatus {
  status: string;
  client_name?: string | null;
  agent_name?: string | null;
  position?: { lat: number; lng: number; recorded_at: string } | null;
}

const POLL_MS = 5000;

export function MissionShareClient({ token }: { token: string }) {
  const supabase = createClient();
  const [status, setStatus] = useState<SharedStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const { data } = await supabase.rpc("get_shared_mission_status", { p_token: token });
      if (!cancelled) setStatus(data as unknown as SharedStatus);
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!status) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)]">
        <p className="text-sm text-[var(--text-secondary)]">Se încarcă…</p>
      </main>
    );
  }

  if (status.status === "invalid") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-6">
        <p className="text-center text-sm text-[var(--text-secondary)]">
          Acest link nu este valid sau a fost revocat.
        </p>
      </main>
    );
  }

  if (status.status === "expired") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-6">
        <p className="text-center text-sm text-[var(--text-secondary)]">
          Misiunea s-a încheiat — partajarea live nu mai este activă.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--surface-page)] px-6">
      <h1 className="text-xl font-bold text-[var(--text-primary)]">
        {status.client_name ?? "Client"} · PROTEGO
      </h1>
      <p className="text-sm text-[var(--text-secondary)]">
        Status: <span className="text-[var(--gold)]">{status.status}</span>
      </p>
      {status.agent_name ? (
        <p className="text-sm text-[var(--text-secondary)]">Agent: {status.agent_name}</p>
      ) : null}
      {status.position ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-card)] p-4 text-center">
          <p className="text-sm text-[var(--text-primary)]">
            {status.position.lat.toFixed(4)}, {status.position.lng.toFixed(4)}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            actualizat {new Date(status.position.recorded_at).toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-secondary)]">Locație live indisponibilă momentan.</p>
      )}
      <p className="mt-8 max-w-sm text-center text-xs text-[var(--text-secondary)]">
        PROTEGO nu înlocuiește 112. Dacă persoana e în pericol imediat, sună la 112.
      </p>
    </main>
  );
}
