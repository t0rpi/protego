import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { computeSegmentQuote, isWeekendPricingWindow, type PricingConfig } from "@protego/domain";
import { supabase } from "./supabase";
import { createSegmentPayment } from "./payments";
import { computeRouteDistanceKm, type PlacePrediction } from "./places";
import { PlaceAutocompleteInput } from "./place-autocomplete-input";
import { bookingStyles as s } from "./booking-styles";
import { hasStripePublishableKey, PaymentErrorBoundary, StripeKeyMissing } from "./stripe-key-guard";

type SegmentPricing = Pick<
  PricingConfig,
  "waitFreeMinutes" | "waitPerMinuteRate" | "perKm" | "coefNight" | "coefWeekend" | "coefUrgent" | "coefCap" | "vatRate"
>;

/**
 * Chained rides (founder-approved, 2026-08-04): "Continua spre alta
 * adresa" — only offered on an active Protect Ride mission booked with
 * the wait-at-destination add-on (server-enforced too, in
 * request_mission_segment()). Same self-contained Stripe-mounts-only-
 * when-rendered reasoning as OverageButton — this button doesn't render
 * at all unless the precondition holds, so the rest of the mission
 * screen never pays the Stripe native-module cost for it.
 */
export function ContinueRideButton({
  missionId,
  city,
  currentDestinationAddress,
  waitAtDestinationMinutes,
  onError,
  onContinued,
}: {
  missionId: string;
  city: string;
  currentDestinationAddress: string | null;
  waitAtDestinationMinutes: number;
  onError: (message: string) => void;
  onContinued: () => void;
}) {
  if (!hasStripePublishableKey()) {
    return <StripeKeyMissing />;
  }

  return (
    <PaymentErrorBoundary>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}>
        <ContinueRideButtonInner
          missionId={missionId}
          city={city}
          currentDestinationAddress={currentDestinationAddress}
          waitAtDestinationMinutes={waitAtDestinationMinutes}
          onError={onError}
          onContinued={onContinued}
        />
      </StripeProvider>
    </PaymentErrorBoundary>
  );
}

function ContinueRideButtonInner({
  missionId,
  city,
  currentDestinationAddress,
  waitAtDestinationMinutes,
  onError,
  onContinued,
}: {
  missionId: string;
  city: string;
  currentDestinationAddress: string | null;
  waitAtDestinationMinutes: number;
  onError: (message: string) => void;
  onContinued: () => void;
}) {
  const { t } = useTranslation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [expanded, setExpanded] = useState(false);
  const [pricing, setPricing] = useState<SegmentPricing | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [consumedMinutes, setConsumedMinutes] = useState(waitAtDestinationMinutes);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!expanded || pricing) return;
    // Read-only preview rates, same "never the authoritative charge"
    // contract as the booking wizard's pricing_config fetch — the real
    // amount always comes back from request_mission_segment() server-side.
    (async () => {
      const { data: svc } = await supabase.from("services").select("id").eq("key", "protect_ride").single();
      if (!svc) return;
      const { data } = await supabase
        .from("pricing_config")
        .select("wait_free_minutes, wait_per_minute_rate, per_km, coef_night, coef_weekend, coef_urgent, coef_cap, vat_rate")
        .eq("service_id", svc.id)
        .eq("city", city)
        .single();
      if (!data) return;
      setPricing({
        waitFreeMinutes: data.wait_free_minutes,
        waitPerMinuteRate: data.wait_per_minute_rate,
        perKm: data.per_km,
        coefNight: data.coef_night,
        coefWeekend: data.coef_weekend,
        coefUrgent: data.coef_urgent,
        coefCap: data.coef_cap,
        vatRate: data.vat_rate,
      });
    })();
  }, [expanded, pricing, city]);

  useEffect(() => {
    if (!newPlaceId && newAddress.trim().length < 5) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setDistanceLoading(true);
      computeRouteDistanceKm({
        originAddress: currentDestinationAddress ?? undefined,
        destinationPlaceId: newPlaceId,
        destinationAddress: newAddress,
      })
        .then((km) => {
          if (!cancelled) setDistanceKm(km);
        })
        .catch(() => {
          if (!cancelled) setDistanceKm(null);
        })
        .finally(() => {
          if (!cancelled) setDistanceLoading(false);
        });
    }, newPlaceId ? 0 : 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newPlaceId, newAddress, currentDestinationAddress]);

  const now = new Date();
  const preview =
    pricing && distanceKm !== null
      ? computeSegmentQuote(
          {
            consumedWaitMinutes: consumedMinutes,
            newKm: distanceKm,
            isNight: now.getHours() >= 22 || now.getHours() < 6,
            isWeekend: isWeekendPricingWindow(now),
          },
          pricing
        )
      : null;

  const canConfirm = Boolean(newPlaceId) && distanceKm !== null && !busy;

  async function confirmAndPay() {
    if (!newPlaceId || distanceKm === null) return;
    setBusy(true);
    try {
      const { client_secret } = await createSegmentPayment(missionId, newAddress, distanceKm, consumedMinutes);
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
        setBusy(false);
        return;
      }
      setExpanded(false);
      setNewAddress("");
      setNewPlaceId(null);
      setDistanceKm(null);
      onContinued();
    } catch (continueError) {
      onError(continueError instanceof Error ? continueError.message : "eroare la continuarea cursei");
    }
    setBusy(false);
  }

  if (!expanded) {
    return (
      <Pressable style={s.ghostButton} onPress={() => setExpanded(true)}>
        <Text style={s.ghostButtonText}>{t("tracking.continueRide")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{t("tracking.continueRideTitle")}</Text>
      <PlaceAutocompleteInput
        value={newAddress}
        isConfirmed={Boolean(newPlaceId)}
        onChangeText={(text) => {
          setNewAddress(text);
          setNewPlaceId(null);
          setDistanceKm(null);
        }}
        onSelect={(prediction: PlacePrediction) => {
          setNewAddress(prediction.description);
          setNewPlaceId(prediction.place_id);
        }}
      />
      {distanceLoading ? <Text style={s.note}>{t("booking.distanceCalculating")}</Text> : null}

      <Text style={s.label}>{t("tracking.consumedWaitMinutes")}</Text>
      <View style={s.row}>
        <Pressable style={s.chip} onPress={() => setConsumedMinutes((m) => Math.max(0, m - 5))}>
          <Text style={s.chipText}>-</Text>
        </Pressable>
        <Text style={s.chipText}>{consumedMinutes} min</Text>
        <Pressable style={s.chip} onPress={() => setConsumedMinutes((m) => m + 5)}>
          <Text style={s.chipText}>+</Text>
        </Pressable>
      </View>

      {preview ? (
        <>
          {preview.lines.map((line, index) => (
            <View style={s.quoteLine} key={`${line.label}-${index}`}>
              <Text style={s.quoteLineLabel}>{t(`quote.line${line.label === "wait_at_destination" ? "Wait" : line.label === "distance" ? "Distance" : "Vat"}` as "quote.lineWait")}</Text>
              <Text style={s.quoteLineAmount}>{line.amount} lei</Text>
            </View>
          ))}
          <Text style={s.quoteTotal}>{preview.total} lei</Text>
        </>
      ) : null}

      <View style={s.row}>
        <Pressable style={s.ghostButton} onPress={() => setExpanded(false)} disabled={busy}>
          <Text style={s.ghostButtonText}>{t("common.cancel")}</Text>
        </Pressable>
        <Pressable style={[s.button, !canConfirm && s.buttonDisabled]} onPress={confirmAndPay} disabled={!canConfirm}>
          <Text style={s.buttonText}>{t("tracking.continueAndPay")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
