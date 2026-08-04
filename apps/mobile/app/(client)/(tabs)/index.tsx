import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Card, tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

type ServiceKey = "protect_ride" | "escort" | "hourly";

/**
 * Client Home (design/HANDOFF.md §5 inventory: "home + 3 servicii +
 * trust bar", PRD §4-6). Pass A exemplar screen (2026-08-04) — first
 * real application of the packages/ui component library beyond tokens-
 * direct styling. Service cards navigate straight into the existing
 * booking wizard (unchanged); the trust bar text was already fully
 * translated in i18n's home.* keys but had never been rendered anywhere
 * until this screen.
 */
export default function ClientHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<
    { role: string; verification_level: number; full_name: string | null } | null | undefined
  >(undefined);

  // TEMPORARY boot-stage diagnostic (2026-08-05) — remove once resolved.
  console.log("[boot] ClientHomeScreen render", { loading, hasSession: Boolean(session), profile });

  useEffect(() => {
    console.log("[boot] Home profile effect fired", { hasSession: Boolean(session) });
    if (!session) return;
    // A rejected promise here (genuine network failure, not a Postgrest-
    // level error — those resolve with {data: null, error} and were
    // already handled) would otherwise leave `profile` at `undefined`
    // forever, stranding this screen on the loading spinner with no way
    // out. Any failure degrades to "no profile data" instead of hanging.
    supabase
      .from("profiles")
      .select("role, verification_level, full_name")
      .eq("id", session.user.id)
      .single()
      .then(
        (result) => {
          console.log("[boot] Home profile fetch resolved", result);
          setProfile(result.data);
        },
        (err) => {
          console.log("[boot] Home profile fetch rejected", err);
          setProfile(null);
        }
      );
  }, [session]);

  // Root cause of the reported permanent-spinner hang (2026-08-05, found
  // via boot logs): this used to check `profile === undefined` in the
  // SAME condition as `loading`, before checking `!session`. The profile
  // fetch effect above does `if (!session) return;` — so when there's no
  // session, `profile` never gets set and stays `undefined` forever,
  // trapping a logged-out device on this spinner and never reaching the
  // redirect-to-login below. Order matters: resolve auth loading first,
  // then handle "no session" immediately, and only THEN wait on profile
  // (which only ever matters once we know a session exists).
  if (loading) {
    console.log("[boot] Home showing loading spinner (auth loading)");
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  if (!session) {
    console.log("[boot] Home redirecting to /login (no session)");
    return <Redirect href="/login" />;
  }

  if (profile === undefined) {
    console.log("[boot] Home showing loading spinner (profile fetch in flight)");
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  if (profile?.role === "agent") {
    return <Redirect href="/agent" />;
  }

  const services: { key: ServiceKey; title: string; desc: string }[] = [
    { key: "protect_ride", title: t("home.rideTitle"), desc: t("home.rideDesc") },
    { key: "escort", title: t("home.escortTitle"), desc: t("home.escortDesc") },
    { key: "hourly", title: t("home.hourlyTitle"), desc: t("home.hourlyDesc") },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.greeting}>
          {t("home.greetingEvening", { name: profile?.full_name ?? "" })}
        </Text>
        <Text style={styles.greetingSub}>{t("home.greetingSub")}</Text>

        {profile && profile.verification_level < 2 ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{t("idv.title")}</Text>
            <Button label={t("idv.title")} size="sm" onPress={() => router.push("/verify-identity")} />
          </Card>
        ) : null}

        <Text style={styles.sectionLabel}>{t("home.services")}</Text>
        {services.map((service) => (
          <Card key={service.key} style={styles.card}>
            <Text style={styles.serviceTitle}>{service.title}</Text>
            <Text style={styles.serviceDesc}>{service.desc}</Text>
            <Button label={t("common.continue")} onPress={() => router.push(`/booking/${service.key}`)} />
          </Card>
        ))}

        <View style={styles.trustBar}>
          <Text style={styles.trustText}>{t("home.trust")}</Text>
        </View>
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
  greeting: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.h2,
    fontWeight: "700",
  },
  greetingSub: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.body,
  },
  sectionLabel: {
    color: tokens.color.semantic.textTertiary,
    fontSize: tokens.typography.size.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: tokens.spacing[2],
  },
  card: {
    gap: tokens.spacing[3],
  },
  cardTitle: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  serviceTitle: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.h3,
    fontWeight: "700",
  },
  serviceDesc: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.small,
    lineHeight: tokens.typography.size.small * tokens.typography.lineHeight.body,
  },
  trustBar: {
    marginTop: tokens.spacing[4],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.semantic.surfaceRaised,
  },
  trustText: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.small,
    lineHeight: tokens.typography.size.small * tokens.typography.lineHeight.note,
    textAlign: "center",
  },
});
