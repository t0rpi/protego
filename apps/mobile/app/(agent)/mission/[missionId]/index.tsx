import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { TRACKING_PERSIST_INTERVAL_SECONDS, VEHICLE_CHECKLIST_PHOTO_KEYS, type VehiclePhotoKey } from "@protego/domain";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import { bookingStyles as s } from "../../../../lib/booking-styles";

interface Brief {
  mission_status: string;
  mobility: string;
  pickup_address: string | null;
  destination_address: string | null;
  verification_code: string | null;
  context_kind: string;
  context_details: string | null;
  client_full_name: string | null;
}

interface Checklist {
  consent_signed_at: string | null;
  insurance_confirmed: boolean;
  photos: Partial<Record<VehiclePhotoKey, string>>;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/** Base coordinate for the simulated GPS trail — see the broadcastLocation effect below. */
const MOCK_BASE_LAT = 47.0465;
const MOCK_BASE_LNG = 21.9189;

const PHOTO_LABEL_KEY: Record<VehiclePhotoKey, string> = {
  front: "agentApp.photoFront",
  back: "agentApp.photoBack",
  left: "agentApp.photoLeft",
  right: "agentApp.photoRight",
  km: "agentApp.photoKm",
  fuel: "agentApp.photoFuel",
};

/**
 * Mission brief + one-tap status flow + client-vehicle checklist +
 * completion — one adaptive screen, same pattern as the client booking
 * wizard (single screen, content keyed by state) rather than a separate
 * route per status. Photo capture is a mock: tapping an empty slot
 * records a placeholder storage path, the same shape a real upload
 * would produce — no camera/image-picker library is wired in this
 * milestone (disclosed simplification, same category as M2's payment stub).
 */
export default function MissionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  const { session } = useAuth();

  const [brief, setBrief] = useState<Brief | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [summary, setSummary] = useState("");
  const [incidentCount, setIncidentCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [sosEventId, setSosEventId] = useState<string | null>(null);
  const [sosHoldProgress, setSosHoldProgress] = useState(0);
  const sosHoldInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!missionId) return;
    const { data } = await supabase
      .from("agent_mission_briefs")
      .select(
        "mission_status, mobility, pickup_address, destination_address, verification_code, context_kind, context_details, client_full_name"
      )
      .eq("mission_id", missionId)
      .eq("offer_status", "accepted")
      .maybeSingle();
    setBrief(
      data
        ? {
            mission_status: data.mission_status ?? "",
            mobility: data.mobility ?? "",
            pickup_address: data.pickup_address,
            destination_address: data.destination_address,
            verification_code: data.verification_code,
            context_kind: data.context_kind ?? "",
            context_details: data.context_details,
            client_full_name: data.client_full_name,
          }
        : null
    );

    if (data?.mobility === "client_vehicle") {
      const { data: c } = await supabase
        .from("mission_vehicle_checklists")
        .select("consent_signed_at, insurance_confirmed, photos")
        .eq("mission_id", missionId)
        .maybeSingle();
      setChecklist(c ? { ...c, photos: (c.photos as Partial<Record<VehiclePhotoKey, string>>) ?? {} } : null);
    }

    const { count } = await supabase
      .from("incident_reports")
      .select("id", { count: "exact", head: true })
      .eq("mission_id", missionId);
    setIncidentCount(count ?? 0);

