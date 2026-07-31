"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

interface PricingRow {
  id: string;
  service_id: string;
  service_key: string;
  city: string;
  per_hour_agent: number;
  per_hour_vehicle: number;
  per_km: number;
  coef_night: number;
  coef_weekend: number;
  coef_urgent: number;
  min_billing_hours: number;
  degressive_threshold_hours: number | null;
  degressive_rate: number;
  platform_fee: number;
  vat_rate: number;
}

interface ServiceCityRow {
  service_id: string;
  service_key: string;
  city: string;
  enabled: boolean;
}

const NUMERIC_FIELDS = [
  "per_hour_agent",
  "per_hour_vehicle",
  "per_km",
  "coef_night",
  "coef_weekend",
  "coef_urgent",
  "min_billing_hours",
  "degressive_threshold_hours",
  "degressive_rate",
  "platform_fee",
  "vat_rate",
] as const;

export function PricingAdminClient() {
  const supabase = createClient();
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [cityRows, setCityRows] = useState<ServiceCityRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data: pricing } = await supabase
      .from("pricing_config")
      .select("*, services(key)")
      .order("city");
    setRows(
      (pricing ?? []).map((row) => ({
        id: row.id,
        service_id: row.service_id,
        service_key: (row as unknown as { services: { key: string } }).services.key,
        city: row.city,
        per_hour_agent: row.per_hour_agent,
        per_hour_vehicle: row.per_hour_vehicle,
        per_km: row.per_km,
        coef_night: row.coef_night,
        coef_weekend: row.coef_weekend,
        coef_urgent: row.coef_urgent,
        min_billing_hours: row.min_billing_hours,
        degressive_threshold_hours: row.degressive_threshold_hours,
        degressive_rate: row.degressive_rate,
        platform_fee: row.platform_fee,
        vat_rate: row.vat_rate,
      }))
    );

    const { data: cityStatus } = await supabase
      .from("service_city_status")
      .select("service_id, city, enabled, services(key)")
      .order("city");
    setCityRows(
      (cityStatus ?? []).map((row) => ({
        service_id: row.service_id,
        service_key: (row as unknown as { services: { key: string } }).services.key,
        city: row.city,
        enabled: row.enabled,
      }))
    );
  }

  useEffect(() => {
    // Simple fetch-on-mount; no data-fetching library (React Query/SWR)
    // wired yet — out of scope for M2's admin screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(id: string, field: (typeof NUMERIC_FIELDS)[number], value: string) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value === "" ? null : Number(value) } : row))
    );
  }

  async function save(row: PricingRow) {
    setSavingId(row.id);
    setMessage(null);
    const { error } = await supabase
      .from("pricing_config")
      .update({
        per_hour_agent: row.per_hour_agent,
        per_hour_vehicle: row.per_hour_vehicle,
        per_km: row.per_km,
        coef_night: row.coef_night,
        coef_weekend: row.coef_weekend,
        coef_urgent: row.coef_urgent,
        min_billing_hours: row.min_billing_hours,
        degressive_threshold_hours: row.degressive_threshold_hours,
        degressive_rate: row.degressive_rate,
        platform_fee: row.platform_fee,
        vat_rate: row.vat_rate,
      })
      .eq("id", row.id);
    setSavingId(null);
    setMessage(error ? `Eroare: ${error.message}` : "Salvat.");
  }

  async function toggleCity(row: ServiceCityRow) {
    const { error } = await supabase
      .from("service_city_status")
      .update({ enabled: !row.enabled })
      .eq("service_id", row.service_id)
      .eq("city", row.city);
    if (!error) {
      await load();
    } else {
      setMessage(`Eroare: ${error.message}`);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">Motor de prețuri — Admin</h1>

      {message ? <p className="mb-4 text-sm text-[var(--gold)]">{message}</p> : null}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Servicii pe oraș</h2>
        <table className="w-full border-collapse text-sm text-[var(--text-primary)]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="py-2">Serviciu</th>
              <th className="py-2">Oraș</th>
              <th className="py-2">Activ</th>
            </tr>
          </thead>
          <tbody>
            {cityRows.map((row) => (
              <tr key={`${row.service_id}-${row.city}`} className="border-b border-[var(--border)]">
                <td className="py-2">{row.service_key}</td>
                <td className="py-2">{row.city}</td>
                <td className="py-2">
                  <button
                    onClick={() => toggleCity(row)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      row.enabled ? "bg-[var(--ok)] text-black" : "bg-[var(--line)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {row.enabled ? "activ" : "inactiv"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Configurare prețuri</h2>
        <div className="flex flex-col gap-6">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border border-[var(--border)] p-4">
              <h3 className="mb-3 font-semibold text-[var(--text-primary)]">
                {row.service_key} · {row.city}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {NUMERIC_FIELDS.map((field) => (
                  <label key={field} className="flex flex-col text-xs text-[var(--text-secondary)]">
                    {field}
                    <input
                      type="number"
                      step="0.01"
                      value={row[field] ?? ""}
                      onChange={(event) => updateField(row.id, field, event.target.value)}
                      className="mt-1 rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1 text-[var(--text-primary)]"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={() => save(row)}
                disabled={savingId === row.id}
                className="mt-3 rounded-md bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--text-on-gold)] disabled:opacity-50"
              >
                {savingId === row.id ? "Se salvează…" : "Salvează"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
