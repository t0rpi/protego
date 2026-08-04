import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

interface ProfileRow {
  full_name: string | null;
  verification_level: number;
}

interface ProtectedPerson {
  id: string;
  full_name: string;
}

/**
 * Client Profile tab (design/HANDOFF.md §5 inventory: "profil & persoane
 * · abonamente placeholder"; i18n's profile and subs namespaces already
 * existed, unused until this Pass A screen). Subscriptions section stays a
 * visual-only placeholder — post-MVP per §5/PRD §9, same as the design
 * spec calls for.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [persons, setPersons] = useState<ProtectedPerson[]>([]);

  useEffect(() => {
    if (!session) return;
    // A rejected fetch here (network failure) would otherwise leave
    // `profile` at `null` forever, stranding this screen on the loading
    // spinner — same fix as the Home tab's profile fetch.
    supabase
      .from("profiles")
      .select("full_name, verification_level")
      .eq("id", session.user.id)
      .single()
      .then(
        ({ data }) => setProfile(data),
        () => setProfile({ full_name: null, verification_level: 1 })
      );

    supabase
      .from("protected_persons")
      .select("id, full_name")
      .eq("owner_id", session.user.id)
      .then(
        ({ data }) => setPersons(data ?? []),
        () => setPersons([])
      );
  }, [session]);

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("profile.title")}</Text>

        <Card style={styles.card}>
          <Text style={styles.name}>{profile.full_name ?? session?.user.email}</Text>
          {profile.verification_level >= 2 ? <Badge label={t("profile.verified")} tone="gold" check /> : null}
        </Card>

        <Text style={styles.sectionLabel}>{t("profile.persons")}</Text>
        {persons.map((person) => (
          <Card key={person.id} style={styles.card}>
            <Text style={styles.personName}>{person.full_name}</Text>
          </Card>
        ))}
        <Card style={styles.card}>
          <Text style={styles.addPersonTitle}>{t("profile.addPerson")}</Text>
          <Text style={styles.addPersonDesc}>{t("profile.addPersonDesc")}</Text>
        </Card>

        <Text style={styles.sectionLabel}>{t("profile.settings")}</Text>
        <Card style={styles.card}>
          <Text style={styles.settingRow}>{t("profile.language")}</Text>
          <Text style={styles.settingRow}>{t("profile.payment")}</Text>
          <Text style={styles.settingRow}>{t("profile.gdprData")}</Text>
        </Card>

        <Text style={styles.sectionLabel}>{t("subs.title")}</Text>
        <Card style={styles.card}>
          <Text style={styles.subsTitle}>
            {t("subs.drumSigur")} · <Text style={styles.subsSoon}>{t("subs.soon")}</Text>
          </Text>
          <Text style={styles.subsDesc}>{t("subs.drumSigurDesc")}</Text>
        </Card>

        <Button label={t("common.close")} variant="ghost" onPress={() => supabase.auth.signOut()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.semantic.surfaceApp,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.color.semantic.surfaceApp,
  },
  scroll: {
    padding: tokens.spacing[6],
    gap: tokens.spacing[4],
    paddingBottom: tokens.spacing[10],
  },
  title: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.h2,
    fontWeight: "700",
  },
  card: {
    gap: tokens.spacing[2],
  },
  name: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.title,
    fontWeight: "700",
  },
  sectionLabel: {
    color: tokens.color.semantic.textTertiary,
    fontSize: tokens.typography.size.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: tokens.spacing[2],
  },
  personName: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
  },
  addPersonTitle: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.body,
    fontWeight: "600",
  },
  addPersonDesc: {
    color: tokens.color.semantic.textTertiary,
    fontSize: tokens.typography.size.caption,
  },
  settingRow: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.body,
    paddingVertical: tokens.spacing[1],
  },
  subsTitle: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
    fontWeight: "600",
  },
  subsSoon: {
    color: tokens.color.semantic.textTertiary,
    fontWeight: "400",
    textTransform: "uppercase",
    fontSize: tokens.typography.size.caption,
  },
  subsDesc: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.small,
  },
});
