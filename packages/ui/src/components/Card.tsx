import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../tokens";

interface CardProps {
  children: ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** design/HANDOFF.md §3 Card — the generic surface every OptionCard/
 * ServiceCard/QuoteBox composes from. `selected` = gold border+fill. */
export function Card({ children, selected, style }: CardProps) {
  return <View style={[styles.card, selected ? styles.cardSelected : null, style]}>{children}</View>;
}

interface RowLineProps {
  label: string;
  value: string;
  strong?: boolean;
  gold?: boolean;
}

/** design/HANDOFF.md §3 RowLine — price breakdowns are ALWAYS a RowLine
 * list, never an opaque total (business-rules.md §2). */
export function RowLine({ label, value, strong, gold }: RowLineProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong ? styles.rowLabelStrong : null]}>{label}</Text>
      <Text style={[styles.rowValue, strong ? styles.rowValueStrong : null, gold ? styles.rowValueGold : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.semantic.surfaceCard,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.border.width,
    borderColor: tokens.color.semantic.border,
    padding: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  cardSelected: {
    borderColor: tokens.color.base.gold,
    backgroundColor: tokens.color.base.goldDim,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.body,
  },
  rowLabelStrong: {
    color: tokens.color.semantic.textPrimary,
    fontWeight: "700",
  },
  rowValue: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
  },
  rowValueStrong: {
    fontSize: tokens.typography.size.num,
    fontWeight: "800",
  },
  rowValueGold: {
    color: tokens.color.base.gold,
  },
});
