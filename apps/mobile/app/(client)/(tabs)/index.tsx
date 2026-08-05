import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
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
  const { session } = useAuth();
  const [profile, setProfile] = useState<
    { role: string; verification_level: number; full_name: string | null } | null | undefined
  >(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session) return;
    // A rejected promise here (genuine network failure, not a Postgrest-
    // level error — those resolve with {data: null, error} and were
    // already handled) would otherwise leave `profile` at `undefined`
    // forever, stranding this screen on the loading spinner with no way
    // out. Any failure degrades to "no profile data" instead of hanging.
    await supabase
      .from("profiles")
      .select("role, verification_level, full_name")
      .eq("id", session.user.id)
      .single()
      .then(
        (result) => setProfile(result.data),
        () => setProfile(null)
      );
  }, [session]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Client-8 fix (2026-08-05): "a 'refresh' gesture at the top of the
  // screen makes the image jump/slide but nothing actually refreshes" —
  // this was the plain ScrollView's default overscroll bounce (no
  // RefreshControl was ever wired anywhere in the app). Wired here for
  // real since Home already has refetchable server data (profile /
  // verification level).
  async function onRefresh() {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }

  // "No session" is no longer checked/redirected here (2026-08-05 logout
  // crash fix) — this screen only ever mounts inside the root layout's
  // `Stack.Protected guard={Boolean(session)}` group, which owns ALL
  // session-based mounting/unmounting exclusively now. A per-screen
  // `<Redirect>` here previously raced with the sign-out transition
  // (Tab navigators keep every tab screen mounted in the background, so
  // this Redirect could fire from an unfocused Home at the same moment
  // React Navigation was already mid-transition) and produced a native
  // "child already has a parent" crash. Do not reintroduce that check.
  if (!session) return null;

  if (profile === undefined) {
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.base.gold} />
        }
      >
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
