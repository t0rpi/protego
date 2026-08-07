import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CardSkeleton } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { bookingStyles as s } from "../../../lib/booking-styles";

interface EarningRow {
  amount: number;
  created_at: string;
}

/**
 * Earnings dashboard (agentApp.earningsTitle), day/week/month totals.
 * Computed client-side from the raw agent_earnings ledger rather than
 * solely from agent_weekly_earnings (that view only buckets by week —
 * fine for the weekly figure, not for day/month), so this queries the
 * base table directly and does all three aggregations here. Payout
 * EXECUTION (agentApp.payout: "Payout automat luni") is M5 — this
 * screen is read-only.
 *
 * Relocated into (agent)/(tabs)/ (2026-08-04, tab bar nav pass) — same
 * URL ("/earnings"), unchanged content.
 */
export default function EarningsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [rows, setRows] = useState<EarningRow[] | null>(null);

  useEffect(() => {
    if (!session) return;
    const since = new Date();
    since.setDate(since.getDate() - 31);
    supabase
      .from("agent_earnings")
      .select("amount, created_at")
      .eq("agent_id", session.user.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [session]);

  if (!rows) {
    // P2i QA fix: was a bare spinner on a blank screen for up to ~6s.
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <CardSkeleton />
          <CardSkeleton />
        </ScrollView>
      </View>
    );
  }

  // "Now" only needs to be fresh as of this render — a dashboard summary,
  // not a live countdown — so capturing it here rather than in state is
  // fine; the lint rule can't distinguish that from an unstable render.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const sumSince = (days: number) =>
    rows
      .filter((r) => now - new Date(r.created_at).getTime() <= days * 24 * 60 * 60 * 1000)
      .reduce((sum, r) => sum + Number(r.amount), 0);

  const day = sumSince(1);
  const week = sumSince(7);
  const month = sumSince(30);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{t("agentApp.earningsTitle")}</Text>

        <View style={s.card}>
          <Text style={s.label}>Azi</Text>
          <Text style={s.quoteTotal}>{day.toFixed(2)} lei</Text>
        </View>
        <View style={s.card}>
          <Text style={s.label}>{t("agentApp.thisWeek")}</Text>
          <Text style={s.quoteTotal}>{week.toFixed(2)} lei</Text>
        </View>
        <View style={s.card}>
          <Text style={s.label}>Ultimele 30 zile</Text>
          <Text style={s.quoteTotal}>{month.toFixed(2)} lei</Text>
        </View>

        <Text style={s.label}>Istoric</Text>
        {rows.length === 0 ? (
          <Text style={s.note}>{t("agentApp.none")}</Text>
        ) : (
          rows.map((row, index) => (
            <View style={s.quoteLine} key={`${row.created_at}-${index}`}>
              <Text style={s.quoteLineLabel}>{new Date(row.created_at).toLocaleDateString()}</Text>
              <Text style={s.quoteLineAmount}>{Number(row.amount).toFixed(2)} lei</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
