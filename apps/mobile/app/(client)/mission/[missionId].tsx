import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { bookingStyles as s } from "../../../lib/booking-styles";

interface MissionInfo {
  status: string;
  pickup_address: string | null;
  destination_address: string | null;
  verification_code: string | null;
  mobility: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const SOS_HOLD_MS = 3000;

/**
 * Client's live mission screen (design `tracking.*`/`chat.*`/`sos.*`) —
 * reached from the booking wizard's result screen once a mission is
 * confirmed. The "map" here is the provider-agnostic placeholder
 * HANDOFF.md §6 explicitly allows ("styled placeholder layer is
 * acceptable, no paid map key required yet") — a dark card showing the
 * latest known coordinate and a pulsing dot, not a real interactive map.
 */
export default function ClientMissionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { missionId } = useLocalSearchParams<{ missionId: string }>();

  const [mission, setMission] = useState<MissionInfo | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number; recorded_at: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sosEventId, setSosEventId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef<number>(0);

  const load = useCallback(async () => {
    if (!missionId || !session) return;

    const { data: m } = await supabase
      .from("missions")
      .select("status, pickup_address, destination_address, verification_code, mobility")
      .eq("id", missionId)
      .single();
    setMission(m);

    if (m && ["enroute", "arrived", "active"].includes(m.status)) {
      const { data: loc } = await supabase
        .from("mission_latest_location")
        .select("lat, lng, recorded_at")
        .eq("mission_id", missionId)
        .maybeSingle();
      setPosition(
        loc && loc.lat !== null && loc.lng !== null && loc.recorded_at !== null
          ? { lat: loc.lat, lng: loc.lng, recorded_at: loc.recorded_at }
          : null
      );
    } else {
      setPosition(null);
    }

    const { data: chat } = await supabase
      .from("mission_chat_messages")
      .select("id, sender_id, body, created_at")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: true });
    setMessages(chat ?? []);

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
  }, [missionId, session]);

  useEffect(() => {
    // Simple fetch-on-mount/dependency-change pattern; no data-fetching
    // library wired yet — same accepted exception as elsewhere in this app.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  async function logMaskedCall() {
    if (!missionId || !session) return;
    await supabase.from("call_intents").insert({
      mission_id: missionId,
      initiated_by: session.user.id,
      purpose: "mission_call",
    });
  }

  async function createShareLink() {
    if (!missionId || !session) return;
    const { data, error: linkError } = await supabase
      .from("mission_share_links")
      .insert({ mission_id: missionId, created_by: session.user.id })
      .select("token")
      .single();
    if (!linkError && data) {
      setShareUrl(`${process.env.EXPO_PUBLIC_WEB_URL ?? "https://app.protego.ro"}/mission-share/${data.token}`);
    }
  }

  function startSosHold() {
    holdStart.current = Date.now();
    setHoldProgress(0);
    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStart.current;
      setHoldProgress(Math.min(1, elapsed / SOS_HOLD_MS));
      if (elapsed >= SOS_HOLD_MS) {
        cancelSosHold();
        void triggerSos();
      }
    }, 100);
  }

  function cancelSosHold() {
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
    setHoldProgress(0);
  }

  async function triggerSos() {
    if (!missionId) return;
    const { data, error: sosError } = await supabase.rpc("trigger_sos", {
      p_mission_id: missionId,
      p_lat: position?.lat ?? undefined,
      p_lng: position?.lng ?? undefined,
    });
    if (sosError) {
      setError(sosError.message);
      return;
    }
    setSosEventId(data);
  }

  async function cancelFalseAlarm() {
    if (!sosEventId) return;
    await supabase.rpc("cancel_sos", { p_event_id: sosEventId });
    setSosEventId(null);
  }

  if (!mission) {
    return (
      <View style={s.container}>
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  if (sosEventId) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={[s.title, { color: tokens.color.base.danger }]}>{t("sos.activePill")}</Text>
          <Text style={s.intro}>{t("sos.body")}</Text>
          <Text style={s.note}>{t("sos.locationSent")}</Text>
          <Text style={s.note}>{t("legal.not112")}</Text>
          <Pressable style={s.button} onPress={cancelFalseAlarm}>
            <Text style={s.buttonText}>{t("sos.cancelFalse")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>
          {["enroute", "arrived", "active", "done"].includes(mission.status)
            ? t(`tracking.${mission.status}` as "tracking.enroute", { eta: "—", code: mission.verification_code ?? "" })
            : mission.status}
        </Text>

        <View style={[s.card, { backgroundColor: "#101216", alignItems: "center", minHeight: 140, justifyContent: "center" }]}>
          {position ? (
            <>
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: tokens.color.base.gold,
                }}
              />
              <Text style={[s.note, { marginTop: tokens.spacing[2] }]}>
                {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
              </Text>
              <Text style={s.note}>{new Date(position.recorded_at).toLocaleTimeString()}</Text>
            </>
          ) : (
            <Text style={s.note}>{t("common.later")}</Text>
          )}
        </View>

        {mission.verification_code ? (
          <Text style={s.quoteTotal}>{mission.verification_code}</Text>
        ) : null}

        <View style={s.row}>
          <Pressable style={s.chip} onPress={logMaskedCall}>
            <Text style={s.chipText}>{t("tracking.call")}</Text>
          </Pressable>
          <Pressable style={s.chip} onPress={createShareLink}>
            <Text style={s.chipText}>{t("tracking.share")}</Text>
          </Pressable>
        </View>
        {shareUrl ? <Text style={s.note}>{shareUrl}</Text> : null}
        <Text style={s.note}>{t("tracking.maskedCall")}</Text>

        <Text style={s.label}>{t("chat.monitored")}</Text>
        <View style={{ gap: tokens.spacing[2] }}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                s.card,
                message.sender_id === session?.user.id ? s.cardSelected : null,
              ]}
            >
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

        {error ? <Text style={s.error}>{error}</Text> : null}

        {mission.status === "active" ? (
          <>
            <Text style={s.note}>{t("legal.not112")}</Text>
            <Pressable
              style={{
                alignSelf: "center",
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: tokens.color.base.danger,
                alignItems: "center",
                justifyContent: "center",
                marginTop: tokens.spacing[6],
                opacity: 0.5 + holdProgress * 0.5,
                transform: [{ scale: 1 + holdProgress * 0.06 }],
              }}
              onPressIn={startSosHold}
              onPressOut={cancelSosHold}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 20 }}>SOS</Text>
            </Pressable>
          </>
        ) : null}

        {mission.status === "done" ? (
          <Pressable style={s.button} onPress={() => router.replace("/")}>
            <Text style={s.buttonText}>{t("tracking.finish")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
