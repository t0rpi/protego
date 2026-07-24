import { StyleSheet } from "react-native";
import { tokens } from "@protego/ui";

/**
 * Shared styling for the (auth) screens, built directly from tokens.
 * Not the polished HANDOFF component library (Button/Field/etc. — see
 * design/HANDOFF.md §3) — that lands with packages/ui's component work.
 * This is enough to make the auth flow usable and on-brand for M1.
 */
export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.base.ink,
    padding: tokens.spacing[6],
    justifyContent: "center",
    gap: tokens.spacing[4],
  },
  title: {
    color: tokens.color.base.paper,
    fontSize: tokens.typography.size.h1,
    fontWeight: String(tokens.typography.weight.bold) as "700",
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
  button: {
    backgroundColor: tokens.color.base.gold,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    alignItems: "center",
    minHeight: tokens.spacing.tapMin,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: String(tokens.typography.weight.semibold) as "600",
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
  linkRow: {
    alignItems: "center",
    marginTop: tokens.spacing[2],
  },
  linkText: {
    color: tokens.color.base.gold,
    fontSize: tokens.typography.size.body,
  },
});
