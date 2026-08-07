import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { secondsUntilOfferExpires } from "@protego/domain";
import { supabase } from "../../../lib/supabase";
import { bookingStyles as s } from "../../../lib/booking-styles";

interface Brief {
  mission_id: string;
  service_key: string;
  city: string;
  duration_hours: number | null;
  dress_code: string;
  mobility: string;
  offer_expires_at: string;
}

/**
 * Incoming mission offer (agentApp.offerTitle) — 45s countdown, zone-only
 * location (no pickup/destination address — agentApp.addressAfter),
 * accept/decline. The estimated-earnings figure design copy implies
 * (agentApp.earnings) isn't computable client-side without the mission's
 * quote (which the agent doesn't have access to before acceptance, by
 * design — see agent_mission_briefs) — shown only once available.
 */
export default function OfferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { offerId } = useLocalSearchParams<{ offerId: string }>();

  const [brief, setBrief] = useState<Brief | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"accepted" | "declined" | "expired" | null>(null);

  useEffect(() => {
    if (!offerId) return;
    supabase
      .from("agent_mission_briefs")
      .select("mission_id, service_key, city, duration_hours, dress_code, mobility, offer_expires_at")
      .eq("offer_id", offerId)
      .single()
      .then(({ data }) => {
        if (!data?.mission_id) return;
        setBrief({
          mission_id: data.mission_id,
          service_key: data.service_key ?? "",
          city: data.city ?? "",
          duration_hours: data.duration_hours,
          dress_code: data.dress_code ?? "",
          mobility: data.mobility ?? "",
          offer_expires_at: data.offer_expires_at ?? new Date().toISOString(),
        });
      });
  }, [offerId]);

  useEffect(() => {
    if (!brief || resolved) return;
    const tick = () => setSecondsLeft(secondsUntilOfferExpires(brief.offer_expires_at));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [brief, resolved]);

  useEffect(() => {
    if (secondsLeft === 0 && !resolved && offerId) {
      // Reacting to the countdown crossing zero (an external timer, not
      // React state) is exactly what this effect is for — the setState
      // here mirrors that external event, it isn't a derived-from-props
      // computation that belongs in render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolved("expired");
      supabase.rpc("expire_mission_offer", { p_offer_id: offerId });
    }
  }, [secondsLeft, resolved, offerId]);

  async function accept() {
    if (!offerId || !brief) return;
    setBusy(true);
    setError(null);
    const { error: acceptError } = await supabase.rpc("accept_mission_offer", { p_offer_id: offerId });
    setBusy(false);
    if (acceptError) {
      setError(acceptError.message);
      return;
    }
    // P2c QA fix: this used to router.replace() straight to the mission
    // screen with zero feedback — the founder's exact complaint was "no
    // clear confirmation of what happens next" after accepting. Show an
    // explicit accepted state first (agentApp.accepted was already
    // written for this — it just wasn't wired into any screen yet).
    setResolved("accepted");
  }

  async function decline() {
    if (!offerId) return;
    setBusy(true);
    await supabase.rpc("decline_mission_offer", { p_offer_id: offerId });
    setBusy(false);
    setResolved("declined");
  }

  if (!brief) {
    return (
      <View style={s.container}>
        <ActivityIndicator color="#C9A227" />
      </View>
    );
  }

  if (resolved === "declined") {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.note}>{t("agentApp.declined")}</Text>
          <Pressable style={s.button} onPress={() => router.replace("/agent")}>
            <Text style={s.buttonText}>{t("common.close")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (resolved === "expired") {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.note}>{t("agentApp.expired")}</Text>
          <Pressable style={s.button} onPress={() => router.replace("/agent")}>
            <Text style={s.buttonText}>{t("common.close")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (resolved === "accepted") {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.title}>{t("agentApp.offerTitle")}</Text>
          <Text style={s.note}>{t("agentApp.accepted")}</Text>
          <Pressable style={s.button} onPress={() => router.replace(`/mission/${brief.mission_id}`)}>
            <Text style={s.buttonText}>{t("agentApp.goToClient")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{t("agentApp.offerTitle")}</Text>
        <Text style={s.quoteTotal}>{secondsLeft ?? "…"}s</Text>

        <View style={s.card}>
          <Text style={s.label}>{t("agentApp.service")}</Text>
          <Text style={s.cardTitle}>{brief.service_key}</Text>

          <Text style={s.label}>{t("agentApp.pickupZone")}</Text>
          <Text style={s.cardDesc}>{brief.city}</Text>
          <Text style={s.note}>{t("agentApp.addressAfter")}</Text>

          {brief.duration_hours ? (
            <>
              <Text style={s.label}>{t("agentApp.duration")}</Text>
              <Text style={s.cardDesc}>{brief.duration_hours}h</Text>
            </>
          ) : null}

          <Text style={s.label}>{t("agentApp.dress")}</Text>
          <Text style={s.cardDesc}>{brief.dress_code}</Text>

          <Text style={s.label}>{t("agentApp.vehicle")}</Text>
          <Text style={s.cardDesc}>{brief.mobility}</Text>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={accept} disabled={busy}>
          {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("agentApp.accept")}</Text>}
        </Pressable>
        <Pressable style={s.ghostButton} onPress={decline} disabled={busy}>
          <Text style={s.ghostButtonText}>{t("agentApp.decline")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