    const { data: chat } = await supabase
      .from("mission_chat_messages")
      .select("id, sender_id, body, created_at")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: true });
    setMessages(chat ?? []);

    if (session) {
      const { data: openSos } = await supabase
        .from("shield_events")
        .select("id")
        .eq("mission_id", missionId)
        .eq("triggered_by", session.user.id)
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSosEventId(openSos?.id ?? null);
    }
  }, [missionId, session]);

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

  async function advanceStatus(next: "enroute" | "arrived") {
    if (!missionId) return;
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.from("missions").update({ status: next }).eq("id", missionId);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  // Simulated GPS trail: no expo-location dependency wired this
  // milestone (disclosed simplification, same treatment as the mock
  // photo capture above) — a slow random walk around a fixed Oradea
  // coordinate stands in for real device location, exercising the exact
  // same record_mission_location() path a real GPS reading would.
  useEffect(() => {
    if (!missionId || !brief || !["enroute", "arrived", "active"].includes(brief.mission_status)) return;
    const interval = setInterval(
      () => {
        const jitter = () => (Math.random() - 0.5) * 0.01;
        supabase.rpc("record_mission_location", {
          p_mission_id: missionId,
          p_lat: MOCK_BASE_LAT + jitter(),
          p_lng: MOCK_BASE_LNG + jitter(),
        });
      },
      TRACKING_PERSIST_INTERVAL_SECONDS * 1000
    );
    return () => clearInterval(interval);
  }, [missionId, brief]);

  async function sendMessage() {
    if (!missionId || !session || !messageBody.trim()) return;
    const { error: sendError } = await supabase
      .from("mission_chat_messages")
      .insert({ mission_id: missionId, sender_id: session.user.id, body: messageBody });
    if (!sendError) {
      setMessageBody("");
      load();
    }
  }

  async function triggerEmergency() {
    if (!missionId) return;
    const { data, error: sosError } = await supabase.rpc("trigger_sos", { p_mission_id: missionId });
    if (!sosError) setSosEventId(data);
  }

  async function cancelEmergency() {
    if (!sosEventId) return;
    await supabase.rpc("cancel_sos", { p_event_id: sosEventId });
    setSosEventId(null);
  }

  async function togglePhoto(key: VehiclePhotoKey) {
    if (!missionId || !checklist) return;
    const nextPhotos = { ...checklist.photos };
    if (nextPhotos[key]) {
      delete nextPhotos[key];
    } else {
      // Mock capture (no camera/image-picker wired this milestone — see
      // this file's header comment); Date.now() here is an event-handler
      // side effect, not a render-time computation, but the lint rule
      // can't tell the two apart statically.
      // eslint-disable-next-line react-hooks/purity
      nextPhotos[key] = `vehicle-checklists/${missionId}/${key}-${Date.now()}.jpg`;
    }
    const { error: photoError } = await supabase
      .from("mission_vehicle_checklists")
      .update({ photos: nextPhotos })
      .eq("mission_id", missionId);
    if (!photoError) {
      setChecklist({ ...checklist, photos: nextPhotos });
    }
  }

  const checklistComplete = checklist
    ? VEHICLE_CHECKLIST_PHOTO_KEYS.every((key) => Boolean(checklist.photos[key]))
    : true;

  async function startProtection() {
    if (!missionId) return;
    setBusy(true);
    setError(null);
    const { error: startError } = await supabase.rpc("start_mission_protection", {
      p_mission_id: missionId,
      p_entered_code: enteredCode,
    });
    setBusy(false);
    if (startError) {
      setError(startError.message);
      return;
    }
    load();
  }

  async function sendCompletionReport() {
    if (!missionId) return;
    setBusy(true);
    setError(null);
    const { error: completeError } = await supabase.rpc("complete_mission", {
      p_mission_id: missionId,
      p_summary: summary || undefined,
    });
    if (completeError) {
      setBusy(false);
      setError(completeError.message);
      return;
    }
    if (session) {
      await supabase.from("agents").update({ is_available: true }).eq("id", session.user.id);
    }
    setBusy(false);
    router.replace("/agent");
  }

  if (!brief) {
    return (
      <View style={s.container}>
        <ActivityIndicator color="#C9A227" />
      </View>
    );
  }

  if (sosEventId) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={[s.title, { color: "#E5484D" }]}>{t("sos.activePill")}</Text>
          <Text style={s.intro}>{t("sos.body")}</Text>
          <Text style={s.note}>{t("legal.not112")}</Text>
          <Pressable style={s.button} onPress={cancelEmergency}>
            <Text style={s.buttonText}>{t("sos.cancelFalse")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (reviewing) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.title}>{t("agentApp.doneTitle", { name: brief.client_full_name ?? "" })}</Text>
          <Text style={s.note}>{t("agentApp.doneNote")}</Text>
          <Text style={s.label}>
            {t("agentApp.incidents")}: {incidentCount > 0 ? incidentCount : t("agentApp.none")}
          </Text>
          <TextInput
            style={[s.input, { minHeight: 96 }]}
            multiline
            value={summary}
            onChangeText={setSummary}
            placeholder={t("agentApp.doneNote")}
            placeholderTextColor="#6B7178"
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={sendCompletionReport} disabled={busy}>
            {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("agentApp.sendReport")}</Text>}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{t("agentApp.briefTitle")}</Text>

        <View style={s.card}>
          {brief.client_full_name ? (
            <>
              <Text style={s.label}>{t("agentApp.client")}</Text>
              <Text style={s.cardTitle}>{brief.client_full_name}</Text>
            </>
          ) : null}
          {brief.pickup_address ? (
            <>
              <Text style={s.label}>{t("agentApp.pickup")}</Text>
              <Text style={s.cardDesc}>{brief.pickup_address}</Text>
            </>
          ) : null}
          {brief.destination_address ? (
            <>
              <Text style={s.label}>{t("agentApp.destination")}</Text>
              <Text style={s.cardDesc}>{brief.destination_address}</Text>
            </>
          ) : null}
          {brief.verification_code ? (
            <>
              <Text style={s.label}>{t("agentApp.code")}</Text>
              <Text style={s.quoteTotal}>{brief.verification_code}</Text>
              <Text style={s.note}>{t("agentApp.codeHint")}</Text>
            </>
          ) : null}
          <Text style={s.label}>{t("agentApp.context")}</Text>
          <Text style={s.cardDesc}>{brief.context_kind}{brief.context_details ? ` — ${brief.context_details}` : ""}</Text>
          {brief.mobility === "client_vehicle" ? (
            <>
              <Text style={s.label}>{t("agentApp.rules")}</Text>
              <Text style={s.cardDesc}>{t("booking.clientVehRules")}</Text>
            </>
          ) : null}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {brief.mission_status === "assigned" ? (
          <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={() => advanceStatus("enroute")} disabled={busy}>
            {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("agentApp.goToClient")}</Text>}
          </Pressable>
        ) : null}

        {brief.mission_status === "enroute" ? (
          <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={() => advanceStatus("arrived")} disabled={busy}>
            {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("agentApp.statusArrived")}</Text>}
          </Pressable>
        ) : null}

        {brief.mission_status === "arrived" ? (
          <>
            {brief.mobility === "client_vehicle" && checklist ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>{t("agentApp.checkTitle")}</Text>
                <Text style={s.cardDesc}>{t("agentApp.checkIntro")}</Text>
                <Text style={s.label}>
                  {t("agentApp.consent")}: {checklist.consent_signed_at ? t("agentApp.consentSigned") : "—"}
                </Text>
                <Text style={s.label}>
                  {t("agentApp.insurance")}: {checklist.insurance_confirmed ? t("agentApp.insuranceValid") : "—"}
                </Text>
                <Text style={s.label}>{t("agentApp.photosRequired")}</Text>
                <View style={s.row}>
                  {VEHICLE_CHECKLIST_PHOTO_KEYS.map((key) => (
                    <Pressable
                      key={key}
                      style={[s.chip, checklist.photos[key] && s.chipSelected]}
                      onPress={() => togglePhoto(key)}
                    >
                      <Text style={s.chipText}>
                        {checklist.photos[key] ? "✓ " : ""}
                        {t(PHOTO_LABEL_KEY[key])}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.note}>{t("agentApp.photosNote")}</Text>
              </View>
            ) : null}

            <TextInput
              style={s.input}
              placeholder={t("agentApp.code")}
              placeholderTextColor="#6B7178"
              value={enteredCode}
              onChangeText={setEnteredCode}
              maxLength={4}
              keyboardType="number-pad"
            />
            <Pressable
              style={[s.button, (busy || !checklistComplete || enteredCode.length !== 4) && s.buttonDisabled]}
              onPress={startProtection}
              disabled={busy || !checklistComplete || enteredCode.length !== 4}
            >
              {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("agentApp.statusStart")}</Text>}
            </Pressable>
          </>
        ) : null}

        {brief.mission_status === "active" ? (
          <>
            <Pressable style={s.button} onPress={() => setReviewing(true)}>
              <Text style={s.buttonText}>{t("agentApp.statusEnd")}</Text>
            </Pressable>
            <Pressable style={s.ghostButton} onPress={() => router.push(`/mission/${missionId}/incident`)}>
              <Text style={s.ghostButtonText}>{t("agentApp.incidentTitle")}</Text>
            </Pressable>
          </>
        ) : null}

        {["assigned", "enroute", "arrived", "active"].includes(brief.mission_status) ? (
          <Text style={s.note}>{t("agentApp.statusHint")}</Text>
        ) : null}

        {brief.mission_status === "done" ? <Text style={s.note}>{t("agentApp.doneNote")}</Text> : null}

        {["assigned", "enroute", "arrived", "active"].includes(brief.mission_status) ? (
          <>
            <Text style={s.label}>{t("chat.monitored")}</Text>
            <View style={{ gap: 8 }}>
              {messages.map((message) => (
                <View key={message.id} style={[s.card, message.sender_id === session?.user.id ? s.cardSelected : null]}>
                  <Text style={s.cardDesc}>{message.body}</Text>
                </View>
              ))}
            </View>
            <TextInput
              style={s.input}
              placeholder={t("chat.placeholder")}
              placeholderTextColor="#6B7178"
              value={messageBody}
              onChangeText={setMessageBody}
            />
            <Pressable style={s.button} onPress={sendMessage}>
              <Text style={s.buttonText}>{t("chat.sent")}</Text>
            </Pressable>

            <Text style={s.note}>{t("legal.not112")}</Text>
            <Pressable
              style={{
                alignSelf: "center",
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: "#E5484D",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 16,
                opacity: 0.5 + sosHoldProgress * 0.5,
              }}
              onPressIn={() => {
                const start = Date.now();
                sosHoldInterval.current = setInterval(() => {
                  const elapsed = Date.now() - start;
                  setSosHoldProgress(Math.min(1, elapsed / 3000));
                  if (elapsed >= 3000) {
                    if (sosHoldInterval.current) clearInterval(sosHoldInterval.current);
                    sosHoldInterval.current = null;
                    setSosHoldProgress(0);
                    triggerEmergency();
                  }
                }, 100);
              }}
              onPressOut={() => {
                if (sosHoldInterval.current) clearInterval(sosHoldInterval.current);
                sosHoldInterval.current = null;
                setSosHoldProgress(0);
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>SOS</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
