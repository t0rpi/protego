import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { supabase } from "./supabase";
import { authorizeMissionPayment } from "./payments";
import { bookingStyles as s } from "./booking-styles";
import { hasStripePublishableKey, PaymentErrorBoundary, StripeKeyMissing } from "./stripe-key-guard";

/**
 * Self-contained payment step, deliberately its own component (not
 * inline in the booking wizard) so `useStripe()` and `<StripeProvider>`
 * are only ever mounted when the user actually reaches this step — the
 * rest of the booking wizard (route/when/who/team/mobility/context/
 * quote) never touches the Stripe native module at all. This matters
 * because `@stripe/stripe-react-native` is a native module (see
 * app.json's plugins) that plain Expo Go cannot load; keeping every
 * other screen free of it means the whole app is Expo-Go-testable up
 * to this exact point, with only the real card-entry step needing an
 * EAS dev-client build.
 */
export function PaymentStep({
  missionId,
  onSuccess,
}: {
  missionId: string;
  onSuccess: (verificationCode: string | null) => void;
}) {
  if (!hasStripePublishableKey()) {
    return <StripeKeyMissing />;
  }

  return (
    <PaymentErrorBoundary>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}>
        <PaymentStepInner missionId={missionId} onSuccess={onSuccess} />
      </StripeProvider>
    </PaymentErrorBoundary>
  );
}

function PaymentStepInner({
  missionId,
  onSuccess,
}: {
  missionId: string;
  onSuccess: (verificationCode: string | null) => void;
}) {
  const { t } = useTranslation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Real Stripe manual-capture authorization (audit §4.1). The mission
   * does NOT become 'confirmed' here: that happens asynchronously once
   * Stripe's webhook tells our backend the authorization actually
   * succeeded (confirm_mission_after_payment(), supabase/migrations/
   * 20260731130003_payments.sql) — so this polls briefly afterward
   * rather than assuming success the instant presentPaymentSheet returns.
   */
  async function confirmPayment() {
    setBusy(true);
    setError(null);

    try {
      const { client_secret } = await authorizeMissionPayment(missionId);

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "PROTEGO",
        paymentIntentClientSecret: client_secret,
      });
      if (initError) {
        setBusy(false);
        setError(initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        setBusy(false);
        setError(presentError.message);
        return;
      }
    } catch (paymentError) {
      setBusy(false);
      setError(paymentError instanceof Error ? paymentError.message : "eroare la plată");
      return;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data: mission } = await supabase
        .from("missions")
        .select("status, verification_code")
        .eq("id", missionId)
        .single();
      if (mission?.status === "confirmed") {
        setBusy(false);
        onSuccess(mission.verification_code ?? null);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setBusy(false);
    setError(t("pay.processing"));
  }

  return (
    <>
      <Text style={s.title}>{t("pay.title")}</Text>
      <Text style={s.note}>{t("pay.cardMeta")}</Text>
      <Text style={s.note}>{t("pay.stripe")}</Text>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={confirmPayment} disabled={busy}>
        {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("pay.cta")}</Text>}
      </Pressable>
    </>
  );
}
