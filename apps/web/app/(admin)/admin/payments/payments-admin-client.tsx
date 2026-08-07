"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

interface PaymentRow {
  id: string;
  mission_id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  stripe_payment_intent_id: string;
  created_at: string;
}

export function PaymentsAdminClient() {
  const supabase = createClient();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    supabase
      .from("payments")
      .select("id, mission_id, type, amount, currency, status, stripe_payment_intent_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setPayments(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter === "all" ? payments : payments.filter((p) => p.type === filter);

  const totals = {
    auth: payments.filter((p) => p.type === "auth" && p.status === "requires_capture").reduce((s, p) => s + Number(p.amount), 0),
    capture: payments.filter((p) => p.type === "capture" && p.status === "succeeded").reduce((s, p) => s + Number(p.amount), 0),
    refund: payments.filter((p) => p.type === "refund").length,
    overage: payments.filter((p) => p.type === "overage_auth" && p.status === "succeeded").reduce((s, p) => s + Number(p.amount), 0),
    // F1 fix: a failed capture must never be discoverable only by
    // opening this page and reading every row — this tile plus the
    // per-row highlight below make it impossible to miss.
    failedCount: payments.filter((p) => p.status === "failed").length,
  };

  return (
    <main className="min-h-screen p-8 text-[var(--text-primary)]">
      <h1 className="mb-6 text-2xl font-bold">Plăți — privire de ansamblu</h1>

      {totals.failedCount > 0 ? (
        <div className="mb-6 rounded-md border border-[var(--danger)] bg-[var(--danger)]/10 p-4">
          <p className="font-semibold text-[var(--danger)]">
            {totals.failedCount} {totals.failedCount === 1 ? "plată eșuată" : "plăți eșuate"} — necesită reîncercare
            manuală.
          </p>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-5 gap-4 text-center">
        <div className="rounded-md border border-[var(--border)] p-4">
          <p className="text-xl font-bold">{totals.auth.toFixed(2)} lei</p>
          <p className="text-xs text-[var(--text-secondary)]">Preautorizări active</p>
        </div>
        <div className="rounded-md border border-[var(--border)] p-4">
          <p className="text-xl font-bold">{totals.capture.toFixed(2)} lei</p>
          <p className="text-xs text-[var(--text-secondary)]">Capturi reușite</p>
        </div>
        <div className="rounded-md border border-[var(--border)] p-4">
          <p className="text-xl font-bold">{totals.refund}</p>
          <p className="text-xs text-[var(--text-secondary)]">Eliberări/anulări</p>
        </div>
        <div className="rounded-md border border-[var(--border)] p-4">
          <p className="text-xl font-bold">{totals.overage.toFixed(2)} lei</p>
          <p className="text-xs text-[var(--text-secondary)]">Prelungiri (overage)</p>
        </div>
        <div
          className={`rounded-md border p-4 ${
            totals.failedCount > 0 ? "border-[var(--danger)]" : "border-[var(--border)]"
          }`}
        >
          <p className={`text-xl font-bold ${totals.failedCount > 0 ? "text-[var(--danger)]" : ""}`}>
            {totals.failedCount}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Plăți eșuate</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {["all", "auth", "capture", "refund", "overage_auth"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-md px-3 py-1 text-xs font-semibold ${
              filter === t ? "bg-[var(--gold)] text-[var(--text-on-gold)]" : "border border-[var(--border)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left">
            <th className="py-2">Data</th>
            <th className="py-2">Misiune</th>
            <th className="py-2">Tip</th>
            <th className="py-2">Sumă</th>
            <th className="py-2">Status</th>
            <th className="py-2">Stripe PI</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr
              key={p.id}
              className={`border-b border-[var(--border)] ${p.status === "failed" ? "bg-[var(--danger)]/10" : ""}`}
            >
              <td className="py-2">{new Date(p.created_at).toLocaleString()}</td>
              <td className="py-2">#{p.mission_id.slice(0, 8)}</td>
              <td className="py-2">{p.type}</td>
              <td className="py-2">
                {p.amount} {p.currency}
              </td>
              <td className={`py-2 ${p.status === "failed" ? "font-semibold text-[var(--danger)]" : ""}`}>
                {p.status}
              </td>
              <td className="py-2 text-xs text-[var(--text-secondary)]">{p.stripe_payment_intent_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
