import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";

export type BadgeTone = "gold" | "ok" | "warn" | "danger" | "neutral";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  check?: boolean;
}

const TONE_COLOR: Record<BadgeTone, { fg: string; bg: string }> = {
  gold: { fg: tokens.color.base.gold, bg: tokens.color.base.goldDim },
  ok: { fg: tokens.color.base.ok, bg: tokens.color.base.okDim },
  warn: { fg: tokens.color.base.warn, bg: tokens.color.base.warnDim },
  danger: { fg: tokens.color.base.danger, bg: tokens.color.base.dangerDim },
  neutral: { fg: tokens.color.semantic.textSecondary, bg: tokens.color.semantic.surfaceRaised },
};

/** design/HANDOFF.md §3 Badge — credentiale agent = gold cu check;
 * documente = ok/warn/danger. */
export function Badge({ label, tone = "neutral", check }: BadgeProps) {
  const colors = TONE_COLOR[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.fg }]}>
        {check ? "✓ " : ""}
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[3],
    alignSelf: "flex-start",
  },
  label: {
    fontSize: tokens.typography.size.caption,
    fontWeight: "700",
  },
});
