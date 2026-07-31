import { Component, type ReactNode } from "react";
import { Text } from "react-native";
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
