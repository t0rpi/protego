import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardSkeleton, tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

interface AgentProfileRow {
  status: string;
  rating: number | null;
  is_available: boolean;
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
      .select("status, rating, is_available")
      .eq("id", session.user.id)
      .single()
      .then(
        ({ data }) => setAgent(data),
        () => setAgent({ status: "unknown", rating: null, is_available: false })
      );
  }, [session]);

  if (!agent) {
    // P2i QA fix: was a bare spinner on a blank screen for up to ~6s.
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <CardSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("tabs.profile")}</Text>

        <Card style={styles.card}>
          <Text style={styles.email}>{session?.user.email}</Text>
          {/* P2h QA fix: this badge used to key off agent.status (account
              approval state — in_review/approved/active/blocked), not
              agent.is_available (the actual availability toggle), while
              showing agentApp.available ("Ești disponibil") as its label
              — so an active but toggled-OFF agent still saw a green
              "available" checkmark here, contradicting the Home tab's
              own toggle card. Account status and availability are two
              different things; this now shows each correctly instead of
              mislabeling one as the other. */}
          {agent.status === "active" ? (
            <Badge
              label={agent.is_available ? t("agentApp.available") : t("agentApp.unavailable")}
              tone={agent.is_available ? "gold" : "neutral"}
              check={agent.is_available}
            />
          ) : (
            <Badge
              label={t(
                agent.status === "in_review"
                  ? "agentApp.accountStatusInReview"
                  : agent.status === "approved"
                    ? "agentApp.accountStatusApproved"
                    : agent.status === "blocked"
                      ? "agentApp.accountStatusBlocked"
                      : "agentApp.accountStatusUnknown"
              )}
              tone="neutral"
              check={false}
            />
          )}
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
