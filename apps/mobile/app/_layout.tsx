import "../lib/i18n";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { tokens } from "@protego/ui";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { StripeKeyBootWarning } from "../lib/stripe-key-guard";

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
      <View style={{ flex: 1 }}>
        <RootNavigator />
        {/* Founder QA (2026-08-07): a missing Stripe key must fail loudly
            at boot, on every screen — not silently until someone happens
            to reach a payment step. __DEV__-only, see stripe-key-guard.tsx. */}
        <StripeKeyBootWarning />
      </View>
    </AuthProvider>
  );
}

/**
 * Auth gate (2026-08-05 fix — logout crash, "child already has a parent").
 * Previously each authenticated screen (e.g. the Home tab) did its own
 * `if (!session) return <Redirect href="/login" />` check. That's exactly
 * the pattern Expo Router's own docs warn about: Tab navigators keep
 * every tab screen mounted in the background (not just the focused one),
 * so when `session` flips to null on sign-out, Home's background-mounted
 * Redirect fires a router.replace() at the same moment React Navigation
 * is already mid-transition from the sign-out button press — two
 * competing native view-tree mutations in the same tick, which is what
 * produced the native "child already has a parent" crash.
 *
 * `Stack.Protected` is Expo Router's own answer to this: only one guarded
 * group is ever mounted at a time, and it owns the mount/unmount itself
 * instead of leaving it to redirects scattered across leaf screens. This
 * is the ONLY place session gating happens now — do not add another
 * `<Redirect>` for "not logged in" anywhere else in the tree.
 */
function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.color.semantic.surfaceApp,
        }}
      >
        <ActivityIndicator color={tokens.color.base.gold} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(agent)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
