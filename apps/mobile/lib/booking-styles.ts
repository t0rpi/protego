import { StyleSheet } from "react-native";
import { tokens } from "@protego/ui";

/** Shared styling for the booking wizard — same "tokens directly, no
 * component library yet" scope as auth-styles.ts (see that file's
 * comment). */
export const bookingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.base.ink,
  },
  scroll: {
    padding: tokens.spacing[6],
    gap: tokens.spacing[4],
    paddingBottom: tokens.spacing[10],
  },
  stepLabel: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.caption,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: tokens.color.base.paper,
    fontSize: tokens.typography.size.h2,
    fontWeight: "700",
  },
  intro: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.body,
    lineHeight: tokens.typography.size.body * tokens.typography.lineHeight.body,
  },
  label: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.caption,
    marginBottom: tokens.spacing[1],
  },
  input: {
    borderWidth: tokens.border.width,
    borderColor: tokens.color.base.line,
    borderRadius: tokens.radius.md,
    color: tokens.color.base.paper,
    backgroundColor: tokens.color.base.graphite,
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    fontSize: tokens.typography.size.body,
    minHeight: tokens.spacing.tapMin,
  },
  card: {
    borderWidth: tokens.border.width,
    borderColor: tokens.color.base.line,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.base.graphite,
    padding: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  cardSelected: {
    borderColor: tokens.color.base.gold,
    backgroundColor: tokens.color.base.goldDim,
  },
  cardTitle: {
    color: tokens.color.base.paper,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  cardDesc: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing[2],
  },
  chip: {
    borderWidth: tokens.border.width,
    borderColor: tokens.color.base.line,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
  },
  chipSelected: {
    borderColor: tokens.color.base.gold,
    backgroundColor: tokens.color.base.goldDim,
  },
  chipText: {
    color: tokens.color.base.paper,
    fontSize: tokens.typography.size.small,
  },
  button: {
    backgroundColor: tokens.color.base.gold,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    alignItems: "center",
    justifyContent: "center",
    minHeight: tokens.spacing.tapMin,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  ghostButton: {
    paddingVertical: tokens.spacing[3],
    alignItems: "center",
  },
  ghostButtonText: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.body,
  },
  quoteLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing[2],
    borderBottomWidth: tokens.border.width,
    borderBottomColor: tokens.color.base.line,
  },
  quoteLineLabel: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.body,
  },
  quoteLineAmount: {
    color: tokens.color.base.paper,
    fontSize: tokens.typography.size.body,
  },
  quoteTotal: {
    color: tokens.color.base.goldHi,
    fontSize: tokens.typography.size.num,
    fontWeight: "800",
  },
  note: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.small,
    lineHeight: tokens.typography.size.small * tokens.typography.lineHeight.note,
  },
  error: {
    color: tokens.color.base.danger,
    fontSize: tokens.typography.size.small,
  },
  reviewPill: {
    color: tokens.color.status.review,
    fontSize: tokens.typography.size.title,
    fontWeight: "700",
  },
});
