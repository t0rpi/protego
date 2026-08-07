"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeMapBounds,
  decodePolyline,
  projectToUnit,
  rankAgentSuggestions,
  SOS_PROTOCOL_STEPS,
  type AgentSuggestionInput,
  type MapMarker,
} from "@protego/domain";
import { createClient } from "../../../../lib/supabase/client";

type Tab = "map" | "sos" | "risk" | "handover";

const TAB_LABEL: Record<Tab, string> = {
  map: "Hartă & cozi",
  sos: "Consolă SOS",
  risk: "Risc ridicat",
  handover: "Predare tură",
};

const DEFAULT_TITLE = "PROTEGO — Dispecer";

type AudioContextClass = typeof AudioContext;

/**
 * Dispatcher-5 fix (2026-08-05): "audible alert on new mission/SOS
 * arrival — dispatchers don't stare at the screen." No audio asset to
 * host/bundle — a short beep is generated procedurally via the Web
 * Audio API. `urgent` (SOS) uses a higher pitch + a second pulse so it
 * reads as more alarming than a routine new-mission chime.
 *
 * F8 fix (2026-08-07, audit-findings.md): a fresh AudioContext starts
 * "suspended" in most browsers until the page has seen a user gesture —
 * the original version created one per beep and never checked its
 * state, so an alert arriving before the dispatcher had clicked
 * anywhere could fail completely silently. Reuses a single context
 * (also addresses the audit's minor note about never closing them),
 * unlocked/resumed on the console's first click/keydown, and the visual
 * fallback below (title blink + unread badge) covers the case where
 * sound never gets unlocked at all.
 */
function beepOn(ctx: AudioContext, urgent: boolean) {
  const schedule = (delayMs: number, freq: number) => {
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }, delayMs);
  };
  schedule(0, urgent ? 1046 : 784);
  if (urgent) schedule(400, 1046);
}

const MAP_MARKER_COLOR: Record<MapMarker["kind"], string> = {
  origin: "var(--gold)",
  destination: "var(--gold)",
  agent: "var(--gold)",
  mission: "var(--gold)",
  sos: "var(--danger)",
};

/**
 * Pass B (2026-08-07) — design/HANDOFF.md §6 Map slot, web side: same
 * props shape as packages/ui's mobile Map (markers + optional encoded
 * polyline), rendered as real DOM SVG/positioned divs since the
 * dispatcher console is a plain browser page (no react-native-svg
 * question here — this was never going to need a native rebuild).
 * Pins are absolutely-positioned divs (not SVG circles) so they stay
 * perfectly round regardless of the panel's aspect ratio; the route
 * line, when present, is the one thing actually drawn as SVG since a
 * thin dashed line tolerates the non-uniform scaling a stretched
 * viewBox introduces far better than a circle would.
 */
function DispatcherMap({
  markers,
  encodedPolyline,
  height = 260,
}: {
  markers: MapMarker[];
  encodedPolyline?: string | null;
  height?: number;
}) {
  const route = encodedPolyline ? decodePolyline(encodedPolyline) : [];
  const boundsPoints = [...markers.map((m) => ({ lat: m.lat, lng: m.lng })), ...route];
  const bounds = computeMapBounds(boundsPoints);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ height, backgroundColor: "#101216" }}
    >
      <div className="absolute left-0 right-0 top-[38%] h-px" style={{ backgroundColor: "#1B1E24" }} />
      <div className="absolute bottom-0 top-0 left-[30%] w-px" style={{ backgroundColor: "#22252C" }} />

      {route.length > 1 ? (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <polyline
            points={route.map((p) => {
              const u = projectToUnit(p, bounds);
              return `${u.x * 100},${u.y * 100}`;
            }).join(" ")}
            fill="none"
            stroke="var(--gold)"
            strokeWidth={0.6}
            strokeDasharray="2.5,2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}

      {markers.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-secondary)]">
          Nicio poziție live momentan.
        </p>
      ) : (
        markers.map((marker) => {
          const unit = projectToUnit(marker, bounds);
          const color = MAP_MARKER_COLOR[marker.kind];
          const isLive = marker.kind === "agent" || marker.kind === "sos";
          return (
            <div
              key={marker.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${unit.x * 100}%`, top: `${unit.y * 100}%` }}
              title={marker.label ?? marker.kind}
            >
              {isLive ? (
                <div
                  className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    marker.kind === "sos" ? "animate-pulse" : ""
                  }`}
                  style={{ backgroundColor: color, opacity: 0.22 }}
                />
              ) : null}
              <div
                className="relative h-2.5 w-2.5 rounded-full border-2"
                style={{ backgroundColor: color, borderColor: "#101216" }}
              />
            </div>
          );
        })
      )}
    </div>
  );
}

