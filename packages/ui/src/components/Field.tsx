import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { tokens } from "../tokens";

interface FieldProps extends TextInputProps {
  dot?: "gold" | "dim";
  error?: string;
  label?: string;
}

/**
 * design/HANDOFF.md §3 Field — states default/focus(border gold)/
 * error(border+message). `dot` = route origin/destination marker
 * (gold = confirmed, dim = pending), same convention as the booking
 * wizard's pickup/destination inputs.
 */
export function Field({ dot, error, label, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        {dot ? <View style={[styles.dot, { backgroundColor: dot === "gold" ? tokens.color.base.gold : tokens.color.semantic.textTertiary }]} /> : null}
        <TextInput
          placeholderTextColor={tokens.color.semantic.textTertiary}
          style={[styles.input, style]}
          {...inputProps}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing[1],
  },
  label: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.caption,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing[2],
    borderWidth: tokens.border.width,
    borderColor: tokens.color.semantic.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing[3],
    minHeight: tokens.spacing.tapMin,
  },
  inputRowError: {
    borderColor: tokens.color.base.danger,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  input: {
    flex: 1,
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
  },
  error: {
    color: tokens.color.base.danger,
    fontSize: tokens.typography.size.caption,
  },
});
