"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

interface Batch {
  id: string;
  week_start: string;
  status: string;
  paid_at: string | null;
}

interface BatchItem {
  agent_id: string;
  amount: number;
  missions_count: number;
  agent_name: string | null;
  iban: string | null;
}

function mostRecentMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sunday
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

export function PayoutsAdminClient() {
  const supabase = createClient();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [weekStart, setWeekStart] = useState(mostRecentMonday());
  const [message, setMessage] = useState<string | null>(null);

  async function loadBatches() {
    const { data } = await supabase
      .from("payout_batches")
      .select("id, week_start, status, paid_at")
      .order("week_start", { ascending: false });
    setBatches(data ?? []);
  }

  async function loadItems(batchId: string) {
    const { data } = await supabase
      .from("payout_batch_items")
      .select("agent_id, amount, missions_count, agents(iban, profiles(full_name))")
      .eq("batch_id", batchId);
    setItems(
      (data ?? []).map((row) => {
        const agent = row as unknown as { agents: { iban: string | null; profiles: { full_name: string | null } } };
        return {
          agent_id: row.agent_id,
          amount: row.amount,
          missions_count: row.missions_count,
          agent_name: agent.agents?.profiles?.full_name ?? null,
          iban: agent.agents?.iban ?? null,
        };
      })
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadItems(selectedBatch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch]);

  async function createBatch() {
    const { data, error } = await supabase.rpc("create_payout_batch", { p_week_start: weekStart });
    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }
    setMessage("Lot de plată creat.");
    await loadBatches();
    setSelectedBatch(data as unknown as string);
  }

  async function markPaid(batchId: string) {
    const { error } = await supabase.rpc("mark_payout_batch_paid", { p_batch_id: batchId });
    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }
    setMessage("Lot marcat ca plătit.");
    await loadBatches();
  }

  function exportCsv() {
    const header = "agent_id,agent_name,iban,amount,missions_count\n";
    const rows = items
      .map((i) => `${i.agent_id},"${i.agent_name ?? ""}","${i.iban ?? ""}",${i.amount},${i.missions_count}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-${selectedBatch}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen p-8 text-[var(--text-primary)]">
      <h1 className="mb-6 text-2xl font-bold">Loturi de plată săptămânale</h1>

      {message ? <p className="mb-4 text-sm text-[var(--gold)]">{message}</p> : null}

      <div className="mb-8 flex items-center gap-3">
        <input
          type="date"
          className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
        <button
          onClick={createBatch}
          className="rounded-md bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--text-on-gold)]"
        >
          Creează lot pentru săptămâna (Luni)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Loturi</h2>
          <ul className="flex flex-col gap-2">
            {batches.map((batch) => (
              <li key={batch.id}>
                <button
                  onClick={() => setSelectedBatch(batch.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    selectedBatch === batch.id ? "border-[var(--gold)]" : "border-[var(--border)]"
                  }`}
                >
                  {batch.week_start} · {batch.status}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="md:col-span-2">
          {!selectedBatch ? (
            <p className="text-sm text-[var(--text-secondary)]">Selectează un lot.</p>
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                <button onClick={exportCsv} className="rounded-md border border-[var(--gold)] px-3 py-1 text-xs text-[var(--gold)]">
                  Exportă CSV
                </button>
                {batches.find((b) => b.id === selectedBatch)?.status === "draft" ? (
                  <button
                    onClick={() => markPaid(selectedBatch)}
                    className="rounded-md bg-[var(--ok)] px-3 py-1 text-xs font-semibold text-black"
                  >
                    Marchează plătit
                  </button>
                ) : null}
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="py-2">Agent</th>
                    <th className="py-2">IBAN</th>
                    <th className="py-2">Sumă</th>
                    <th className="py-2">Misiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.agent_id} className="border-b border-[var(--border)]">
                      <td className="py-2">{item.agent_name ?? item.agent_id}</td>
                      <td className="py-2 text-xs text-[var(--text-secondary)]">{item.iban ?? "— neconfigurat —"}</td>
                      <td className="py-2">{item.amount} lei</td>
                      <td className="py-2">{item.missions_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
