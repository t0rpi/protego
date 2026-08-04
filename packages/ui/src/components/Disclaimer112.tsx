import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";

interface Disclaimer112Props {
  text: string;
  compact?: boolean;
}

/**
 * design/HANDOFF.md §1/§3 Disclaimer112 — "PROTEGO nu înlocuiește 112"
 * on EVERY surface with an SOS trigger (Shield tab, active-SOS screen,
 * mission map). Never omissible on those surfaces.
 */
export function Disclaimer112({ text, compact }: Disclaimer112Props) {
  return (
    <View style={[styles.container, compact ? styles.compact : null]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.base.dangerDim,
  },
  compact: {
    paddingVertical: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[2],
  },
  text: {
    color: tokens.color.base.danger,
    fontSize: tokens.typography.size.caption,
    fontWeight: "600",
    textAlign: "center",
  },
});
