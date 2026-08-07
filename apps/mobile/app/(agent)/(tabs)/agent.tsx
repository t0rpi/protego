import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { bookingStyles as s } from "../../../lib/booking-styles";

interface AgentRow {
  status: "in_review" | "approved" | "active" | "blocked";
  is_available: boolean;
  rating: number | null;
}

interface OfferBanner {
  offer_id: string;
  service_key: string;
  expires_at: string;
}

interface MissionBanner {
  mission_id: string;
  mission_status: string;
}

/**
 * Agent home ("/agent"). M3: availability toggle, basic stats, and
 * entry points into whatever is currently active for this agent — a
 * pending offer (agentApp.offerTitle) or an already-assigned mission
 * (agentApp.nextMission). A documents-management screen (upload/renew)
 * is out of scope here — M3's brief lists availability/offer/brief/
 * status/checklist/incident/completion/earnings only; the docExpiry
 * banner below is read-only, sourced from the same agent_documents
 * table M1 already built.
 *
 * Relocated into (agent)/(tabs)/ (2026-08-04, tab bar nav pass) — same
 * URL ("/agent"), unchanged content; group folders don't affect the
 * route path, only this file's own name does.
 */
export default function AgentHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, loading } = useAuth();

  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [missionsCount, setMissionsCount] = useState(0);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [expiringDocs, setExpiringDocs] = useState<{ days: number } | null>(null);
  const [offerBanner, setOfferBanner] = useState<OfferBanner | null>(null);
  const [missionBanner, setMissionBanner] = useState<MissionBanner | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;

    const { data: agentRow } = await supabase
      .from("agents")
      .select("status, is_available, rating")
      .eq("id", uid)
      .single();
    setAgent(agentRow);

    const { count } = await supabase
      .from("mission_reports")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", uid);
    setMissionsCount(count ?? 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { data: earningsRows } = await supabase
      .from("agent_earnings")
      .select("amount, created_at")
      .eq("agent_id", uid)
      .gte("created_at", weekStart.toISOString());
    setWeekEarnings((earningsRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0));

    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const { data: docs } = await supabase
      .from("agent_documents")
      .select("expires_at")
      .eq("agent_id", uid)
      .not("expires_at", "is", null)
      .lte("expires_at", soon.toISOString().slice(0, 10))
      .order("expires_at", { ascending: true })
      .limit(1);
    if (docs && docs.length > 0 && docs[0].expires_at) {
      const days = Math.ceil(
        (new Date(docs[0].expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      setExpiringDocs({ days: Math.max(0, days) });
    } else {
      setExpiringDocs(null);
    }

    const { data: pendingOffer } = await supabase
      .from("agent_mission_briefs")
      .select("offer_id, service_key, offer_expires_at")
      .eq("offer_status", "pending")
      .order("offered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setOfferBanner(
      pendingOffer?.offer_id
        ? {
            offer_id: pendingOffer.offer_id,
            service_key: pendingOffer.service_key ?? "",
            expires_at: pendingOffer.offer_expires_at ?? new Date().toISOString(),
          }
        : null
    );

    const { data: activeMission } = await supabase
      .from("agent_mission_briefs")
      .select("mission_id, mission_status")
      .eq("offer_status", "accepted")
      .in("mission_status", ["assigned", "enroute", "arrived", "active"])
      .order("offered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMissionBanner(
      activeMission?.mission_id
        ? { mission_id: activeMission.mission_id, mission_status: activeMission.mission_status ?? "" }
        : null
    );
  }, [session]);

  useEffect(() => {
    // Simple fetch-on-mount/dependency-change pattern; no data-fetching
    // library wired yet — same accepted exception as the M2 admin
    // pricing page (see that file's comment).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    // P2b QA fix: without this, a new offer was only ever discovered on
    // the next Home-tab focus — since an offer's whole window is 45s,
    // that discovery delay alone was enough to make it arrive already
    // expired. Realtime pushes the refetch the instant mission_offers
    // changes for this agent, while the app is actually open on Home.
    if (!session) return;
    const channel = supabase
      .channel(`agent-offers-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_offers", filter: `agent_id=eq.${session.user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, load]);

  async function toggleAvailability() {
    if (!session || !agent) return;
    setToggling(true);
    const { error } = await supabase
      .from("agents")
      .update({ is_available: !agent.is_available })
      .eq("id", session.user.id);
    if (!error) {
      setAgent({ ...agent, is_available: !agent.is_available });
    }
    setToggling(false);
  }

  // "No session" is no longer checked/redirected here (2026-08-05 logout
  // crash fix — see apps/mobile/app/_layout.tsx's RootNavigator comment
  // for the full explanation). This screen only ever mounts inside the
  // root layout's `Stack.Protected guard={Boolean(session)}` group, which
  // owns ALL session-based mounting exclusively now. Do not reintroduce
  // a per-screen `<Redirect>` for "not logged in" — Tab navigators keep
  // every tab screen mounted in the background, and a Redirect firing
  // from an unfocused Home tab at the same moment as the sign-out
  // transition is what caused the native "child already has a parent"
  // crash in the first place.
  if (loading || !session) {
    return (
      <View style={s.container}>
        <ActivityIndicator color="#C9A227" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* P2h QA fix: this used to always append agentApp.available
            ("Ești disponibil") regardless of agent.is_available — a
            hardcoded claim in the header that could directly contradict
            the toggle card right below it, which does read the real
            state. Availability now has exactly one displayed source of
            truth (the toggle card); the header is just the app name. */}
        <Text style={s.title}>{t("common.appName")}</Text>

        {agent ? (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>
                {agent.rating ? `★ ${agent.rating}` : "—"} {t("agentApp.rating")} · {missionsCount} {t("agentApp.missions")}
              </Text>
              <Text style={s.cardDesc}>
                {weekEarnings.toFixed(2)} lei · {t("agentApp.thisWeek")}
              </Text>
            </View>

            {agent.status !== "active" ? (
              <Text style={s.note}>{t("agentApp.blockedNote")}</Text>
            ) : (
              <Pressable
                style={[s.card, agent.is_available && s.cardSelected]}
                onPress={toggleAvailability}
                disabled={toggling}
              >
                <Text style={s.cardTitle}>
                  {agent.is_available ? t("agentApp.available") : t("agentApp.unavailable")}
                </Text>
                <Text style={s.cardDesc}>
                  {agent.is_available ? t("agentApp.availableSub") : t("agentApp.unavailableSub")}
                </Text>
              </Pressable>
            )}

            {expiringDocs ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>{t("agentApp.docExpiry", { days: expiringDocs.days })}</Text>
                <Text style={s.cardDesc}>{t("agentApp.docExpiryBody")}</Text>
              </View>
            ) : null}

            {offerBanner ? (
              <Pressable style={[s.card, s.cardSelected]} onPress={() => router.push(`/offer/${offerBanner.offer_id}`)}>
                <Text style={s.cardTitle}>{t("agentApp.offerTitle")} · {t("agentApp.offerNew")}</Text>
                <Text style={s.cardDesc}>{offerBanner.service_key}</Text>
              </Pressable>
            ) : null}

            {missionBanner ? (
              <Pressable style={s.card} onPress={() => router.push(`/mission/${missionBanner.mission_id}`)}>
                <Text style={s.cardTitle}>{t("agentApp.nextMission")}</Text>
                <Text style={s.cardDesc}>{missionBanner.mission_status}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={s.note}>{t("agentApp.blockedNote")}</Text>
        )}
      </ScrollView>
    </View>
  );
}
