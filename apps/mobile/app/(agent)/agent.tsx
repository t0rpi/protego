import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { bookingStyles as s } from "../../lib/booking-styles";

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

  if (loading) {
    return (
      <View style={s.container}>
        <ActivityIndicator color="#C9A227" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{t("common.appName")} — {t("agentApp.available")}</Text>

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

            <Pressable style={s.button} onPress={() => router.push("/earnings")}>
              <Text style={s.buttonText}>{t("agentApp.earningsTitle")}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={s.note}>{t("agentApp.blockedNote")}</Text>
        )}

        <Pressable style={s.ghostButton} onPress={() => supabase.auth.signOut()}>
          <Text style={s.ghostButtonText}>{t("common.close")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
