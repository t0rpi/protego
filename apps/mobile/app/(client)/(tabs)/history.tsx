import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Card, StatusPill, tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { ACTIVE_MISSION_STATUSES } from "../../../lib/mission-status";
import { cancelMissionPayment } from "../../../lib/payments";
import { SERVICE_TITLE_KEY } from "../../../lib/enum-labels";

interface HistoryMission {
  id: string;
  destination_address: string | null;
  pickup_address: string | null;
  created_at: string;
  service_key: string;
  total: number | null;
}

interface ActiveMission {
  id: string;
  status: string;
  destination_address: string | null;
  pickup_address: string | null;
  created_at: string;
  service_key: string;
}

// P2g QA fix: a mission still in one of these statuses never got an
// agent — the same set the tracking screen already allows cancelling
// from (mission/[missionId].tsx's cancelMission()). A client had no way
// to clear a stuck one except navigating back into that screen first;
// surfacing the same, already-approved cancel action directly on the
// History card fixes the actual complaint (stale test missions with
// nothing to distinguish them piling up as "active" forever) without
// inventing a new auto-expiry policy, which is a business decision
// (timing, payment-hold handling) this fix doesn't make unilaterally.
const CANCELABLE_STATUSES = ["review", "confirmed"];

/**
 * Client History tab (design/HANDOFF.md §5 inventory: "istoric + re-book",
 * i18n history.* keys already existed, unused until this Pass A screen).
 * F5 fix (2026-08-07, audit-findings.md): active/in-progress missions
 * are now listed too, in their own section above the "done" history —
 * previously this screen only ever queried status='done', so a client
 * had no way back to an in-review/confirmed/active mission from here at
 * all if they'd already left its tracking screen.
 */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [missions, setMissions] = useState<HistoryMission[] | null>(null);
  const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    // A rejected fetch here (network failure) would otherwise leave
    // `missions` at `null` forever, stranding this screen on the loading
    // spinner — same fix as the Home tab's profile fetch.
    try {
      const [{ data: activeRows }, { data: rows }] = await Promise.all([
        supabase
          .from("missions")
          .select("id, status, destination_address, pickup_address, created_at, services(key)")
          .eq("client_id", session.user.id)
          .in("status", ACTIVE_MISSION_STATUSES)
          .order("created_at", { ascending: false }),
        supabase
          .from("missions")
          .select("id, destination_address, pickup_address, created_at, services(key)")
          .eq("client_id", session.user.id)
          .eq("status", "done")
          .order("created_at", { ascending: false }),
      ]);
      setActiveMissions(
        (activeRows ?? []).map((row) => ({
          id: row.id,
          status: row.status,
          destination_address: row.destination_address,
          pickup_address: row.pickup_address,
          created_at: row.created_at,
          service_key: (row as unknown as { services: { key: string } | null }).services?.key ?? "",
        }))
      );

      const missionIds = (rows ?? []).map((row) => row.id);
      const totalsByMission = new Map<string, number>();
      if (missionIds.length > 0) {
        const { data: quoteRows } = await supabase
          .from("quotes")
          .select("mission_id, total_estimate")
          .in("mission_id", missionIds)
          .eq("kind", "final");
        for (const quote of quoteRows ?? []) {
          totalsByMission.set(quote.mission_id, quote.total_estimate);
        }
      }

      setMissions(
        (rows ?? []).map((row) => ({
          id: row.id,
          destination_address: row.destination_address,
          pickup_address: row.pickup_address,
          created_at: row.created_at,
          service_key: (row as unknown as { services: { key: string } | null }).services?.key ?? "",
          total: totalsByMission.get(row.id) ?? null,
        }))
      );
    } catch {
      setMissions([]);
    }
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Client-8 fix (2026-08-05): "a 'refresh' gesture at the top of the
  // screen makes the image jump/slide but nothing actually refreshes" —
  // no RefreshControl was ever wired anywhere in the app, so pulling
  // down only ever triggered the ScrollView's default overscroll bounce.
  // History already has refetchable server data via `load`.
  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function cancelActive(missionId: string) {
    setCancelingId(missionId);
    try {
      await cancelMissionPayment(missionId);
      await load();
    } catch {
      // Best-effort — a failed cancel here just leaves the card as-is;
      // the client can retry, same as the tracking screen's own cancel.
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.base.gold} />
        }
      >
        <Text style={styles.title}>{t("history.title")}</Text>

        {activeMissions.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t("history.activeTitle")}</Text>
            {activeMissions.map((mission) => (
              <Card key={mission.id} style={styles.card}>
                <StatusPill
                  status={
                    (["review", "confirmed", "enroute", "arrived", "active"].includes(mission.status)
                      ? mission.status
                      : "confirmed") as "review" | "confirmed" | "enroute" | "arrived" | "active"
                  }
                  label={t(`home.status.${mission.status}` as "home.status.review")}
                />
                <Text style={styles.serviceLabel}>
                  {SERVICE_TITLE_KEY[mission.service_key] ? t(SERVICE_TITLE_KEY[mission.service_key]) : ""}
                </Text>
                <Text style={styles.address}>{mission.destination_address ?? mission.pickup_address ?? ""}</Text>
                <Text style={styles.date}>
                  {new Date(mission.created_at).toLocaleDateString()}{" "}
                  {new Date(mission.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <View style={styles.actions}>
                  <Button
                    label={t("history.continueMission")}
                    size="sm"
                    onPress={() => router.push(`/mission/${mission.id}`)}
                  />
                  {CANCELABLE_STATUSES.includes(mission.status) ? (
                    <Button
                      label={t("common.cancel")}
                      size="sm"
                      variant="ghost"
                      loading={cancelingId === mission.id}
                      onPress={() => cancelActive(mission.id)}
                    />
                  ) : null}
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {missions === null ? (
          <ActivityIndicator color={tokens.color.base.gold} />
        ) : missions.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>{t("history.emptyTitle")}</Text>
            <Text style={styles.emptyDesc}>{t("history.emptyDesc")}</Text>
          </Card>
        ) : (
          missions.map((mission) => (
            <Card key={mission.id} style={styles.card}>
              <StatusPill status="done" label={t("tracking.done")} />
              <Text style={styles.address}>{mission.destination_address ?? mission.pickup_address ?? ""}</Text>
              <Text style={styles.date}>{new Date(mission.created_at).toLocaleDateString()}</Text>
              {mission.total !== null ? <Text style={styles.total}>{mission.total} lei</Text> : null}
              <View style={styles.actions}>
                <Button
                  label={t("history.repeat")}
                  size="sm"
                  variant="ghost"
                  onPress={() => router.push(`/booking/${mission.service_key || "protect_ride"}`)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  sectionLabel: {
    color: tokens.color.semantic.textTertiary,
    fontSize: tokens.typography.size.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: tokens.spacing[2],
  },
  emptyTitle: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  emptyDesc: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.small,
  },
  card: {
    gap: tokens.spacing[2],
  },
  serviceLabel: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  address: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
    fontWeight: "600",
  },
  date: {
    color: tokens.color.semantic.textTertiary,
    fontSize: tokens.typography.size.caption,
  },
  total: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.title,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing[2],
  },
});
