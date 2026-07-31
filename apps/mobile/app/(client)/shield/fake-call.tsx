import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Vibration, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";

type Caller = "whoMom" | "whoBoss" | "whoHome";
type Timing = "now" | "in1" | "in5";

const TIMING_MS: Record<Timing, number> = { now: 0, in1: 60_000, in5: 5 * 60_000 };

/** Fake call (design `fake.*`) — purely local (schedules an on-device
 * "incoming call" screen); the only server involvement is
 * log_fake_call(), an analytics-free usage log with no location or
 * scenario text recorded (see 20260731140002_shield_public_gate.sql). */
export default function FakeCallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [caller, setCaller] = useState<Caller>("whoMom");
  const [timing, setTiming] = useState<Timing>("in1");
  const [scheduled, setScheduled] = useState(false);
  const [ringing, setRinging] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Vibration.cancel();
  }, []);

  async function schedule() {
    const { error } = await supabase.rpc("log_fake_call");
    if (error) {
      Alert.alert(t("common.close"), error.message);
      return;
    }
    setScheduled(true);
    timerRef.current = setTimeout(() => {
      setRinging(true);
      Vibration.vibrate([500, 500], true);
    }, TIMING_MS[timing]);
  }

  function answer() {
    Vibration.cancel();
    setRinging(false);
    setScheduled(false);
    router.replace("/shield");
  }

  if (ringing) {
    return (
      <View style={styles.ringingContainer}>
        <Text style={styles.incoming}>{t("fake.incoming")}</Text>
        <Text style={styles.caller}>{t(`fake.${caller}`)}</Text>
        <Pressable style={styles.answerButton} onPress={answer}>
          <Text style={styles.answerButtonText}>{t("fake.callMe")}</Text>
        </Pressable>
        <Text style={styles.doneNote}>{t("fake.done")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>{t("fake.intro")}</Text>

      <Text style={styles.label}>{t("fake.who")}</Text>
      <View style={styles.rowWrap}>
        {(["whoMom", "whoBoss", "whoHome"] as Caller[]).map((option) => (
          <Pressable
            key={option}
            style={[styles.chip, caller === option && styles.chipSelected]}
            onPress={() => setCaller(option)}
          >
            <Text style={[styles.chipText, caller === option && styles.chipTextSelected]}>{t(`fake.${option}`)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t("fake.when")}</Text>
      <View style={styles.rowWrap}>
        {(["now", "in1", "in5"] as Timing[]).map((option) => (
          <Pressable
            key={option}
            style={[styles.chip, timing === option && styles.chipSelected]}
            onPress={() => setTiming(option)}
          >
            <Text style={[styles.chipText, timing === option && styles.chipTextSelected]}>{t(`fake.${option}`)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t("fake.scenario")}</Text>
      <Text style={styles.scenarioText}>{t("fake.scenarioText")}</Text>

      {scheduled ? (
        <Text style={styles.pendingNote}>...</Text>
      ) : (
        <Pressable style={styles.scheduleButton} onPress={schedule}>
          <Text style={styles.scheduleButtonText}>{t("fake.callMe")}</Text>
        </Pressable>
      )}

      <Pressable onPress={() => router.back()}>
        <Text style={styles.backLink}>{t("common.back")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: tokens.color.base.ink,
    gap: tokens.spacing[3],
    padding: tokens.spacing[6],
  },
  intro: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
  label: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
    marginTop: tokens.spacing[3],
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing[2],
  },
  chip: {
    borderColor: tokens.color.base.line,
    borderWidth: tokens.border.width,
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
  },
  chipSelected: {
    backgroundColor: tokens.color.base.gold,
    borderColor: tokens.color.base.gold,
  },
  chipText: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
  chipTextSelected: {
    color: tokens.color.semantic.textOnGold,
    fontWeight: "600",
  },
  scenarioText: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.small,
    fontStyle: "italic",
  },
  scheduleButton: {
    backgroundColor: tokens.color.base.gold,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    alignItems: "center",
    justifyContent: "center",
    minHeight: tokens.spacing.tapMin,
    marginTop: tokens.spacing[6],
  },
  scheduleButtonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  pendingNote: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.h2,
    alignSelf: "center",
    marginTop: tokens.spacing[6],
  },
  backLink: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.small,
    alignSelf: "center",
    marginTop: tokens.spacing[3],
  },
  ringingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.base.void,
    gap: tokens.spacing[4],
    padding: tokens.spacing[6],
  },
  incoming: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  caller: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.display,
    fontWeight: "700",
  },
  answerButton: {
    backgroundColor: tokens.color.base.ok,
    borderRadius: tokens.radius.pill,
    width: 140,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  answerButtonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "700",
  },
  doneNote: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.caption,
    textAlign: "center",
  },
});
