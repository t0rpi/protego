import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

interface AgentProfileRow {
  status: string;
  rating: number | null;
}

/**
 * Agent Profile tab (new, 2026-08-04 tab bar nav pass) — minimal:
 * status/rating badge + sign-out. Document upload/renewal management is
 * out of this pass's scope (agentApp.docExpiry is already surfaced as a
 * read-only banner on the Home tab).
 */
export default function AgentProfileScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [agent, setAgent] = useState<AgentProfileRow | null>(null);

  useEffect(() => {
    if (!session) return;
    // A rejected fetch here (network failure) would otherwise leave
    // `agent` at `null` forever, stranding this screen on the loading
    // spinner — same fix as the client Home tab's profile fetch.
    supabase
      .from("agents")
      .select("status, rating")
      .eq("id", session.user.id)
      .single()
      .then(
        ({ data }) => setAgent(data),
        () => setAgent({ status: "unknown", rating: null })
      );
  }, [session]);

  if (!agent) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("tabs.profile")}</Text>

        <Card style={styles.card}>
          <Text style={styles.email}>{session?.user.email}</Text>
          <Badge label={agent.status === "active" ? t("agentApp.available") : agent.status} tone={agent.status === "active" ? "gold" : "neutral"} check={agent.status === "active"} />
          {agent.rating ? <Text style={styles.rating}>★ {agent.rating}</Text> : null}
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
  email: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
    fontWeight: "600",
  },
  rating: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.title,
    fontWeight: "700",
  },
});
