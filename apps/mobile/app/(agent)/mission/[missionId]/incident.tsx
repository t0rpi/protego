import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import { bookingStyles as s } from "../../../../lib/booking-styles";

type IncidentType = "client_dispute" | "safety_concern" | "vehicle_issue" | "other";
type Severity = "low" | "medium" | "high";

/**
 * Incident report form (agentApp.incidentTitle). The 4 incident-type
 * values and 3 severity values below are not themselves design copy —
 * only the field LABELS (incidentType/severity) exist in
 * design/HANDOFF.md's strings; no design source enumerates the actual
 * option values, so these are a reasonable, disclosed placeholder set
 * rather than invented "confirmed" categories.
 */
export default function IncidentReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { missionId } = useLocalSearchParams<{ missionId: string }>();

  const [incidentType, setIncidentType] = useState<IncidentType>("client_dispute");
  const [severity, setSeverity] = useState<Severity>("low");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!missionId || !session || !description.trim()) return;
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from("incident_reports").insert({
      mission_id: missionId,
      agent_id: session.user.id,
      incident_type: incidentType,
      severity,
      description,
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.title}>{t("agentApp.incidentTitle")}</Text>
          <Text style={s.note}>{t("agentApp.sendIncident")}</Text>
          <Pressable style={s.button} onPress={() => router.back()}>
            <Text style={s.buttonText}>{t("common.close")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{t("agentApp.incidentTitle")}</Text>
        <Text style={s.note}>{t("agentApp.incidentNote")}</Text>

        <Text style={s.label}>{t("agentApp.incidentType")}</Text>
        <View style={s.row}>
          {(["client_dispute", "safety_concern", "vehicle_issue", "other"] as const).map((type) => (
            <Pressable
              key={type}
              style={[s.chip, incidentType === type && s.chipSelected]}
              onPress={() => setIncidentType(type)}
            >
              <Text style={s.chipText}>{type}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>{t("agentApp.severity")}</Text>
        <View style={s.row}>
          {(["low", "medium", "high"] as const).map((level) => (
            <Pressable
              key={level}
              style={[s.chip, severity === level && s.chipSelected]}
              onPress={() => setSeverity(level)}
            >
              <Text style={s.chipText}>{level}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>{t("agentApp.whatHappened")}</Text>
        <TextInput
          style={[s.input, { minHeight: 96 }]}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <Text style={s.note}>{t("agentApp.evidence")}: {t("agentApp.none")}</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable
          style={[s.button, (busy || !description.trim()) && s.buttonDisabled]}
          onPress={submit}
          disabled={busy || !description.trim()}
        >
          {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("agentApp.sendIncident")}</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}
