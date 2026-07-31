import { useState } from "react";
import { StyleSheet, Text, View, Pressable, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";

/**
 * Active-SOS screen (design `sos.*`) — shown right after
 * trigger_shield_sos() succeeds. A dispatcher's acknowledge/resolve
 * happens on the console side (unchanged M4 flow, now reused for
 * source=shield too); this screen only reflects status and offers the
 * false-alarm cancel + a direct 112 dial, exactly like the mission-SOS
 * screen already does for source=mission.
 */
export default function ShieldSosActiveScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  async function cancelFalseAlarm() {
    if (!eventId) return;
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_sos", { p_event_id: eventId });
    setCancelling(false);
    if (error) {
      Alert.alert(t("common.close"), error.message);
      return;
    }
    setCancelled(true);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pill}>{cancelled ? t("sos.cancelled") : t("sos.activePill")}</Text>
      <Text style={styles.headline}>{t("sos.headline")}</Text>
      {!cancelled ? <Text style={styles.body}>{t("sos.body")}</Text> : null}

      {!cancelled ? (
        <View style={styles.statusRow}>
          <Text style={styles.statusItem}>{t("sos.locationSent")}</Text>
          <Text style={styles.statusItem}>{t("sos.circleNotified", { n: 1 })}</Text>
        </View>
      ) : null}

      <Pressable style={styles.call112} onPress={() => Linking.openURL("tel:112")}>
        <Text style={styles.call112Text}>{t("sos.call112")}</Text>
      </Pressable>

      {!cancelled ? (
        <Pressable style={styles.cancelButton} onPress={cancelFalseAlarm} disabled={cancelling}>
          <Text style={styles.cancelButtonText}>{t("sos.cancelFalse")}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.doneButton} onPress={() => router.replace("/shield")}>
          <Text style={styles.doneButtonText}>{t("common.close")}</Text>
        </Pressable>
      )}

      <Text style={styles.disclaimer}>{t("legal.not112")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.base.ink,
    gap: tokens.spacing[4],
    padding: tokens.spacing[6],
  },
  pill: {
    color: tokens.color.base.danger,
    fontSize: tokens.typography.size.small,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headline: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.h2,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.body,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    gap: tokens.spacing[4],
  },
  statusItem: {
    color: tokens.color.base.ok,
    fontSize: tokens.typography.size.small,
  },
  call112: {
    backgroundColor: tokens.color.base.danger,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[8],
    minHeight: tokens.spacing.tapMin,
    alignItems: "center",
    justifyContent: "center",
  },
  call112Text: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.title,
    fontWeight: "700",
  },
  cancelButton: {
    borderColor: tokens.color.base.line,
    borderWidth: tokens.border.width,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[6],
    minHeight: tokens.spacing.tapMin,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.title,
  },
  doneButton: {
    backgroundColor: tokens.color.base.gold,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[6],
    minHeight: tokens.spacing.tapMin,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  disclaimer: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.caption,
    textAlign: "center",
  },
});
