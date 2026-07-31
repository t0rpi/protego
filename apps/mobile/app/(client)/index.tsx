import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";

/**
 * Client home. M1 adds the session guard + a minimal account summary
 * (role, verification level) so the auth flow is actually reachable and
 * checkable end-to-end. Shield tab, booking flow (10 steps), mission
 * tracking etc. land starting M2/M6 (MASTERPROMPT §5A, design/HANDOFF.md).
 */
export default function ClientHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, loading } = useAuth();
  // undefined = not fetched yet (used to gate the role redirect below so we
  // don't flash the client UI at agents); null = fetched but no row/error,
  // falls through to the client UI same as before this field existed.
  const [profile, setProfile] = useState<
    { role: string; verification_level: number } | null | undefined
  >(undefined);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("role, verification_level")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  // Role-based routing: this route ("/") is also where login/OTP redirect
  // unconditionally after auth. Agents must never see the client home —
  // wait for the profile fetch (role starts null) before deciding, so we
  // don't flash the client UI first.
  if (profile === undefined) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  if (profile?.role === "agent") {
    return <Redirect href="/agent" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>PROTEGO — client (M1: auth wired)</Text>
      {/* Dev-only status line — no designed profile screen exists yet
          (that's M2+), so this isn't run through i18n like real UI copy. */}
      {profile ? (
        <Text style={styles.meta}>
          {profile.role} · verification level {profile.verification_level}
        </Text>
      ) : null}

      {profile && profile.verification_level < 2 ? (
        <Pressable style={styles.button} onPress={() => router.push("/verify-identity")}>
          <Text style={styles.buttonText}>{t("idv.title")}</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.button} onPress={() => router.push("/booking/protect_ride")}>
        <Text style={styles.buttonText}>{t("home.rideTitle")}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => router.push("/booking/escort")}>
        <Text style={styles.buttonText}>{t("home.escortTitle")}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => router.push("/booking/hourly")}>
        <Text style={styles.buttonText}>{t("home.hourlyTitle")}</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => router.push("/shield")}>
        <Text style={styles.buttonText}>{t("tabs.shield")}</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>{t("common.close")}</Text>
      </Pressable>
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
  text: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
  meta: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.caption,
  },
  button: {
    backgroundColor: tokens.color.base.gold,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[6],
    minHeight: tokens.spacing.tapMin,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
});
