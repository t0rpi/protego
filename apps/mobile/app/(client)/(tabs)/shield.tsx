import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Animated, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

/**
 * Shield tab home (design `shield.*`, HANDOFF.md Sec3 SOSButton spec: hold
 * 3s, release = cancel, Disclaimer112 always visible). No real GPS
 * package is installed in this app yet (M4's agent tracking screen
 * already disclosed the same gap and used a fixed mock coordinate near
 * Oradea) — Shield's location reporting follows that same precedent
 * rather than introducing a new native dependency for this milestone.
 *
 * Relocated into (client)/(tabs)/ (2026-08-04, tab bar nav pass) — same
 * URL ("/shield"), unchanged content; group folders don't affect the
 * route path, only this file's own name does.
 */
const MOCK_LAT = 47.0465;
const MOCK_LNG = 21.9189;
const HOLD_MS = 3000;

export default function ShieldHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [holding, setHolding] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [triggering, setTriggering] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.rpc("is_shield_public_enabled").then(({ data }) => setEnabled(Boolean(data)));
  }, []);

  function clearTimers() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    holdTimer.current = null;
    tickTimer.current = null;
  }

  function startHold() {
    if (!enabled || triggering) return;
    setHolding(true);
    setCountdown(3);
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start();

    tickTimer.current = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : c));
    }, 1000);

    holdTimer.current = setTimeout(async () => {
      clearTimers();
      setTriggering(true);
      const { data, error } = await supabase.rpc("trigger_shield_sos", {
        p_lat: MOCK_LAT,
        p_lng: MOCK_LNG,
      });
      setTriggering(false);
      setHolding(false);
      progress.setValue(0);
      if (error) {
        Alert.alert(t("common.close"), error.message);
        return;
      }
      router.push({ pathname: "/shield/sos-active", params: { eventId: data as string } });
    }, HOLD_MS);
  }

  function cancelHold() {
    clearTimers();
    setHolding(false);
    progress.setValue(0);
  }

  if (!session) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>{t("shield.badge")}</Text>

      <Pressable
        style={[styles.sosButton, holding && styles.sosButtonHolding]}
        onPressIn={startHold}
        onPressOut={cancelHold}
        accessibilityRole="button"
        accessibilityLabel={t("shield.sosHold")}
      >
        {triggering ? (
          <ActivityIndicator color={tokens.color.semantic.textOnGold} />
        ) : (
          <Text style={styles.sosButtonText}>
            {holding ? t("shield.sosRelease", { n: countdown }) : "SOS"}
          </Text>
        )}
      </Pressable>
      <Text style={styles.sosHint}>{holding ? t("shield.sosRelease", { n: countdown }) : t("shield.sosHold")}</Text>
      <Text style={styles.disclaimer}>{t("legal.not112")}</Text>

      {enabled === false ? (
        <Text style={styles.gateNotice}>Shield nu este încă activat public pentru acest cont de test.</Text>
      ) : null}

      <Text style={styles.note}>{t("shield.sosNote")}</Text>

      <Text style={styles.toolsTitle}>{t("shield.tools")}</Text>

      <Pressable style={styles.toolCard} onPress={() => router.push("/shield/walk-with-me")}>
        <Text style={styles.toolTitle}>{t("shield.wwmTitle")}</Text>
        <Text style={styles.toolDesc}>{t("shield.wwmDesc")}</Text>
      </Pressable>

      <Pressable style={styles.toolCard} onPress={() => router.push("/shield/circle")}>
        <Text style={styles.toolTitle}>{t("shield.circleTitle")}</Text>
        <Text style={styles.toolDesc}>{t("shield.circleDesc")}</Text>
      </Pressable>

      <Pressable style={styles.toolCard} onPress={() => router.push("/shield/fake-call")}>
        <Text style={styles.toolTitle}>{t("shield.fakeTitle")}</Text>
        <Text style={styles.toolDesc}>{t("shield.fakeDesc")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    backgroundColor: tokens.color.base.ink,
    gap: tokens.spacing[4],
    padding: tokens.spacing[6],
  },
  badge: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.caption,
    fontWeight: "600",
  },
  sosButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: tokens.color.base.danger,
    alignItems: "center",
    justifyContent: "center",
    marginTop: tokens.spacing[4],
  },
  sosButtonHolding: {
    transform: [{ scale: 0.94 }],
  },
  sosButtonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.h1,
    fontWeight: "700",
  },
  sosHint: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.caption,
    textAlign: "center",
  },
  disclaimer: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.caption,
    textAlign: "center",
  },
  gateNotice: {
    color: tokens.color.base.danger,
    fontSize: tokens.typography.size.caption,
    textAlign: "center",
  },
  note: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
    textAlign: "center",
  },
  toolsTitle: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
    fontWeight: "600",
    alignSelf: "flex-start",
    marginTop: tokens.spacing[4],
  },
  toolCard: {
    width: "100%",
    backgroundColor: tokens.color.base.graphite,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing[4],
    gap: tokens.spacing[1],
  },
  toolTitle: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  toolDesc: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
});
