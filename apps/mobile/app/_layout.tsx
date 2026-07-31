import "../lib/i18n";
import { Stack } from "expo-router";
import { StripeProvider } from "@stripe/stripe-react-native";
import { AuthProvider } from "../lib/auth-context";

/**
 * Root layout. M1 adds i18n init + auth session context, both consumed by
 * the (auth) screens. Font loading (Cinzel/Manrope) and the component
 * library land later, alongside packages/ui's real components (see
 * design/HANDOFF.md §3) — not needed yet for functional auth screens.
 * M5 adds StripeProvider (test mode only, publishable key is not secret).
 */
export default function RootLayout() {
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </StripeProvider>
  );
}
