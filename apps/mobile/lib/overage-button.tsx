import { useState } from "react";
import { Pressable, Text } from "react-native";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { createOveragePayment } from "./payments";
import { bookingStyles as s } from "./booking-styles";

/**
 * Self-contained, same reasoning as lib/payment-step.tsx: `useStripe()`
 * and `<StripeProvider>` only mount when this specific button renders
 * (mission.status === "active"), keeping the rest of the mission
 * tracking screen (map, chat, SOS, cancel, receipt) free of the Stripe
 * native module — that's what lets Expo Go load and use all of those
 * without an EAS dev-client build.
 */
export function OverageButton({
  missionId,
  hours,
  label,
  onError,
}: {
  missionId: string;
  hours: number;
  label: string;
  onError: (message: string) => void;
}) {
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}>
      <OverageButtonInner missionId={missionId} hours={hours} label={label} onError={onError} />
    </StripeProvider>
  );
}

function OverageButtonInner({
  missionId,
  hours,
  label,
  onError,
}: {
  missionId: string;
  hours: number;
  label: string;
  onError: (message: string) => void;
}) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);

  /** audit §4.4 — a new PaymentIntent, confirmed the same way as the
   * original booking payment; never applied without this explicit step. */
  async function requestOverage() {
    setBusy(true);
    try {
      const { client_secret } = await createOveragePayment(missionId, hours);
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "PROTEGO",
        paymentIntentClientSecret: client_secret,
      });
      if (initError) {
        onError(initError.message);
        setBusy(false);
        return;
      }
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        onError(presentError.message);
      }
    } catch (overageError) {
      onError(overageError instanceof Error ? overageError.message : "eroare la prelungire");
    }
    setBusy(false);
  }

  return (
    <Pressable style={[s.ghostButton, busy && s.buttonDisabled]} onPress={requestOverage} disabled={busy}>
      <Text style={s.ghostButtonText}>{label}</Text>
    </Pressable>
  );
}
