import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@protego/ui";

/**
 * Client app placeholder ("/"). M0 scope: empty screen only — Shield tab,
 * booking flow (10 steps), mission tracking etc. land starting M2/M6
 * (MASTERPROMPT §5A, design/HANDOFF.md).
 */
export default function ClientHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>PROTEGO — client (M0 placeholder)</Text>
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
