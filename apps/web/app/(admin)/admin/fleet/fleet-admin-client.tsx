"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  plate: string;
  active: boolean;
}

const EMPTY_FORM = { make: "", model: "", year: "", color: "", plate: "" };

export function FleetAdminClient() {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
    setVehicles(data ?? []);
  }

  useEffect(() => {
    // Simple fetch-on-mount; no data-fetching library wired yet — same
    // accepted exception as the M2 admin pricing page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addVehicle() {
    if (!form.make.trim() || !form.model.trim() || !form.plate.trim()) {
      setMessage("Marca, modelul și numărul de înmatriculare sunt obligatorii.");
      return;
    }
    const { error } = await supabase.from("vehicles").insert({
      make: form.make,
      model: form.model,
      year: form.year ? Number(form.year) : null,
      color: form.color || null,
      plate: form.plate,
    });
    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }
    setForm(EMPTY_FORM);
    setMessage("Vehicul adăugat.");
    await load();
  }

  async function toggleActive(vehicle: Vehicle) {
    const { error } = await supabase.from("vehicles").update({ active: !vehicle.active }).eq("id", vehicle.id);
    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }
    await load();
  }

  async function deleteVehicle(vehicle: Vehicle) {
    const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }
    await load();
  }

  return (
    <main className="min-h-screen p-8 text-[var(--text-primary)]">
      <h1 className="mb-6 text-2xl font-bold">Flotă PROTEGO</h1>

      {message ? <p className="mb-4 text-sm text-[var(--gold)]">{message}</p> : null}

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <input
          className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
          placeholder="Marcă"
          value={form.make}
          onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
        />
        <input
          className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
          placeholder="Model"
          value={form.model}
          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
        />
        <input
          className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
          placeholder="An"
          value={form.year}
          onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
        />
        <input
          className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
          placeholder="Culoare"
          value={form.color}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
        />
        <input
          className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
          placeholder="Număr înmatriculare"
          value={form.plate}
          onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
        />
      </section>
      <button
        onClick={addVehicle}
        className="mb-8 rounded-md bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--text-on-gold)]"
      >
        + Adaugă vehicul
      </button>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left">
            <th className="py-2">Marcă / Model</th>
            <th className="py-2">An</th>
            <th className="py-2">Culoare</th>
            <th className="py-2">Nr. înmatriculare</th>
            <th className="py-2">Activ</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id} className="border-b border-[var(--border)]">
              <td className="py-2">
                {vehicle.make} {vehicle.model}
              </td>
              <td className="py-2">{vehicle.year ?? "—"}</td>
              <td className="py-2">{vehicle.color ?? "—"}</td>
              <td className="py-2">{vehicle.plate}</td>
              <td className="py-2">
                <button
                  onClick={() => toggleActive(vehicle)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    vehicle.active ? "bg-[var(--ok)] text-black" : "bg-[var(--line)] text-[var(--text-secondary)]"
                  }`}
                >
                  {vehicle.active ? "activ" : "inactiv"}
                </button>
              </td>
              <td className="py-2">
                <button
                  onClick={() => deleteVehicle(vehicle)}
                  className="rounded-md border border-[var(--danger)] px-2 py-1 text-xs text-[var(--danger)]"
                >
                  Șterge
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
