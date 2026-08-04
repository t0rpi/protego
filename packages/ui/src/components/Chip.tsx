import { Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "../tokens";

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

/** design/HANDOFF.md §3 Chip — default/selected(gold border+fill)/disabled. */
export function Chip({ label, selected, disabled, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      style={[styles.chip, selected ? styles.chipSelected : null, disabled ? styles.chipDisabled : null]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.border.width,
    borderColor: tokens.color.semantic.border,
    paddingHorizontal: tokens.spacing[4],
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    borderColor: tokens.color.base.gold,
    backgroundColor: tokens.color.base.goldDim,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  label: {
    color: tokens.color.semantic.textSecondary,
    fontSize: tokens.typography.size.small,
    fontWeight: "600",
  },
  labelSelected: {
    color: tokens.color.base.gold,
  },
});
