import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";

export interface TabBarItem {
  key: string;
  label: string;
  focused: boolean;
  onPress: () => void;
}

/**
 * design/HANDOFF.md §3 TabBar + §8.2 deviation from the prototype: no
 * unicode glyphs (◆ ≡ ●) — real iconography belongs here once Lucide is
 * wired in (a later pass; see that migration's own build notes). Tab
 * active = gold, per §3's one-line spec. 4 tabs incl. Shield as a
 * permanent tab (PRD §3 requirement, missing from the original
 * prototype — §8.2 point 2).
 */
export function TabBar({ items }: { items: TabBarItem[] }) {
  return (
    <View style={styles.bar}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.focused }}
          onPress={item.onPress}
          style={styles.tab}
        >
          <View style={[styles.dot, item.focused ? styles.dotFocused : null]} />
          <Text style={[styles.label, item.focused ? styles.labelFocused : null]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: tokens.color.semantic.surfaceCard,
    borderTopWidth: tokens.border.width,
    borderTopColor: tokens.color.semantic.border,
    paddingTop: tokens.spacing[2],
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing[1],
    paddingBottom: tokens.spacing[2],
    minHeight: tokens.spacing.tapMin,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
  },
  dotFocused: {
    backgroundColor: tokens.color.base.gold,
  },
  label: {
    color: tokens.color.semantic.textTertiary,
    fontSize: tokens.typography.size.micro,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  labelFocused: {
    color: tokens.color.base.gold,
  },
});
