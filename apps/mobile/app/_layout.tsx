import "../lib/i18n";
import { Stack } from "expo-router";
import { AuthProvider } from "../lib/auth-context";

/**
 * Root layout. M1 adds i18n init + auth session context, both consumed by
 * the (auth) screens. Font loading (Cinzel/Manrope) and the component
 * library land later, alongside packages/ui's real components (see
 * design/HANDOFF.md §3) — not needed yet for functional auth screens.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
