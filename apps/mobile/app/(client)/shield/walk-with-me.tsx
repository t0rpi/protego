import { useState, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

interface WwmSession {
  id: string;
  destination_text: string;
  estimated_minutes: number;
  expires_at: string;
  status: string;
}

/** Design `wwm.*` — destination + estimated duration timer; check-in
 * confirms arrival; server-side expiry (never client-timer-dependent —
 * this screen's own countdown is a display convenience only, the real
 * enforcement is expire_stale_walk_with_me_sessions() via pg_cron). */
export default function WalkWithMeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [active, setActive] = useState<WwmSession | null>(null);
  const [destination, setDestination] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [watcherCount, setWatcherCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadActive = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("walk_with_me_sessions")
      .select("id, destination_text, estimated_minutes, expires_at, status")
      .eq("user_id", session.user.id)
      .in("status", ["active", "expired_notified"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActive(data ?? null);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadActive();
      if (session) {
        supabase
          .from("shield_contacts")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", session.user.id)
          .then(({ count }) => setWatcherCount(count ?? 0));
      }
    }, [loadActive, session])
  );

  async function start() {
    const parsedMinutes = parseInt(minutes, 10);
    if (!destination.trim() || !parsedMinutes || parsedMinutes <= 0) return;
    setLoading(true);
    const { error } = await supabase.rpc("start_walk_with_me", {
      p_destination_text: destination.trim(),
      p_estimated_minutes: parsedMinutes,
    });
    setLoading(false);
    if (error) {
      Alert.alert(t("common.close"), error.message);
      return;
    }
    setDestination("");
    loadActive();
  }

  async function arrived() {
    if (!active) return;
    setLoading(true);
    const { error } = await supabase.rpc("check_in_walk_with_me", { p_session_id: active.id });
    setLoading(false);
    if (error) {
      Alert.alert(t("common.close"), error.message);
      return;
    }
    Alert.alert(t("wwm.arrivedToast"));
    setActive(null);
  }

  async function extend() {
    if (!active) return;
    setLoading(true);
    const { error } = await supabase.rpc("extend_walk_with_me", { p_session_id: active.id, p_extra_minutes: 10 });
    setLoading(false);
    if (error) {
      Alert.alert(t("common.close"), error.message);
      return;
    }
    loadActive();
  }

  if (active) {
    return (
      <View style={styles.container}>
        <Text style={styles.activeTitle}>{t("wwm.activeTitle")}</Text>
        <Text style={styles.activeNote}>
          {t("wwm.activeNote", { destination: active.destination_text, names: watcherCount })}
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t("wwm.onExpire")}</Text>
          <Text style={styles.infoValue}>{t("wwm.onExpireVal")}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t("wwm.onNoAnswer")}</Text>
          <Text style={styles.infoValue}>{t("wwm.onNoAnswerVal")}</Text>
        </View>

        <Pressable style={styles.arrivedButton} onPress={arrived} disabled={loading}>
          {loading ? <ActivityIndicator color={tokens.color.semantic.textOnGold} /> : (
            <Text style={styles.arrivedButtonText}>{t("wwm.arrived")}</Text>
          )}
        </Pressable>

        <Pressable style={styles.extendButton} onPress={extend} disabled={loading}>
          <Text style={styles.extendButtonText}>{t("wwm.extend")}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>{t("common.back")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>{t("wwm.intro")}</Text>

      <Text style={styles.label}>{t("wwm.destination")}</Text>
      <TextInput
        style={styles.input}
        value={destination}
        onChangeText={setDestination}
        placeholder={t("wwm.destination")}
        placeholderTextColor={tokens.color.base.steelDim}
      />

      <Text style={styles.label}>{t("wwm.duration")}</Text>
      <TextInput
        style={styles.input}
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="number-pad"
        placeholderTextColor={tokens.color.base.steelDim}
      />

      <Text style={styles.label}>{t("wwm.watchers")}</Text>
      <Text style={styles.watcherCount}>{watcherCount}</Text>

      <Pressable style={styles.startButton} onPress={start} disabled={loading}>
        {loading ? <ActivityIndicator color={tokens.color.semantic.textOnGold} /> : (
          <Text style={styles.startButtonText}>{t("wwm.start", { duration: `${minutes} min` })}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.backLink}>{t("common.back")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.base.ink,
    gap: tokens.spacing[3],
    padding: tokens.spacing[6],
  },
  intro: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
    textAlign: "center",
  },
  label: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
    alignSelf: "flex-start",
  },
  input: {
    width: "100%",
    backgroundColor: tokens.color.base.graphite,
    borderRadius: tokens.radius.sm,
    borderColor: tokens.color.base.line,
    borderWidth: tokens.border.width,
    color: tokens.color.semantic.textPrimary,
    padding: tokens.spacing[3],
  },
  watcherCount: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
    alignSelf: "flex-start",
  },
  startButton: {
    backgroundColor: tokens.color.base.gold,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[6],
    minHeight: tokens.spacing.tapMin,
    alignItems: "center",
    justifyContent: "center",
    marginTop: tokens.spacing[4],
    width: "100%",
  },
  startButtonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  activeTitle: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.h2,
    fontWeight: "700",
  },
  activeNote: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  infoLabel: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
  infoValue: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.small,
    fontWeight: "600",
  },
  arrivedButton: {
    backgroundColor: tokens.color.base.ok,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[6],
    minHeight: tokens.spacing.tapMin,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: tokens.spacing[4],
  },
  arrivedButtonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  extendButton: {
    borderColor: tokens.color.base.line,
    borderWidth: tokens.border.width,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[6],
    minHeight: tokens.spacing.tapMin,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  extendButtonText: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.title,
  },
  backLink: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.small,
    marginTop: tokens.spacing[3],
  },
});
