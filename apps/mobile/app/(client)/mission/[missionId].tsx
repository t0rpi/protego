import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Card, Disclaimer112, RowLine, StatusPill, tokens, type MissionDisplayStatus } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { cancelMissionPayment } from "../../../lib/payments";
import { bookingStyles as s } from "../../../lib/booking-styles";
import { OverageButton } from "../../../lib/overage-button";
import { ContinueRideButton } from "../../../lib/continue-ride-button";

interface MissionInfo {
  status: string;
  pickup_address: string | null;
  destination_address: string | null;
  verification_code: string | null;
  mobility: string;
  city: string;
  wait_at_destination_minutes: number | null;
  service_key: string | null;
}

interface ReceiptLine {
  label: string;
  amount: number;
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
  const [receipt, setReceipt] = useState<{ lines: ReceiptLine[]; total: number } | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
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
      .select("status, pickup_address, destination_address, verification_code, mobility, city, wait_at_destination_minutes, services(key)")
      .eq("id", missionId)
      .single();
    setMission(
      m
        ? {
            ...m,
            service_key: (m as unknown as { services: { key: string } | null }).services?.key ?? null,
          }
        : null
    );

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

    if (m?.status === "done") {
      const { data: finalQuote } = await supabase
        .from("quotes")
        .select("breakdown, total_estimate")
        .eq("mission_id", missionId)
        .eq("kind", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (finalQuote) {
        setReceipt({
          lines: (finalQuote.breakdown as unknown as ReceiptLine[]) ?? [],
          total: finalQuote.total_estimate,
        });
      }
    }
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

  /** business-rules.md §3 / v2.3 §22 — the fee (if any) is computed
   * server-side by cancel_mission_by_client(); this only reports it. */
  async function cancelMission() {
    if (!missionId) return;
    setCancelBusy(true);
    setError(null);
    try {
      const result = await cancelMissionPayment(missionId);
      setError(
        result.fee > 0
          ? t("quote.cancelFeeCharged", { amount: result.fee })
          : t("quote.cancelReleased")
      );
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "eroare la anulare");
    }
    setCancelBusy(false);
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
          <Disclaimer112 text={t("legal.not112")} />
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
        {["enroute", "arrived", "active", "done"].includes(mission.status) ? (
          <StatusPill
            status={mission.status as MissionDisplayStatus}
            label={t(`tracking.${mission.status}` as "tracking.enroute", { eta: "—", code: mission.verification_code ?? "" })}
          />
        ) : (
          <Text style={s.title}>{mission.status}</Text>
        )}

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
            <Disclaimer112 text={t("legal.not112")} compact />
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

            {mission.service_key === "protect_ride" && mission.wait_at_destination_minutes ? (
              <ContinueRideButton
                missionId={missionId}
                city={mission.city}
                currentDestinationAddress={mission.destination_address}
                waitAtDestinationMinutes={mission.wait_at_destination_minutes}
                onError={setError}
                onContinued={load}
              />
            ) : (
              <OverageButton
                missionId={missionId}
                hours={1}
                label={`+1h (${t("quote.extendPolicy")})`}
                onError={setError}
              />
            )}
          </>
        ) : null}

        {["draft", "quoted", "review", "confirmed"].includes(mission.status) ? (
          <>
            <Text style={s.note}>{t("quote.cancelPolicy", { min: 60 })}</Text>
            <Button label={t("common.cancel")} variant="ghost" loading={cancelBusy} onPress={cancelMission} />
          </>
        ) : null}

        {mission.status === "done" ? (
          <>
            <Text style={s.title}>{t("summary.headline")}</Text>
            {receipt ? (
              <Card style={{ gap: tokens.spacing[2] }}>
                {receipt.lines.map((line, index) => (
                  <RowLine key={`${line.label}-${index}`} label={line.label} value={`${line.amount} lei`} />
                ))}
                <RowLine label={t("quote.total")} value={`${receipt.total} lei`} strong gold />
              </Card>
            ) : null}
            <Text style={s.note}>{t("summary.note")}</Text>
            <Button label={t("tracking.finish")} onPress={() => router.replace("/")} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
