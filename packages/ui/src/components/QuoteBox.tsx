import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { RowLine } from "./Card";

interface QuoteLineData {
  label: string;
  amount: number;
}

interface QuoteBoxProps {
  eyebrow: string;
  total: number;
  currency: string;
  note?: string;
  lines: QuoteLineData[];
  formatLineLabel?: (label: string) => string;
}

/**
 * design/HANDOFF.md §3 QuoteBox — 40px/800 total, ALWAYS followed by
 * the full RowLine breakdown (business-rules.md §2: "Totalul apare doar
 * împreună cu defalcarea completă"). Values are never hardcoded — every
 * caller passes compute_quote()'s own numbers.
 */
export function QuoteBox({ eyebrow, total, currency, note, lines, formatLineLabel }: QuoteBoxProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.total}>
        {total} {currency === "RON" ? "lei" : currency}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={styles.lines}>
        {lines.map((line, index) => (
          <RowLine
            key={`${line.label}-${index}`}
            label={formatLineLabel ? formatLineLabel(line.label) : line.label}
            value={`${line.amount} lei`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.color.semantic.surfaceCard,
    borderRadius: tokens.radius.xl,
    borderWidth: tokens.border.width,
    borderColor: tokens.color.semantic.borderGold,
    padding: tokens.spacing[6],
    gap: tokens.spacing[3],
  },
  eyebrow: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.caption,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  total: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.num,
    fontWeight: "800",
  },
  note: {
    color: tokens.color.semantic.textTertiary,
    fontSize: tokens.typography.size.small,
  },
  lines: {
    marginTop: tokens.spacing[2],
    gap: tokens.spacing[2],
    borderTopWidth: tokens.border.width,
    borderTopColor: tokens.color.semantic.border,
    paddingTop: tokens.spacing[3],
  },
});
