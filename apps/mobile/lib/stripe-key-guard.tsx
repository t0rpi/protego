import { Component, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { bookingStyles as s } from "./booking-styles";

/**
 * M7 QA fix — root cause of a real crash the founder hit: this build's
 * apps/mobile/.env.local was missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
 * entirely (present in .env.example, but never re-added after an
 * earlier env-var mixup was fixed by hand). PaymentStep/OverageButton
 * mounted <StripeProvider publishableKey=""> and calling
 * presentPaymentSheet() against an empty key crashed the native
 * Android Stripe SDK hard enough to kill the whole app (not a
 * JS-catchable error — matches "black then white screen, full reset").
 * Guarding here means a missing/misconfigured key can never reach the
 * native module at all, regardless of the exact failure mode.
 */
export function hasStripePublishableKey(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export function StripeKeyMissing() {
  return <Text style={s.error}>Plățile nu sunt configurate pe acest build (cheie Stripe lipsă).</Text>;
}

/**
 * Founder QA (2026-08-07): the missing-key comment above already
 * documents this happened once before ("never re-added after an
 * earlier env-var mixup") — it silently stayed missing from
 * apps/mobile/.env.local for days, only ever surfacing once someone
 * actually reached a payment screen (PaymentStep/OverageButton, both
 * dev-build-only). That's a "fails softly, deep in a flow" design,
 * exactly what the founder asked to stop: a missing key must fail
 * loudly at boot instead, on every screen, not just the payment ones.
 * __DEV__-only — this is a local build-config problem, never a real
 * production scenario.
 */
export function StripeKeyBootWarning() {
  if (!__DEV__ || hasStripePublishableKey()) return null;
  return (
    <View style={bootStyles.banner} pointerEvents="none">
      <Text style={bootStyles.text}>⚠ CHEIE STRIPE LIPSĂ — plățile vor eșua (EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY)</Text>
    </View>
  );
}

const bootStyles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#E5484D",
    paddingTop: 44,
    paddingBottom: 6,
    paddingHorizontal: 12,
    zIndex: 999,
  },
  text: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
});

interface PaymentErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches any JS-level exception in the payment subtree (Stripe SDK
 * calls, network errors, etc.) so a payment failure shows an inline
 * error instead of taking down the app — the founder's explicit
 * requirement. This cannot catch a genuine native-process crash (no JS
 * error boundary can), only JS exceptions; hasStripePublishableKey()
 * above is what prevents the specific native crash already found.
 */
export class PaymentErrorBoundary extends Component<{ children: ReactNode }, PaymentErrorBoundaryState> {
  state: PaymentErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PaymentErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <Text style={s.error}>A apărut o eroare la plată. Încearcă din nou.</Text>;
    }
    return this.props.children;
  }
}
