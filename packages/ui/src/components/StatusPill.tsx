import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";

export type MissionDisplayStatus = "confirmed" | "enroute" | "arrived" | "active" | "done" | "review" | "sos";

interface StatusPillProps {
  status: MissionDisplayStatus;
  label: string;
}

// tokens.color.status only defines confirmed/active/review/done/sos —
// enroute/arrived reuse confirmed's gold (design system's "one accent
// colour" rule, HANDOFF §2: gold is the only accent, red is SOS-only).
const STATUS_COLOR: Record<MissionDisplayStatus, string> = {
  confirmed: tokens.color.status.confirmed,
  enroute: tokens.color.status.confirmed,
  arrived: tokens.color.status.confirmed,
  active: tokens.color.status.active,
  done: tokens.color.status.done,
  review: tokens.color.status.review,
  sos: tokens.color.status.sos,
};

/**
 * design/HANDOFF.md §3 StatusPill — 1:1 mapping to the `missions` status
 * machine (packages/domain's MISSION_STATUSES). `review` (high-risk,
 * "în verificare") is ALWAYS this calm gold pill, never danger/red — see
 * §1's rule table. `role="status"` + `aria-live="polite"` per §7 — RN's
 * accessibilityLiveRegion is the platform equivalent.
 */
export function StatusPill({ status, label }: StatusPillProps) {
  const color = STATUS_COLOR[status];
  return (
    <View
      style={[styles.pill, { borderColor: color }]}
      accessibilityRole={status === "sos" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing[2],
    alignSelf: "flex-start",
    borderWidth: tokens.border.width,
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[3],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: tokens.typography.size.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