/** Dispatcher-2 fix: "waiting since / X min ago" per queue/alert row. */
function formatElapsed(createdAt: string, now: Date): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000));
  if (mins < 1) return "chiar acum";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

export function ConsoleClient() {
  const [tab, setTab] = useState<Tab>("map");
  const [now, setNow] = useState(() => new Date());
  const [dispatcherName, setDispatcherName] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // F8 fix: unlock/resume the shared AudioContext on the console's first
  // click or keypress anywhere on the page — most browsers keep a fresh
  // context suspended until a user gesture happens.
  useEffect(() => {
    function unlock() {
      if (!audioCtxRef.current) {
        try {
          const AudioContextCtor =
            window.AudioContext || (window as unknown as { webkitAudioContext: AudioContextClass }).webkitAudioContext;
          audioCtxRef.current = new AudioContextCtor();
        } catch {
          return;
        }
      }
      if (audioCtxRef.current.state !== "running") {
        audioCtxRef.current.resume().catch(() => undefined);
      }
    }
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // F8 fix: title-blink + unread-count visual fallback — guaranteed to
  // work even when sound never gets unlocked (or the tab is muted).
  useEffect(() => {
    if (unreadAlerts === 0) {
      document.title = DEFAULT_TITLE;
      return;
    }
    let flipped = false;
    const interval = setInterval(() => {
      document.title = flipped
        ? DEFAULT_TITLE
        : `🔴 ${unreadAlerts} ${unreadAlerts === 1 ? "alertă nouă" : "alerte noi"}`;
      flipped = !flipped;
    }, 1000);
    return () => {
      clearInterval(interval);
      document.title = DEFAULT_TITLE;
    };
  }, [unreadAlerts]);

  const notify = useCallback((urgent: boolean) => {
    setUnreadAlerts((n) => n + 1);
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "running") {
      beepOn(ctx, urgent);
    }
    // If sound isn't unlocked yet, it's silently skipped here — the
    // title blink + badge above are the guaranteed-to-work fallback.
  }, []);

  function selectTab(key: Tab) {
    setTab(key);
    // Switching to the tab that actually shows the new arrival is a
    // clear enough "I've seen it" signal to clear the badge/title.
    if (key === "map" || key === "sos") setUnreadAlerts(0);
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();
      setDispatcherName(profile?.full_name ?? data.user.email ?? null);
    });
  }, []);

  // F1 fix (2026-08-07): a failed capture must be visible to whichever
  // dispatcher is on shift, not just discoverable by an admin who
  // happens to open /admin/payments. Dispatchers already have SELECT on
  // `payments` via RLS ("dispatcher and admin can read all payments",
  // 20260731130003_payments.sql) — this is a lightweight count, not a
  // full page, so it doesn't need the admin-only payments route.
  const [failedPayments, setFailedPayments] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    async function checkFailedPayments() {
      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed");
      setFailedPayments(count ?? 0);
    }
    checkFailedPayments();
    const interval = setInterval(checkFailedPayments, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen p-6 text-[var(--text-primary)]">
      <div className="mb-3 flex items-center justify-between text-sm text-[var(--text-secondary)]">
        <span>{dispatcherName ? `Dispecer: ${dispatcherName}` : null}</span>
        <div className="flex items-center gap-3">
          {unreadAlerts > 0 ? (
            <button
              onClick={() => setUnreadAlerts(0)}
              className="animate-pulse rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-semibold text-white"
              title="Alertă nouă — click pentru a marca drept văzută"
            >
              🔴 {unreadAlerts} {unreadAlerts === 1 ? "alertă nouă" : "alerte noi"}
            </button>
          ) : null}
          {failedPayments > 0 ? (
            <span className="rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-semibold text-white">
              {failedPayments} {failedPayments === 1 ? "plată eșuată" : "plăți eșuate"}
            </span>
          ) : null}
          <span className="font-mono text-base text-[var(--text-primary)]">
            {now.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>
      <nav className="mb-6 flex gap-2 border-b border-[var(--border)] pb-3">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => selectTab(key)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              tab === key ? "bg-[var(--gold)] text-[var(--text-on-gold)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </nav>

      {tab === "map" ? <MapQueueTab notify={notify} /> : null}
      {tab === "sos" ? <SosTab notify={notify} /> : null}
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
  is_available: boolean;
}

interface QueueDetail {
  pickup_address: string | null;
  destination_address: string | null;
  distance_km: number | null;
  scheduled_at: string | null;
  agent_preference: string | null;
  dress_code: string | null;
  mobility: string | null;
  context_threat_known: boolean;
  context_kind: string | null;
  context_details: string | null;
  client_name: string | null;
  verification_level: number | null;
  quote_total: number | null;
}

function MapQueueTab({ notify }: { notify: (urgent: boolean) => void }) {
  const supabase = createClient();
  const [active, setActive] = useState<ActiveMissionRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<QueueDetail | null>(null);
  const knownQueueIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function openDetail(missionId: string) {
    setDetailId(missionId);
    setDetail(null);
    const { data: m } = await supabase
      .from("missions")
      .select(
        "pickup_address, destination_address, distance_km, scheduled_at, agent_preference, dress_code, mobility, context_threat_known, context_kind, context_details, client_id"
      )
      .eq("id", missionId)
      .single();
    if (!m) return;
    const [{ data: profile }, { data: quote }] = await Promise.all([
      supabase.from("profiles").select("full_name, verification_level").eq("id", m.client_id).single(),
      supabase
        .from("quotes")
        .select("total_estimate")
        .eq("mission_id", missionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setDetail({
      pickup_address: m.pickup_address,
      destination_address: m.destination_address,
      distance_km: m.distance_km,
      scheduled_at: m.scheduled_at,
      agent_preference: m.agent_preference,
      dress_code: m.dress_code,
      mobility: m.mobility,
      context_threat_known: m.context_threat_known,
      context_kind: m.context_kind,
      context_details: m.context_details,
      client_name: profile?.full_name ?? null,
      verification_level: profile?.verification_level ?? null,
      quote_total: quote?.total_estimate ?? null,
    });
  }

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

    const newQueue: QueueRow[] = (missions ?? []).map((row) => ({
      id: row.id,
      service_key: (row as unknown as { services: { key: string } }).services.key,
      city: row.city,
      elevated_priority: row.elevated_priority,
      created_at: row.created_at,
      has_pending_offer: pendingIds.has(row.id),
    }));
    // Dispatcher-5: alert on a genuinely NEW queue arrival, never on the
    // first load of this tab (knownQueueIds starts null specifically so
    // that first load can be distinguished from "queue really is empty").
    if (knownQueueIds.current !== null) {
      const isNew = newQueue.some((row) => !knownQueueIds.current!.has(row.id));
      if (isNew) notify(false);
    }
    knownQueueIds.current = new Set(newQueue.map((row) => row.id));
    setQueue(newQueue);

    // Dispatcher-4: show the full active roster (not just currently-free
    // agents) with a visible availability status, so the dispatcher can
    // see who's on shift but busy — rather than agents silently vanishing
    // from the list the moment they're on a mission.
    const { data: agentRows } = await supabase
      .from("agents")
      .select("id, rating, badges, is_available, profiles(full_name)")
      .eq("status", "active");
    setAgents(
      (agentRows ?? []).map((row) => {
        const badges = Array.isArray(row.badges) ? (row.badges as string[]) : [];
        return {
          agentId: row.id,
          full_name: (row as unknown as { profiles: { full_name: string | null } }).profiles.full_name,
          rating: row.rating,
          badgeCount: badges.length,
          hasVehicle: badges.includes("vehicle"),
          is_available: row.is_available,
        };
      })
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Dispatcher-2/5: the console had no periodic refresh at all before —
    // "waiting since" timestamps need fresh data to stay meaningful, and
    // the audible-alert diff above only has something to compare against
    // if the queue actually gets re-fetched.
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
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
        <h2 className="mb-2 text-lg font-semibold">Hartă — agenți și misiuni active</h2>
        <DispatcherMap
          height={260}
          markers={active
            .filter((m): m is ActiveMissionRow & { position: { lat: number; lng: number } } => m.position !== null)
            .map((m) => ({
              id: m.id,
              kind: "agent",
              lat: m.position.lat,
              lng: m.position.lng,
              label: `${m.agent_name ?? "agent"} · ${m.status}`,
            }))}
        />
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
              <th className="py-2">Așteaptă de la</th>
              <th className="py-2">Prioritate</th>
              <th className="py-2">Sugestii ordonate — distanță · rating · badge · vehicul</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-card)]"
                onClick={() => openDetail(row.id)}
              >
                <td className="py-2">{row.service_key}</td>
                <td className="py-2">{row.city}</td>
                <td className="py-2 text-xs text-[var(--text-secondary)]">
                  {formatElapsed(row.created_at, now)}
                </td>
                <td className="py-2">
                  {row.elevated_priority ? (
                    <span className="rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-semibold text-white">
                      Prioritate ridicată
                    </span>
                  ) : null}
                </td>
                <td className="py-2" onClick={(e) => e.stopPropagation()}>
                  <select
                    className="rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
                    value={selectedAgent[row.id] ?? ""}
                    onChange={(e) => setSelectedAgent((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  >
                    <option value="">— alege agent —</option>
                    {ranked.map((a) => (
                      <option key={a.agentId} value={a.agentId} disabled={!a.is_available}>
                        {a.full_name ?? a.agentId} · ★{a.rating ?? "—"} · {a.badgeCount} badge-uri
                        {a.hasVehicle ? " · vehicul" : ""} · {a.is_available ? "disponibil" : "ocupat"}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2" onClick={(e) => e.stopPropagation()}>
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
          rating, badge-uri și vehicul. Atinge un rând pentru detalii complete ale misiunii.
        </p>
      </section>

      {detailId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setDetailId(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Detalii misiune</h3>
              <button onClick={() => setDetailId(null)} className="text-[var(--text-secondary)]">
                ✕
              </button>
            </div>
            {!detail ? (
              <p className="text-sm text-[var(--text-secondary)]">Se încarcă…</p>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-[var(--text-secondary)]">Client:</span>{" "}
                  {detail.client_name ?? "—"} · nivel verificare {detail.verification_level ?? "?"}
                </p>
                <p>
                  <span className="text-[var(--text-secondary)]">Preluare:</span> {detail.pickup_address ?? "—"}
                </p>
                {detail.destination_address ? (
                  <p>
                    <span className="text-[var(--text-secondary)]">Destinație:</span> {detail.destination_address}
                    {detail.distance_km ? ` · ${detail.distance_km} km` : ""}
                  </p>
                ) : null}
                <p>
                  <span className="text-[var(--text-secondary)]">Preț estimat:</span>{" "}
                  {detail.quote_total !== null ? `${detail.quote_total} lei` : "—"}
                </p>
                <p>
                  <span className="text-[var(--text-secondary)]">Programare:</span>{" "}
                  {detail.scheduled_at ? new Date(detail.scheduled_at).toLocaleString("ro-RO") : "acum"}
                </p>
                <p>
                  <span className="text-[var(--text-secondary)]">Mobilitate:</span> {detail.mobility ?? "—"} ·{" "}
                  <span className="text-[var(--text-secondary)]">Ținută:</span> {detail.dress_code ?? "—"} ·{" "}
                  <span className="text-[var(--text-secondary)]">Preferință agent:</span>{" "}
                  {detail.agent_preference ?? "—"}
                </p>
                <p>
                  <span className="text-[var(--text-secondary)]">Context:</span>{" "}
                  {detail.context_threat_known ? "amenințare cunoscută" : "context uzual"}
                  {detail.context_kind ? ` · ${detail.context_kind}` : ""}
                </p>
                {detail.context_details ? (
                  <p className="rounded border border-[var(--border)] p-2 text-xs text-[var(--text-secondary)]">
                    {detail.context_details}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
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

function SosTab({ notify }: { notify: (urgent: boolean) => void }) {
  const supabase = createClient();
  const [events, setEvents] = useState<SosEventRow[]>([]);
  const [resolvedToday, setResolvedToday] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [journalDraft, setJournalDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const knownEventIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const { data } = await supabase
      .from("shield_events")
      .select("id, source, event_type, status, mission_id, lat, lng, protocol_steps, journal, created_at")
      .in("status", ["open", "acknowledged"])
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as SosEventRow[];
    // Dispatcher-5: SOS is the one place a dispatcher must never miss a
    // new arrival — same first-load guard as the queue tab, plus a
    // louder/urgent tone.
    if (knownEventIds.current !== null) {
      const isNew = rows.some((row) => !knownEventIds.current!.has(row.id));
      if (isNew) notify(true);
    }
    knownEventIds.current = new Set(rows.map((row) => row.id));
    setEvents(rows);

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
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
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
                <br />
                <span className="text-xs text-[var(--text-secondary)]">de {formatElapsed(event.created_at, now)}</span>
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
