import "../lib/i18n";
import { Stack } from "expo-router";
import { AuthProvider } from "../lib/auth-context";

/**
 * Root layout. M1 adds i18n init + auth session context, both consumed by
 * the (auth) screens. Font loading (Cinzel/Manrope) and the component
 * library land later, alongside packages/ui's real components (see
 * design/HANDOFF.md §3) — not needed yet for functional auth screens.
 *
 * Deliberately NOT wrapped in <StripeProvider> here (M7 change — it was
 * here from M5 through M6): @stripe/stripe-react-native is a native
 * module (see app.json's plugins), which plain Expo Go cannot load at
 * all. Mounting StripeProvider unconditionally at the root meant the
 * entire app failed to boot in Expo Go. It's now mounted locally, only
 * where actually needed (lib/payment-step.tsx, lib/overage-button.tsx),
 * so every other screen stays Expo-Go-testable; only those two specific
 * payment actions require an EAS dev-client build.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
