"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

interface QueueRow {
  id: string;
  service_key: string;
  city: string;
  mobility: string;
  elevated_priority: boolean;
  created_at: string;
  has_pending_offer: boolean;
}

interface AgentOption {
  id: string;
  full_name: string | null;
}

export function QueueClient() {
  const supabase = createClient();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data: missions } = await supabase
      .from("missions")
      .select("id, city, mobility, elevated_priority, created_at, services(key)")
      .eq("status", "confirmed")
      .order("elevated_priority", { ascending: false })
      .order("created_at", { ascending: true });

    const { data: pendingOffers } = await supabase
      .from("mission_offers")
      .select("mission_id")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());
    const pendingMissionIds = new Set((pendingOffers ?? []).map((o) => o.mission_id));

    setRows(
      (missions ?? []).map((row) => ({
        id: row.id,
        service_key: (row as unknown as { services: { key: string } }).services.key,
        city: row.city,
        mobility: row.mobility,
        elevated_priority: row.elevated_priority,
        created_at: row.created_at,
        has_pending_offer: pendingMissionIds.has(row.id),
      }))
    );

    const { data: agentRows } = await supabase
      .from("agents")
      .select("id, profiles(full_name)")
      .eq("status", "active")
      .eq("is_available", true);
    setAgents(
      (agentRows ?? []).map((row) => ({
        id: row.id,
        full_name: (row as unknown as { profiles: { full_name: string | null } }).profiles.full_name,
      }))
    );
  }

  useEffect(() => {
    // Simple fetch-on-mount; no data-fetching library (React Query/SWR)
    // wired yet — same accepted exception as the M2 admin pricing page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendOffer(missionId: string) {
    const agentId = selectedAgent[missionId];
    if (!agentId) {
      setMessage("Selectează un agent înainte de a trimite oferta.");
      return;
    }
    setSendingId(missionId);
    setMessage(null);
    const { error } = await supabase.rpc("create_mission_offer", {
      p_mission_id: missionId,
      p_agent_id: agentId,
    });
    setSendingId(null);
    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }
    setMessage("Ofertă trimisă.");
    await load();
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
        Coada de asignare · {rows.length} neasignate
      </h1>

      {message ? <p className="mb-4 text-sm text-[var(--gold)]">{message}</p> : null}

      <table className="w-full border-collapse text-sm text-[var(--text-primary)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left">
            <th className="py-2">Serviciu</th>
            <th className="py-2">Oraș</th>
            <th className="py-2">Mobilitate</th>
            <th className="py-2">Prioritate</th>
            <th className="py-2">Agent</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--border)]">
              <td className="py-2">{row.service_key}</td>
              <td className="py-2">{row.city}</td>
              <td className="py-2">{row.mobility}</td>
              <td className="py-2">
                {row.elevated_priority ? (
                  <span className="rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-semibold text-white">
                    Prioritate ridicată
                  </span>
                ) : null}
              </td>
              <td className="py-2">
                <select
                  className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1 text-[var(--text-primary)]"
                  value={selectedAgent[row.id] ?? ""}
                  onChange={(event) =>
                    setSelectedAgent((prev) => ({ ...prev, [row.id]: event.target.value }))
                  }
                >
                  <option value="">— alege agent —</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.full_name ?? agent.id}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2">
                {row.has_pending_offer ? (
                  <span className="text-xs text-[var(--text-secondary)]">ofertă în curs</span>
                ) : (
                  <button
                    onClick={() => sendOffer(row.id)}
                    disabled={sendingId === row.id}
                    className="rounded-md bg-[var(--gold)] px-3 py-1 text-xs font-semibold text-[var(--text-on-gold)] disabled:opacity-50"
                  >
                    {sendingId === row.id ? "Se trimite…" : "Trimite oferta 45s"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
