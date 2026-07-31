"use client";

import { useEffect, useState } from "react";
import { rankAgentSuggestions, SOS_PROTOCOL_STEPS, type AgentSuggestionInput } from "@protego/domain";
import { createClient } from "../../../../lib/supabase/client";

type Tab = "map" | "sos" | "risk" | "handover";

const TAB_LABEL: Record<Tab, string> = {
  map: "Hartă & cozi",
  sos: "Consolă SOS",
  risk: "Risc ridicat",
  handover: "Predare tură",
};

export function ConsoleClient() {
  const [tab, setTab] = useState<Tab>("map");

  return (
    <main className="min-h-screen p-6 text-[var(--text-primary)]">
      <nav className="mb-6 flex gap-2 border-b border-[var(--border)] pb-3">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              tab === key ? "bg-[var(--gold)] text-[var(--text-on-gold)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </nav>

      {tab === "map" ? <MapQueueTab /> : null}
      {tab === "sos" ? <SosTab /> : null}
      {tab === "risk" ? <HighRiskTab /> : null}
      {tab === "handover" ? <HandoverTab /> : null}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Map & queue

interface ActiveMissionRow {
  id: string;
  status: string;
  city: string;
  agent_name: string | null;
  position: { lat: number; lng: number } | null;
}

interface QueueRow {
  id: string;
  service_key: string;
  city: string;
  elevated_priority: boolean;
  created_at: string;
  has_pending_offer: boolean;
}

interface AgentOption extends AgentSuggestionInput {
  full_name: string | null;
}

function MapQueueTab() {
  const supabase = createClient();
  const [active, setActive] = useState<ActiveMissionRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function load() {
    const { data: activeMissions } = await supabase
      .from("missions")
      .select("id, status, city")
      .in("status", ["assigned", "enroute", "arrived", "active"]);

    const rows: ActiveMissionRow[] = [];
    for (const m of activeMissions ?? []) {
      const { data: offer } = await supabase
        .from("mission_offers")
        .select("agent_id, profiles(full_name)")
        .eq("mission_id", m.id)
        .eq("status", "accepted")
        .maybeSingle();
      const { data: loc } = await supabase
        .from("mission_latest_location")
        .select("lat, lng")
        .eq("mission_id", m.id)
        .maybeSingle();
      rows.push({
        id: m.id,
        status: m.status,
        city: m.city,
        agent_name: offer ? (offer as unknown as { profiles: { full_name: string | null } }).profiles.full_name : null,
        position: loc && loc.lat !== null && loc.lng !== null ? { lat: loc.lat, lng: loc.lng } : null,
      });
    }
    setActive(rows);

    const { data: missions } = await supabase
      .from("missions")
      .select("id, city, elevated_priority, created_at, services(key)")
      .eq("status", "confirmed")
      .order("elevated_priority", { ascending: false })
      .order("created_at", { ascending: true });

    const { data: pendingOffers } = await supabase
      .from("mission_offers")
      .select("mission_id")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());
    const pendingIds = new Set((pendingOffers ?? []).map((o) => o.mission_id));

    setQueue(
      (missions ?? []).map((row) => ({
        id: row.id,
        service_key: (row as unknown as { services: { key: string } }).services.key,
        city: row.city,
        elevated_priority: row.elevated_priority,
        created_at: row.created_at,
        has_pending_offer: pendingIds.has(row.id),
      }))
    );

    const { data: agentRows } = await supabase
      .from("agents")
      .select("id, rating, badges, profiles(full_name)")
      .eq("status", "active")
      .eq("is_available", true);
    setAgents(
      (agentRows ?? []).map((row) => {
        const badges = Array.isArray(row.badges) ? (row.badges as string[]) : [];
        return {
          agentId: row.id,
          full_name: (row as unknown as { profiles: { full_name: string | null } }).profiles.full_name,
          rating: row.rating,
          badgeCount: badges.length,
          hasVehicle: badges.includes("vehicle"),
        };
      })
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ranked = rankAgentSuggestions(agents);

  async function sendOffer(missionId: string) {
    const agentId = selectedAgent[missionId];
    if (!agentId) {
      setMessage("Selectează un agent înainte de a trimite oferta.");
      return;
    }
    setSendingId(missionId);
    const { error } = await supabase.rpc("create_mission_offer", { p_mission_id: missionId, p_agent_id: agentId });
    setSendingId(null);
    setMessage(error ? `Eroare: ${error.message}` : "Ofertă trimisă.");
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Hartă (placeholder stilizat — fără furnizor de hartă plătit)</h2>
        <div className="relative h-64 rounded-lg border border-[var(--border)] bg-[#101216] p-4">
          {active.filter((m) => m.position).length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">Nicio poziție live momentan.</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {active
                .filter((m) => m.position)
                .map((m) => (
                  <div key={m.id} className="rounded border border-[var(--gold)] p-2 text-center">
                    <div className="mx-auto mb-1 h-3 w-3 rounded-full bg-[var(--gold)]" />
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {m.position!.lat.toFixed(3)}, {m.position!.lng.toFixed(3)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Misiuni active · {active.length}</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="py-2">Status</th>
              <th className="py-2">Oraș</th>
              <th className="py-2">Agent</th>
            </tr>
          </thead>
          <tbody>
            {active.map((m) => (
              <tr key={m.id} className="border-b border-[var(--border)]">
                <td className="py-2">{m.status}</td>
                <td className="py-2">{m.city}</td>
                <td className="py-2">{m.agent_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Coada de asignare · {queue.length} neasignate</h2>
        {message ? <p className="mb-2 text-sm text-[var(--gold)]">{message}</p> : null}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="py-2">Serviciu</th>
              <th className="py-2">Oraș</th>
              <th className="py-2">Prioritate</th>
              <th className="py-2">Sugestii ordonate — distanță · rating · badge · vehicul</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)]">
                <td className="py-2">{row.service_key}</td>
                <td className="py-2">{row.city}</td>
                <td className="py-2">
                  {row.elevated_priority ? (
                    <span className="rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-semibold text-white">
                      Prioritate ridicată
                    </span>
                  ) : null}
                </td>
                <td className="py-2">
                  <select
                    className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
                    value={selectedAgent[row.id] ?? ""}
                    onChange={(e) => setSelectedAgent((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  >
                    <option value="">— alege agent —</option>
                    {ranked.map((a) => (
                      <option key={a.agentId} value={a.agentId}>
                        {a.full_name ?? a.agentId} · ★{a.rating ?? "—"} · {a.badgeCount} badge-uri
                        {a.hasVehicle ? " · vehicul" : ""}
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
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Distanța nu este încă disponibilă (nicio poziție agent înainte de asignare) — sugestiile se bazează pe
          rating, badge-uri și vehicul.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOS console

interface SosEventRow {
  id: string;
  source: string;
  event_type: string;
  status: string;
  mission_id: string | null;
  lat: number | null;
  lng: number | null;
  protocol_steps: Record<string, boolean>;
  journal: string | null;
  created_at: string;
}

function SosTab() {
  const supabase = createClient();
  const [events, setEvents] = useState<SosEventRow[]>([]);
  const [resolvedToday, setResolvedToday] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [journalDraft, setJournalDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("shield_events")
      .select("id, source, event_type, status, mission_id, lat, lng, protocol_steps, journal, created_at")
      .in("status", ["open", "acknowledged"])
      .order("created_at", { ascending: false });
    setEvents((data ?? []) as unknown as SosEventRow[]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("shield_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved")
      .gte("resolved_at", startOfDay.toISOString());
    setResolvedToday(count ?? 0);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  async function acknowledge(id: string) {
    const { error } = await supabase.rpc("acknowledge_sos", { p_event_id: id });
    setMessage(error ? error.message : null);
    await load();
  }

  async function callNow(event: SosEventRow) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("call_intents").insert({
      shield_event_id: event.id,
      mission_id: event.mission_id,
      initiated_by: data.user.id,
      purpose: "sos_call",
    });
    setMessage("Apel înregistrat.");
  }

  async function toggleStep(event: SosEventRow, step: string) {
    const { error } = await supabase.rpc("update_sos_protocol_step", {
      p_event_id: event.id,
      p_step: step,
      p_value: !event.protocol_steps[step],
    });
    if (error) setMessage(error.message);
    await load();
  }

  async function resolve(event: SosEventRow) {
    const { error } = await supabase.rpc("resolve_sos", { p_event_id: event.id, p_journal: journalDraft });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(null);
    setSelectedId(null);
    setJournalDraft("");
    await load();
  }

  const allStepsChecked = selected ? SOS_PROTOCOL_STEPS.every((s) => selected.protocol_steps[s]) : false;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <section className="md:col-span-1">
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          Alerte active · {events.length} · Rezolvate azi · {resolvedToday}
        </p>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          KPI: prim contact sub 60 de secunde. Tratament identic pentru utilizatorii Shield gratuiți și clienții
          plătitori.
        </p>
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id}>
              <button
                onClick={() => setSelectedId(event.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedId === event.id ? "border-[var(--gold)]" : "border-[var(--border)]"
                }`}
              >
                <span className="font-semibold text-[var(--danger)]">{event.event_type}</span> · {event.status}
                {event.mission_id ? ` · Misiune #${event.mission_id.slice(0, 8)}` : " · Shield · utilizator gratuit"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="md:col-span-2">
        {!selected ? (
          <p className="text-sm text-[var(--text-secondary)]">Selectează o alertă din listă.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Locație: {selected.lat ?? "—"}, {selected.lng ?? "—"}
            </p>

            {message ? <p className="text-sm text-[var(--gold)]">{message}</p> : null}

            {selected.status === "open" ? (
              <button
                onClick={() => acknowledge(selected.id)}
                className="rounded-md bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--text-on-gold)]"
              >
                Preia alerta
              </button>
            ) : null}

            <button
              onClick={() => callNow(selected)}
              className="rounded-md border border-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--gold)]"
            >
              Sună acum
            </button>

            <div>
              <p className="mb-2 text-sm font-semibold">Protocol — pas cu pas</p>
              {(["p1", "p2", "p3", "p4"] as const).map((step, i) => (
                <label key={step} className="mb-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(selected.protocol_steps[step])}
                    onChange={() => toggleStep(selected, step)}
                  />
                  {i + 1}. {["Sună utilizatorul", "Evaluează situația", "Escaladează", "Rămâi pe fir până la siguranță"][i]}
                </label>
              ))}
            </div>

            <textarea
              className="min-h-24 rounded border border-[var(--border)] bg-[var(--surface-card)] p-2 text-sm"
              placeholder="Jurnalizare — obligatorie înainte de închidere"
              value={journalDraft}
              onChange={(e) => setJournalDraft(e.target.value)}
            />

            <button
              onClick={() => resolve(selected)}
              disabled={!allStepsChecked || journalDraft.trim().length === 0 || selected.status !== "acknowledged"}
              className="rounded-md bg-[var(--ok)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Închide alerta — utilizator în siguranță
            </button>
            <p className="text-xs text-[var(--text-secondary)]">
              Butonul se activează doar cu toți pașii bifați + jurnal completat. Nimic nu se închide nejurnalizat.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// High-risk queue

interface HighRiskRow {
  id: string;
  city: string;
  client_id: string;
  client_name: string | null;
  verification_level: number | null;
  call_logged: boolean;
}

function HighRiskTab() {
  const supabase = createClient();
  const [rows, setRows] = useState<HighRiskRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data: missions } = await supabase.from("missions").select("id, city, client_id").eq("status", "review");
    const result: HighRiskRow[] = [];
    for (const m of missions ?? []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, verification_level")
        .eq("id", m.client_id)
        .single();
      const { count } = await supabase
        .from("call_intents")
        .select("id", { count: "exact", head: true })
        .eq("mission_id", m.id)
        .eq("purpose", "high_risk_review_call");
      result.push({
        id: m.id,
        city: m.city,
        client_id: m.client_id,
        client_name: profile?.full_name ?? null,
        verification_level: profile?.verification_level ?? null,
        call_logged: (count ?? 0) > 0,
      });
    }
    setRows(result);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logCall(row: HighRiskRow) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("call_intents").insert({
      mission_id: row.id,
      initiated_by: data.user.id,
      target_user_id: row.client_id,
      purpose: "high_risk_review_call",
    });
    await load();
  }

  async function requestInfo(row: HighRiskRow) {
    const { error } = await supabase.rpc("request_more_info", { p_mission_id: row.id, p_note: notes[row.id] ?? "" });
    setMessage(error ? error.message : "Solicitare trimisă.");
  }

  async function confirmMission(row: HighRiskRow) {
    const { error } = await supabase.from("missions").update({ status: "confirmed" }).eq("id", row.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(null);
    await load();
  }

  async function declineMission(row: HighRiskRow) {
    const { error } = await supabase.from("missions").update({ status: "cancelled_dispatcher" }).eq("id", row.id);
    setMessage(error ? error.message : null);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-[var(--gold)] p-4">
        <p className="font-semibold">Confirmare exclusiv umană — regulă absolută</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Fiecare misiune se deschide și se decide individual, după apel cu clientul. Nu există selecție multiplă și
          nu există „aprobă tot”. Clientul vede „în verificare” — niciodată o eroare.
        </p>
      </div>

      {message ? <p className="text-sm text-[var(--gold)]">{message}</p> : null}

      {rows.map((row) => (
        <div key={row.id} className="rounded-md border border-[var(--border)] p-4">
          <p className="font-semibold">
            {row.client_name ?? row.client_id} · {row.city} · nivel {row.verification_level ?? "?"}
          </p>
          <p className="mb-2 text-xs text-[var(--text-secondary)]">
            Verificare nivel 2 obligatorie înainte de orice confirmare. Fără apel + CI verificat, misiunea rămâne „în
            verificare”.
          </p>
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => logCall(row)}
              className="rounded-md border border-[var(--gold)] px-3 py-1 text-xs font-semibold text-[var(--gold)]"
            >
              {row.call_logged ? "Apel înregistrat ✓" : "Sună clientul"}
            </button>
          </div>
          <input
            className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1 text-sm"
            placeholder="Notă pentru cererea de informații suplimentare"
            value={notes[row.id] ?? ""}
            onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
          />
          <div className="flex gap-2">
            <button onClick={() => requestInfo(row)} className="rounded-md border border-[var(--border)] px-3 py-1 text-xs">
              Cere informații suplimentare
            </button>
            <button
              onClick={() => confirmMission(row)}
              disabled={!row.call_logged || (row.verification_level ?? 0) < 2}
              className="rounded-md bg-[var(--gold)] px-3 py-1 text-xs font-semibold text-[var(--text-on-gold)] disabled:opacity-40"
            >
              Confirm misiunea — decizie proprie
            </button>
            <button onClick={() => declineMission(row)} className="rounded-md border border-[var(--danger)] px-3 py-1 text-xs text-[var(--danger)]">
              Nu putem prelua
            </button>
          </div>
        </div>
      ))}

      {rows.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Nicio misiune în verificare.</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shift handover

function HandoverTab() {
  const supabase = createClient();
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState({ active: 0, sos: 0, risk: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; created_at: string; note: string | null }[]>([]);

  async function load() {
    const [{ count: active }, { count: sos }, { count: risk }, { data: past }] = await Promise.all([
      supabase.from("missions").select("id", { count: "exact", head: true }).in("status", ["assigned", "enroute", "arrived", "active"]),
      supabase.from("shield_events").select("id", { count: "exact", head: true }).in("status", ["open", "acknowledged"]),
      supabase.from("missions").select("id", { count: "exact", head: true }).eq("status", "review"),
      supabase.from("shift_handovers").select("id, created_at, note").order("created_at", { ascending: false }).limit(10),
    ]);
    setPreview({ active: active ?? 0, sos: sos ?? 0, risk: risk ?? 0 });
    setHistory(past ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    const { error } = await supabase.rpc("create_shift_handover", { p_note: note || undefined });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Tura a fost predată — sumar jurnalizat.");
    setNote("");
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-md border border-[var(--border)] p-4">
          <p className="text-2xl font-bold">{preview.active}</p>
          <p className="text-xs text-[var(--text-secondary)]">Misiuni active la predare</p>
        </div>
        <div className="rounded-md border border-[var(--border)] p-4">
          <p className="text-2xl font-bold">{preview.sos}</p>
          <p className="text-xs text-[var(--text-secondary)]">SOS nerezolvate</p>
        </div>
        <div className="rounded-md border border-[var(--border)] p-4">
          <p className="text-2xl font-bold">{preview.risk}</p>
          <p className="text-xs text-[var(--text-secondary)]">Risc ridicat în așteptare</p>
        </div>
      </div>

      <textarea
        className="min-h-24 rounded border border-[var(--border)] bg-[var(--surface-card)] p-2 text-sm"
        placeholder="Nota ta pentru următorul dispecer"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {message ? <p className="text-sm text-[var(--gold)]">{message}</p> : null}

      <button onClick={submit} className="rounded-md bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--text-on-gold)]">
        Predau tura — sumar jurnalizat
      </button>

      <div>
        <p className="mb-2 text-sm font-semibold">Predări anterioare</p>
        {history.map((h) => (
          <div key={h.id} className="mb-2 rounded border border-[var(--border)] p-2 text-xs">
            <p className="text-[var(--text-secondary)]">{new Date(h.created_at).toLocaleString()}</p>
            {h.note ? <p>{h.note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
