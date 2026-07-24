import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@protego/ui";

/**
 * Agent app placeholder ("/agent"). M0 scope: empty screen only —
 * onboarding + documents, mission offers (45s), status flow etc. land
 * starting M3 (MASTERPROMPT §5B, docs/product/user-flows.md §3).
 */
export default function AgentHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>PROTEGO — agent (M0 placeholder)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.base.ink,
  },
  text: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
});
