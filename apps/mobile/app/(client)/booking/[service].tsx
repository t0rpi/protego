import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Database } from "@protego/supabase";
import { Button, Map, QuoteBox, tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { bookingStyles as s } from "../../../lib/booking-styles";
import { PaymentStep } from "../../../lib/payment-step";
import { PlaceAutocompleteInput } from "../../../lib/place-autocomplete-input";
import { computeRoute, type PlacePrediction } from "../../../lib/places";
import { getCurrentPickupLocation, promptEnableLocation } from "../../../lib/gps-location";

type ServiceKey = "protect_ride" | "escort" | "hourly";
type Mobility = Database["public"]["Enums"]["mission_mobility"];
type DressCode = Database["public"]["Enums"]["mission_dress_code"];
type ContextKind = Database["public"]["Enums"]["mission_context_kind"];

type Step = "where" | "when" | "who" | "team" | "mobility" | "context" | "quote" | "payment" | "result";
type WhenChoice = "now" | "in30" | "schedule";

interface QuoteLine {
  label: string;
  amount: number;
}

const MIN_DURATION: Record<ServiceKey, number> = {
  protect_ride: 1,
  escort: 1,
  hourly: 2,
};

const QUOTE_LINE_KEYS: Record<string, string> = {
  base: "quote.lineBase",
  distance: "quote.lineDistance",
  distance_estimated: "quote.lineDistanceEstimated",
  minimum_adjustment: "quote.lineMinimumAdjustment",
  agent: "quote.lineAgent",
  vehicle: "quote.lineVehicle",
  client_vehicle: "quote.lineClientVeh",
  platform_fee: "quote.linePlatform",
  vat: "quote.lineVat",
  overage: "quote.lineOverage",
  door_to_door_included: "quote.lineDoorToDoor",
  wait_at_destination: "quote.lineWait",
  accompany_inside: "quote.lineAccompany",
  vehicle_km_surcharge: "quote.lineVehicleKmSurcharge",
};

/**
 * compute_quote() returns raw internal labels (see supabase/migrations/
 * 20260803100003_compute_quote_last_mile.sql) — translates them to
 * user-facing copy, and appends the actual computed km for the two
 * distance labels (founder QA: the breakdown needs to visibly show the
 * km driving the price, not just an opaque amount).
 */
function formatQuoteLineLabel(
  label: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  distanceKm: string,
  agentCount: number,
  hours: number
): string {
  const key = QUOTE_LINE_KEYS[label];
  if (label === "agent") {
    return t(key, { agents: agentCount, hours });
  }
  const base = key ? t(key) : label;
  if ((label === "distance" || label === "distance_estimated") && distanceKm) {
    return `${base} ${t("quote.distanceKmSuffix", { km: distanceKm })}`;
  }
  return base;
}

/**
 * The MVP paid-service booking flow (MASTERPROMPT §5A's 10 steps,
 * collapsed into one wizard screen rather than 8 separate routes — a
 * deliberate M2 scope simplification; the HANDOFF component library
 * this would eventually use doesn't exist yet either, see auth-styles.ts).
 * Payment is a stub (records intent only — real Stripe is M5). A
 * high-risk answer never surfaces as an error: it routes to the review
 * screen, which is exactly what business-rules.md §6 requires.
 */
export default function BookingWizardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { service } = useLocalSearchParams<{ service: string }>();
  const serviceKey = (["protect_ride", "escort", "hourly"] as const).includes(service as ServiceKey)
    ? (service as ServiceKey)
    : "hourly";

  const [step, setStep] = useState<Step>("where");
  const [missionId, setMissionId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Last-mile + vehicle-km pricing rates (2026-08-04 v2.4) — fetched once
  // the service row is known, so the wizard can show the client the real
  // configured rate ("25 lei / primele 15 min, apoi X lei/min") instead of
  // a hardcoded string. Never used for the actual charge — that's always
  // compute_quote() server-side (CLAUDE.md: "Prices come from DB config,
  // never constants").
  const [accompanyFee, setAccompanyFee] = useState<number | null>(null);
  const [accompanyIncludedMinutes, setAccompanyIncludedMinutes] = useState(15);
  const [accompanyHourlyThresholdMinutes, setAccompanyHourlyThresholdMinutes] = useState(45);
  const [waitFreeMinutes, setWaitFreeMinutes] = useState(5);
  const [waitPerMinuteRate, setWaitPerMinuteRate] = useState<number | null>(null);
  const [vehicleIncludedKmPerHour, setVehicleIncludedKmPerHour] = useState<number | null>(null);
  const [vehicleKmSurchargeRate, setVehicleKmSurchargeRate] = useState<number | null>(null);

  // step: where/when
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPlaceId, setPickupPlaceId] = useState<string | null>(null);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationPlaceId, setDestinationPlaceId] = useState<string | null>(null);
  const [durationHours, setDurationHours] = useState(MIN_DURATION[serviceKey]);
  // Auto-computed from pickup/destination place ids (route-distance Edge
  // Function) — M7 QA founder decision: a client can't know the real
  // route km, so this is never typed manually anymore. Stays empty if
  // either address wasn't picked from a suggestion or the lookup fails;
  // compute_quote()'s default_distance_km stays as the server-side
  // safety net for that case (20260731160002/160003).
  const [distanceKm, setDistanceKm] = useState("");
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  // Pass B (2026-08-07): the route-distance call already resolves real
  // origin/destination coordinates and a route polyline — kept here so
  // the "where" step can show a live Map preview as soon as both
  // addresses are confirmed, without a second network call.
  const [routePreview, setRoutePreview] = useState<{
    polyline: string | null;
    origin: { lat: number; lng: number } | null;
    destination: { lat: number; lng: number } | null;
  } | null>(null);

  // GPS auto-location for pickup (2026-08-04 founder decision) — runs
  // once per visit to the "where" step, only while the field is still
  // empty (never overwrites something the client already typed/edited).
  // The prefilled text is left unconfirmed (pickupPlaceId stays null),
  // so it goes through the exact same PlaceAutocompleteInput geocode-
  // confirmation banner a typed address would — never dispatched on as
  // raw coordinates.
  const [gpsStatus, setGpsStatus] = useState<"idle" | "services_disabled" | "permission_denied" | "unavailable" | "ok">(
    "idle"
  );

  // step: when — scheduled_at exists on missions since M2, but the
  // wizard never collected it (booking always defaulted to "now"); M3
  // adds this step. Deliberately a plain "YYYY-MM-DD HH:MM" text input
  // rather than a native date/time picker component — no date-picker
  // dependency exists in this Expo project yet, and adding one is a
  // bigger-than-necessary change for this milestone. Low-risk, disclosed
  // simplification; a native picker is a natural follow-up, not a fix.
  const [whenChoice, setWhenChoice] = useState<WhenChoice>("now");
  const [scheduleInput, setScheduleInput] = useState("");

  // step: who
  const [protectedPersons, setProtectedPersons] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // step: team
  const [agentCount, setAgentCount] = useState(1);
  const [dressCode, setDressCode] = useState<DressCode>("casual");

  // step: mobility — Protect Ride is Uber-style (always the Protego
  // vehicle, no client choice, founder decision); Escort/Hourly keep
  // all 3 options and the mobility step itself. No preselection for
  // Escort/Hourly (founder decision, 2026-08-03): mobility changes the
  // price, so the client must actively choose — "nothing ambiguous
  // advances", same principle as the mandatory address confirmation.
  const [mobility, setMobility] = useState<Mobility | null>(
    serviceKey === "protect_ride" ? "protego_vehicle" : null
  );
  const [vehicleConsent, setVehicleConsent] = useState(false);
  const [vehicleInsurance, setVehicleInsurance] = useState(false);
  const [vehicleSignature, setVehicleSignature] = useState(false);

  // step: mobility (protect_ride variant — last-mile add-ons, founder
  // decision: door-to-door is always included, wait/accompany are paid
  // opt-ins reflected as separate quote lines).
  const [waitAtDestination, setWaitAtDestination] = useState(false);
  const [waitMinutes, setWaitMinutes] = useState(10);
  const [accompanyInsideRequested, setAccompanyInsideRequested] = useState(false);
  // 2026-08-04 v2.4: flat fee now covers the first N minutes (config-driven,
  // default 15) before per-minute overage kicks in — replaces the old plain
  // boolean, mirrors the waitAtDestination/waitMinutes stepper pattern.
  const [accompanyMinutes, setAccompanyMinutes] = useState(15);

  // step: mobility (escort/hourly + protego_vehicle variant — optional
  // estimated-km input, 2026-08-04 v2.4: feeds the new vehicle-km-surcharge
  // line. Escort/Hourly never had a km concept before this; left blank, no
  // surcharge line appears (compute_quote only adds it when input.km is set).
  const [vehicleEstimatedKm, setVehicleEstimatedKm] = useState("");

  // step: context
  const [hasKnownThreat, setHasKnownThreat] = useState(false);
  const [contextKind, setContextKind] = useState<ContextKind>("usual");
  const [contextDetails, setContextDetails] = useState("");

  // step: quote/result
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<"normal" | "high" | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [reviewDeclined, setReviewDeclined] = useState(false);

  // Dispatcher-1 fix (2026-08-05): a high-risk mission sits on this
  // "result" screen in status 'review' until a dispatcher calls the
  // client and approves/declines from the console
  // (apps/web .../console-client.tsx confirmMission/declineMission).
  // That console action is a raw `missions.update()`, not a push — and
  // this screen previously had no way to notice the change short of the
  // client force-quitting and reopening the app. Poll the same way
  // lib/payment-step.tsx already does for the Stripe-webhook gap, just
  // over a longer window since a dispatcher callback can take minutes,
  // not seconds.
  useEffect(() => {
    if (step !== "result" || riskLevel !== "high" || !missionId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("missions").select("status").eq("id", missionId).single();
      if (data?.status === "confirmed") {
        clearInterval(interval);
        router.push(`/mission/${missionId}`);
      } else if (data?.status === "cancelled_dispatcher") {
        clearInterval(interval);
        setReviewDeclined(true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [step, riskLevel, missionId, router]);

  useEffect(() => {
    if (!session || missionId) return;
    let cancelled = false;
    (async () => {
      const { data: svc, error: svcError } = await supabase
        .from("services")
        .select("id")
        .eq("key", serviceKey)
        .single();
      if (svcError || !svc) {
        if (!cancelled) setError(svcError?.message ?? `unknown service ${serviceKey}`);
        return;
      }
      if (!cancelled) setServiceId(svc.id);
      const { data, error: insertError } = await supabase
        .from("missions")
        .insert({ client_id: session.user.id, service_id: svc.id, city: "Oradea" })
        .select("id")
        .single();
      if (insertError) {
        if (!cancelled) setError(insertError.message);
        return;
      }
      if (!cancelled) setMissionId(data.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, missionId, serviceKey]);

  const isRideForDistance = serviceKey === "protect_ride";
  useEffect(() => {
    if (!isRideForDistance) return;
    const hasPlaceIds = Boolean(pickupPlaceId && destinationPlaceId);
    const hasAddressText = pickupAddress.trim().length >= 5 && destinationAddress.trim().length >= 5;
    if (!hasPlaceIds && !hasAddressText) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the stale preview when an address is emptied/edited is intentional, not a synchronization smell
      setRoutePreview(null);
      return;
    }

    let cancelled = false;
    // A deliberate suggestion tap fires immediately; free-typed text
    // (never selected from the dropdown — the common case, founder QA
    // finding 2026-08-03) is debounced since it changes on every
    // keystroke. Without this fallback, distance never computed unless
    // both fields were tapped from the autocomplete list, so the quote
    // silently used the same default estimate regardless of address.
    const delay = hasPlaceIds ? 0 : 600;
    const timer = setTimeout(() => {
      setDistanceLoading(true);
      setDistanceError(null);
      computeRoute({
        originPlaceId: pickupPlaceId,
        destinationPlaceId: destinationPlaceId,
        originAddress: pickupAddress,
        destinationAddress: destinationAddress,
      })
        .then((route) => {
          if (cancelled) return;
          setDistanceKm(String(route.distance_km));
          setRoutePreview({ polyline: route.polyline, origin: route.origin, destination: route.destination });
        })
        .catch((err) => {
          // Leave distanceKm empty on failure — compute_quote()'s
          // default_distance_km fallback covers this, per the founder's
          // explicit instruction that it stays only as a safety net.
          if (!cancelled) {
            setDistanceError(err instanceof Error ? err.message : "route lookup failed");
            setRoutePreview(null);
          }
        })
        .finally(() => {
          if (!cancelled) setDistanceLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRideForDistance, pickupPlaceId, destinationPlaceId, pickupAddress, destinationAddress]);

  useEffect(() => {
    if (step !== "where" || gpsStatus !== "idle" || pickupAddress || pickupPlaceId) return;
    let cancelled = false;
    getCurrentPickupLocation().then((result) => {
      if (cancelled) return;
      setGpsStatus(result.status);
      if (result.status === "ok") {
        setPickupAddress(result.formattedAddress);
        setPickupPlaceId(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, gpsStatus, pickupAddress, pickupPlaceId]);

  // Client-7 fix (2026-08-05): "GPS prefill only works once per session —
  // complete a booking, return to Home, enter another service, pickup no
  // longer auto-fills." gpsStatus flips away from "idle" the first time
  // the effect above resolves and never resets itself, so if this screen
  // is ever revisited for a fresh booking without a full unmount (Expo
  // Router dynamic routes can reuse the mounted [service] screen instance
  // across param changes), the guard silently skips forever after the
  // first visit. Re-arm it on every focus of the "where" step, as long as
  // the client hasn't already typed/picked their own address — same
  // never-overwrite invariant as the effect above.
  //
  // F6 fix (2026-08-07, audit-findings.md): the callback below used to
  // list pickupAddress/pickupPlaceId in its own dependency array, which
  // meant useFocusEffect re-ran it on every keystroke, not just on a
  // real focus/blur transition — a client backspacing the pickup field
  // to empty (meaning to type a different address) would re-trigger
  // this mid-edit, silently refilling the field with a GPS position a
  // moment later. Reading the live values via refs keeps the memoized
  // callback's identity stable across renders (deps: only `step`), so
  // React Navigation only invokes it on genuine focus events or an
  // actual step change — never on a keystroke.
  const pickupAddressRef = useRef(pickupAddress);
  const pickupPlaceIdRef = useRef(pickupPlaceId);
  useEffect(() => {
    pickupAddressRef.current = pickupAddress;
  }, [pickupAddress]);
  useEffect(() => {
    pickupPlaceIdRef.current = pickupPlaceId;
  }, [pickupPlaceId]);

  useFocusEffect(
    useCallback(() => {
      if (step === "where" && !pickupAddressRef.current && !pickupPlaceIdRef.current) {
        setGpsStatus("idle");
      }
    }, [step])
  );

  // Client-6 fix (2026-08-05): "when location is OFF, the address field
  // just says location is disabled — instead, tapping the field should
  // PROMPT to enable GPS". Fires on focus, never blocks typing — after
  // the prompt (or if the client dismisses it), gpsStatus resets to
  // "idle" so the existing prefill effect gets one more real attempt.
  function handlePickupFocus() {
    if (pickupAddress || pickupPlaceId) return;
    if (gpsStatus !== "services_disabled" && gpsStatus !== "permission_denied") return;
    promptEnableLocation().then(() => setGpsStatus("idle"));
  }

  useEffect(() => {
    if (!session) return;
    supabase
      .from("protected_persons")
      .select("id, full_name")
      .eq("owner_id", session.user.id)
      .then(({ data }) => setProtectedPersons(data ?? []));
  }, [session]);

  // 2026-08-04 v2.4 — read-only preview of the configured rates so the
  // selection screens can show real numbers ("25 lei / primele 15 min,
  // apoi X lei/min") before the client ever reaches the quote step. The
  // actual charge always comes from compute_quote() server-side; this
  // fetch never feeds into the price itself.
  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    supabase
      .from("pricing_config")
      .select(
        "accompany_inside_fee, accompany_inside_included_minutes, accompany_inside_hourly_threshold_minutes, wait_free_minutes, wait_per_minute_rate, vehicle_included_km_per_hour, vehicle_km_surcharge_rate"
      )
      .eq("service_id", serviceId)
      .eq("city", "Oradea")
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setAccompanyFee(data.accompany_inside_fee);
        setAccompanyIncludedMinutes(data.accompany_inside_included_minutes);
        setAccompanyHourlyThresholdMinutes(data.accompany_inside_hourly_threshold_minutes);
        setWaitFreeMinutes(data.wait_free_minutes);
        setWaitPerMinuteRate(data.wait_per_minute_rate);
        setVehicleIncludedKmPerHour(data.vehicle_included_km_per_hour);
        setVehicleKmSurchargeRate(data.vehicle_km_surcharge_rate);
        setAccompanyMinutes(data.accompany_inside_included_minutes);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const isRide = serviceKey === "protect_ride";

  // Founder + coordinator decision (2026-08-03): address confirmation is
  // mandatory, not just available — a real agent gets dispatched to
  // whatever ends up stored on the mission, so raw unconfirmed text
  // ("nothing ambiguous advances") must never proceed past this step.
  const canContinueWhere = Boolean(pickupPlaceId) && (!isRide || Boolean(destinationPlaceId));

  // Same "nothing ambiguous advances" principle: Escort/Hourly must
  // actively choose a mobility option (no preselection — it changes the
  // price, founder decision 2026-08-03), and a client_vehicle mission
  // additionally cannot proceed without all 3 legal/safety conditions
  // checked (consent, insurance, signature).
  const canContinueMobility =
    mobility !== null && (mobility !== "client_vehicle" || (vehicleConsent && vehicleInsurance && vehicleSignature));

  /** null = "acum" (missions.scheduled_at's own convention — see that column's comment). */
  function resolveScheduledAt(): { value: string | null; error: string | null } {
    if (whenChoice === "now") return { value: null, error: null };
    if (whenChoice === "in30") return { value: new Date(Date.now() + 30 * 60 * 1000).toISOString(), error: null };

    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(scheduleInput.trim());
    if (!match) return { value: null, error: t("booking.scheduleInvalid") };
    const [, year, month, day, hour, minute] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      return { value: null, error: t("booking.scheduleInvalid") };
    }
    return { value: parsed.toISOString(), error: null };
  }

  async function goToQuote() {
    if (!missionId) return;

    const { value: scheduledAt, error: scheduleError } = resolveScheduledAt();
    if (scheduleError) {
      setError(scheduleError);
      return;
    }

    setBusy(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("missions")
      .update({
        pickup_address: pickupAddress || null,
        destination_address: isRide ? destinationAddress || null : null,
        scheduled_at: scheduledAt,
        duration_hours: isRide ? null : durationHours,
        distance_km: isRide
          ? Number(distanceKm) || null
          : mobility === "protego_vehicle"
            ? Number(vehicleEstimatedKm) || null
            : null,
        protected_person_id: selectedPersonId,
        agent_count: agentCount,
        // F4 recalibrated (2026-08-07, audit-findings.md): founder
        // decision — remove the entire agent-preference selector from
        // the pilot UI (not just the "female" option, which was the
        // prior 2026-08-03 decision). The column/enum stay in the data
        // model; the client no longer picks — always "any" for now.
        agent_preference: "any",
        dress_code: dressCode,
        // canContinueMobility already guarantees mobility is set by the
        // time this runs; the fallback is unreachable defense in depth.
        mobility: mobility ?? "on_foot",
        context_threat_known: hasKnownThreat,
        context_kind: contextKind,
        context_details: contextDetails || null,
        wait_at_destination_minutes: isRide && waitAtDestination ? waitMinutes : null,
        accompany_inside_minutes: isRide && accompanyInsideRequested ? accompanyMinutes : null,
      })
      .eq("id", missionId);

    if (updateError) {
      setBusy(false);
      setError(updateError.message);
      return;
    }

    if (mobility === "client_vehicle") {
      const { error: checklistError } = await supabase.from("mission_vehicle_checklists").upsert({
        mission_id: missionId,
        consent_signed_at: vehicleConsent ? new Date().toISOString() : null,
        insurance_confirmed: vehicleInsurance,
        client_signature_at: vehicleSignature ? new Date().toISOString() : null,
      });
      if (checklistError) {
        setBusy(false);
        setError(checklistError.message);
        return;
      }
    }

    const { error: quotedError } = await supabase
      .from("missions")
      .update({ status: "quoted" })
      .eq("id", missionId);

    if (quotedError) {
      setBusy(false);
      setError(quotedError.message);
      return;
    }

    const { data: quoteId, error: rpcError } = await supabase.rpc("create_quote_for_mission", {
      p_mission_id: missionId,
    });

    if (rpcError || !quoteId) {
      setBusy(false);
      setError(rpcError?.message ?? "quote failed");
      return;
    }

    const [{ data: quote }, { data: mission }] = await Promise.all([
      supabase.from("quotes").select("breakdown, total_estimate").eq("id", quoteId).single(),
      supabase.from("missions").select("risk_level").eq("id", missionId).single(),
    ]);

    setQuoteLines((quote?.breakdown as unknown as QuoteLine[]) ?? []);
    setQuoteTotal(quote?.total_estimate ?? null);
    setRiskLevel((mission?.risk_level as "normal" | "high") ?? null);
    setBusy(false);
    setStep("quote");
  }

  async function proceedFromQuote() {
    if (!missionId) return;
    if (riskLevel === "high") {
      setBusy(true);
      const { error: reviewError } = await supabase
        .from("missions")
        .update({ status: "review" })
        .eq("id", missionId);
      setBusy(false);
      if (reviewError) {
        setError(reviewError.message);
        return;
      }
      setStep("result");
      return;
    }
    setStep("payment");
  }

  if (step === "result") {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          {riskLevel === "high" ? (
            reviewDeclined ? (
              <>
                <Text style={s.title}>{t("review.declinedTitle")}</Text>
                <Text style={s.intro}>{t("review.declinedBody")}</Text>
              </>
            ) : (
              <>
                <Text style={s.reviewPill}>{t("review.pill")}</Text>
                <Text style={s.title}>{t("review.headline")}</Text>
                <Text style={s.intro}>{t("review.body", { min: 15 })}</Text>
                <Text style={s.note}>{t("review.nothingCharged")}</Text>
                <ActivityIndicator color={tokens.color.base.gold} style={{ marginTop: 12 }} />
              </>
            )
          ) : (
            <>
              <Text style={s.title}>{t("pay.done")}</Text>
              {verificationCode ? (
                <Text style={s.quoteTotal}>{verificationCode}</Text>
              ) : null}
              <Text style={s.note}>{t("agentAssigned.codeHint")}</Text>
              {missionId ? (
                <Pressable style={s.button} onPress={() => router.push(`/mission/${missionId}`)}>
                  <Text style={s.buttonText}>{t("agentAssigned.track")}</Text>
                </Pressable>
              ) : null}
            </>
          )}
          <Pressable style={s.ghostButton} onPress={() => router.replace("/")}>
            <Text style={s.ghostButtonText}>{t("common.close")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.stepLabel}>{serviceKey}</Text>

        {step === "where" && (
          <>
            <Text style={s.title}>{t("booking.route")}</Text>
            <View>
              <Text style={s.label}>{t("booking.pickupPh")}</Text>
              <PlaceAutocompleteInput
                value={pickupAddress}
                isConfirmed={Boolean(pickupPlaceId)}
                onChangeText={(text) => {
                  setPickupAddress(text);
                  setPickupPlaceId(null);
                }}
                onSelect={(prediction: PlacePrediction) => {
                  setPickupAddress(prediction.description);
                  setPickupPlaceId(prediction.place_id);
                }}
                onFocus={handlePickupFocus}
              />
              {gpsStatus === "services_disabled" || gpsStatus === "permission_denied" ? (
                <Pressable onPress={handlePickupFocus}>
                  <Text style={[s.note, { textDecorationLine: "underline" }]}>
                    {t(gpsStatus === "services_disabled" ? "booking.locationDisabledHint" : "booking.locationPermissionHint")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {isRide ? (
              <>
                <View>
                  <Text style={s.label}>{t("booking.destPh")}</Text>
                  <PlaceAutocompleteInput
                    value={destinationAddress}
                    isConfirmed={Boolean(destinationPlaceId)}
                    onChangeText={(text) => {
                      setDestinationAddress(text);
                      setDestinationPlaceId(null);
                    }}
                    onSelect={(prediction: PlacePrediction) => {
                      setDestinationAddress(prediction.description);
                      setDestinationPlaceId(prediction.place_id);
                    }}
                  />
                </View>
                {distanceLoading ? (
                  <Text style={s.note}>{t("booking.distanceCalculating")}</Text>
                ) : distanceKm ? (
                  <Text style={s.note}>{t("booking.distanceComputed", { km: distanceKm })}</Text>
                ) : distanceError ? (
                  <Text style={s.note}>{t("booking.distanceUnavailable")}</Text>
                ) : null}
                {/* Pass B (2026-08-07): live route preview once both
                    addresses are confirmed — design/HANDOFF.md §6 Map slot. */}
                {routePreview?.origin && routePreview.destination ? (
                  <Map
                    height={180}
                    markers={[
                      { id: "origin", kind: "origin", lat: routePreview.origin.lat, lng: routePreview.origin.lng },
                      {
                        id: "destination",
                        kind: "destination",
                        lat: routePreview.destination.lat,
                        lng: routePreview.destination.lng,
                      },
                    ]}
                    encodedPolyline={routePreview.polyline}
                  />
                ) : null}
              </>
            ) : (
              <View>
                <Text style={s.label}>{t("booking.durationNote")}</Text>
                <View style={s.row}>
                  <Pressable
                    style={s.chip}
                    onPress={() => setDurationHours((h) => Math.max(MIN_DURATION[serviceKey], h - 1))}
                  >
                    <Text style={s.chipText}>-</Text>
                  </Pressable>
                  <Text style={s.chipText}>{durationHours}h</Text>
                  <Pressable style={s.chip} onPress={() => setDurationHours((h) => h + 1)}>
                    <Text style={s.chipText}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}
            <Text style={s.note}>{t("booking.zoneNote")}</Text>
            {!canContinueWhere ? <Text style={s.note}>{t("booking.confirmAddressesHint")}</Text> : null}
            <Pressable
              style={[s.button, !canContinueWhere && s.buttonDisabled]}
              onPress={() => setStep("when")}
              disabled={!canContinueWhere}
            >
              <Text style={s.buttonText}>{t("common.continue")}</Text>
            </Pressable>
          </>
        )}

        {step === "when" && (
          <>
            <Text style={s.title}>{t("booking.whenTitle")}</Text>
            <View style={s.row}>
              <Pressable
                style={[s.chip, whenChoice === "now" && s.chipSelected]}
                onPress={() => setWhenChoice("now")}
              >
                <Text style={s.chipText}>{t("booking.now")}</Text>
              </Pressable>
              <Pressable
                style={[s.chip, whenChoice === "in30" && s.chipSelected]}
                onPress={() => setWhenChoice("in30")}
              >
                <Text style={s.chipText}>{t("booking.in30")}</Text>
              </Pressable>
              <Pressable
                style={[s.chip, whenChoice === "schedule" && s.chipSelected]}
                onPress={() => setWhenChoice("schedule")}
              >
                <Text style={s.chipText}>{t("booking.schedule")}</Text>
              </Pressable>
            </View>
            {whenChoice === "schedule" ? (
              <View>
                <Text style={s.label}>{t("booking.schedulePh")}</Text>
                <TextInput
                  style={s.input}
                  placeholder="2026-08-15 18:30"
                  placeholderTextColor="#6B7178"
                  value={scheduleInput}
                  onChangeText={setScheduleInput}
                />
              </View>
            ) : null}

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable
              style={s.button}
              onPress={() => {
                const { error: scheduleError } = resolveScheduledAt();
                if (scheduleError) {
                  setError(scheduleError);
                  return;
                }
                setError(null);
                setStep("who");
              }}
            >
              <Text style={s.buttonText}>{t("common.continue")}</Text>
            </Pressable>
          </>
        )}

        {step === "who" && (
          <>
            <Text style={s.title}>{t("booking.whoTitle")}</Text>
            <Pressable
              style={[s.card, !selectedPersonId && s.cardSelected]}
              onPress={() => setSelectedPersonId(null)}
            >
              <Text style={s.cardTitle}>{t("booking.me", { name: "" })}</Text>
            </Pressable>
            {protectedPersons.map((person) => (
              <Pressable
                key={person.id}
                style={[s.card, selectedPersonId === person.id && s.cardSelected]}
                onPress={() => setSelectedPersonId(person.id)}
              >
                <Text style={s.cardTitle}>{person.full_name}</Text>
                <Text style={s.cardDesc}>{t("booking.savedPerson")}</Text>
              </Pressable>
            ))}
            <Pressable style={s.button} onPress={() => setStep("team")}>
              <Text style={s.buttonText}>{t("common.continue")}</Text>
            </Pressable>
          </>
        )}

        {step === "team" && (
          <>
            <Text style={s.title}>{t("booking.teamTitle")}</Text>
            <Text style={s.label}>{t("booking.agentCount")}</Text>
            <View style={s.row}>
              <Pressable style={s.chip} onPress={() => setAgentCount((n) => Math.max(1, n - 1))}>
                <Text style={s.chipText}>-</Text>
              </Pressable>
              <Text style={s.chipText}>{agentCount}</Text>
              <Pressable style={s.chip} onPress={() => setAgentCount((n) => n + 1)}>
                <Text style={s.chipText}>+</Text>
              </Pressable>
            </View>
            {/* F4 recalibrated (2026-08-07, audit-findings.md): founder
                decision — the entire agent-preference selector is
                removed from the pilot UI (this supersedes the prior
                2026-08-03 decision to remove only "female"). The
                column/enum stay in the data model; every mission is
                submitted with agent_preference: "any" (see goToQuote).
                Comes back as a real, client-facing selector with Drum
                Sigur in Wave 2. */}
            <Text style={s.label}>{t("booking.dress")}</Text>
            <View style={s.row}>
              {(["formal", "casual", "discreet"] as const).map((dress) => (
                <Pressable
                  key={dress}
                  style={[s.chip, dressCode === dress && s.chipSelected]}
                  onPress={() => setDressCode(dress)}
                >
                  <Text style={s.chipText}>
                    {dress === "formal"
                      ? t("booking.dressFormal")
                      : dress === "casual"
                        ? t("booking.dressCasual")
                        : t("booking.dressCivil")}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={s.button} onPress={() => setStep("mobility")}>
              <Text style={s.buttonText}>{t("common.continue")}</Text>
            </Pressable>
          </>
        )}

        {step === "mobility" && serviceKey === "protect_ride" && (
          <>
            <Text style={s.title}>{t("booking.lastMileTitle")}</Text>

            <View style={s.card}>
              <Text style={s.cardTitle}>{t("booking.doorToDoorTitle")}</Text>
              <Text style={s.cardDesc}>{t("booking.doorToDoorDesc")}</Text>
            </View>

            <Pressable
              style={[s.card, waitAtDestination && s.cardSelected]}
              onPress={() => setWaitAtDestination((v) => !v)}
            >
              <Text style={s.cardTitle}>
                {waitAtDestination ? "☑" : "☐"} {t("booking.waitTitle")}
              </Text>
              <Text style={s.cardDesc}>{t("booking.waitDesc")}</Text>
              {waitPerMinuteRate !== null ? (
                <Text style={s.cardDesc}>
                  {t("booking.waitRateNote", { included: waitFreeMinutes, rate: waitPerMinuteRate })}
                </Text>
              ) : null}
            </Pressable>
            {waitAtDestination ? (
              <View style={s.row}>
                <Pressable style={s.chip} onPress={() => setWaitMinutes((m) => Math.max(0, m - 5))}>
                  <Text style={s.chipText}>-</Text>
                </Pressable>
                <Text style={s.chipText}>{waitMinutes} min</Text>
                <Pressable style={s.chip} onPress={() => setWaitMinutes((m) => m + 5)}>
                  <Text style={s.chipText}>+</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              style={[s.card, accompanyInsideRequested && s.cardSelected]}
              onPress={() => setAccompanyInsideRequested((v) => !v)}
            >
              <Text style={s.cardTitle}>
                {accompanyInsideRequested ? "☑" : "☐"} {t("booking.accompanyTitle")}
              </Text>
              <Text style={s.cardDesc}>{t("booking.accompanyDesc")}</Text>
              {accompanyFee !== null ? (
                <Text style={s.cardDesc}>
                  {t("booking.accompanyRateNote", {
                    fee: accompanyFee,
                    included: accompanyIncludedMinutes,
                    rate: waitPerMinuteRate ?? 0,
                  })}
                </Text>
              ) : null}
            </Pressable>
            {accompanyInsideRequested ? (
              <>
                <View style={s.row}>
                  <Pressable
                    style={s.chip}
                    onPress={() => setAccompanyMinutes((m) => Math.max(5, m - 5))}
                  >
                    <Text style={s.chipText}>-</Text>
                  </Pressable>
                  <Text style={s.chipText}>{accompanyMinutes} min</Text>
                  <Pressable style={s.chip} onPress={() => setAccompanyMinutes((m) => m + 5)}>
                    <Text style={s.chipText}>+</Text>
                  </Pressable>
                </View>
                {accompanyMinutes >= accompanyHourlyThresholdMinutes ? (
                  <Text style={s.note}>
                    {t("booking.accompanyHourlySuggestion", { min: accompanyHourlyThresholdMinutes })}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Pressable style={s.button} onPress={() => setStep("context")}>
              <Text style={s.buttonText}>{t("common.continue")}</Text>
            </Pressable>
          </>
        )}

        {step === "mobility" && serviceKey !== "protect_ride" && (
          <>
            <Text style={s.title}>{t("booking.mobilityTitle")}</Text>
            <Pressable
              style={[s.card, mobility === "protego_vehicle" && s.cardSelected]}
              onPress={() => setMobility("protego_vehicle")}
            >
              <Text style={s.cardTitle}>{t("booking.vehProtego")}</Text>
              <Text style={s.cardDesc}>{t("booking.vehProtegoDesc")}</Text>
            </Pressable>

            {mobility === "protego_vehicle" && (
              <View>
                <Text style={s.label}>{t("booking.vehKmEstimateLabel")}</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor="#6B7178"
                  keyboardType="numeric"
                  value={vehicleEstimatedKm}
                  onChangeText={setVehicleEstimatedKm}
                />
                {vehicleIncludedKmPerHour !== null && vehicleKmSurchargeRate !== null ? (
                  <Text style={s.note}>
                    {t("booking.vehKmEstimateHint", {
                      included: vehicleIncludedKmPerHour,
                      rate: vehicleKmSurchargeRate,
                    })}
                  </Text>
                ) : null}
              </View>
            )}

            <Pressable
              style={[s.card, mobility === "client_vehicle" && s.cardSelected]}
              onPress={() => setMobility("client_vehicle")}
            >
              <Text style={s.cardTitle}>{t("booking.vehClient")}</Text>
              <Text style={s.cardDesc}>{t("booking.vehClientDesc")}</Text>
            </Pressable>
            <Pressable style={[s.card, mobility === "on_foot" && s.cardSelected]} onPress={() => setMobility("on_foot")}>
              <Text style={s.cardTitle}>{t("booking.onFoot")}</Text>
              <Text style={s.cardDesc}>{t("booking.onFootDesc")}</Text>
            </Pressable>

            {mobility === "client_vehicle" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>{t("booking.clientVehTitle")}</Text>
                <Text style={s.cardDesc}>{t("booking.clientVehRules")}</Text>
                <Pressable style={s.row} onPress={() => setVehicleConsent((v) => !v)}>
                  <Text style={s.chipText}>{vehicleConsent ? "☑" : "☐"} Consimțământ</Text>
                </Pressable>
                <Pressable style={s.row} onPress={() => setVehicleInsurance((v) => !v)}>
                  <Text style={s.chipText}>{vehicleInsurance ? "☑" : "☐"} Asigurare validă</Text>
                </Pressable>
                <Pressable style={s.row} onPress={() => setVehicleSignature((v) => !v)}>
                  <Text style={s.chipText}>{vehicleSignature ? "☑" : "☐"} Semnătură electronică</Text>
                </Pressable>
              </View>
            )}

            {mobility === null ? (
              <Text style={s.note}>{t("booking.chooseMobilityHint")}</Text>
            ) : mobility === "client_vehicle" && !canContinueMobility ? (
              <Text style={s.note}>{t("booking.confirmVehicleHint")}</Text>
            ) : null}
            <Pressable
              style={[s.button, !canContinueMobility && s.buttonDisabled]}
              onPress={() => setStep("context")}
              disabled={!canContinueMobility}
            >
              <Text style={s.buttonText}>{t("common.continue")}</Text>
            </Pressable>
          </>
        )}

        {step === "context" && (
          <>
            <Text style={s.title}>{t("booking.contextTitle")}</Text>
            <Text style={s.intro}>{t("booking.contextIntro")}</Text>
            <Text style={s.label}>{t("booking.threatQ")}</Text>
            <View style={s.row}>
              <Pressable
                style={[s.chip, !hasKnownThreat && s.chipSelected]}
                onPress={() => setHasKnownThreat(false)}
              >
                <Text style={s.chipText}>{t("booking.no")}</Text>
              </Pressable>
              <Pressable style={[s.chip, hasKnownThreat && s.chipSelected]} onPress={() => setHasKnownThreat(true)}>
                <Text style={s.chipText}>{t("booking.yes")}</Text>
              </Pressable>
            </View>
            <Text style={s.label}>{t("booking.kindQ")}</Text>
            <View style={s.row}>
              {(["usual", "stranger", "atm", "club"] as const).map((kind) => (
                <Pressable
                  key={kind}
                  style={[s.chip, contextKind === kind && s.chipSelected]}
                  onPress={() => setContextKind(kind)}
                >
                  <Text style={s.chipText}>
                    {kind === "usual"
                      ? t("booking.kindUsual")
                      : kind === "stranger"
                        ? t("booking.kindStranger")
                        : kind === "atm"
                          ? t("booking.kindAtm")
                          : t("booking.kindClub")}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={s.input}
              placeholder={t("booking.detailsPh")}
              placeholderTextColor="#6B7178"
              value={contextDetails}
              onChangeText={setContextDetails}
            />
            <Text style={s.note}>{t("booking.humanNote")}</Text>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={goToQuote} disabled={busy}>
              {busy ? <ActivityIndicator color="#161307" /> : <Text style={s.buttonText}>{t("booking.seeQuote")}</Text>}
            </Pressable>
          </>
        )}

        {step === "quote" && (
          <>
            <QuoteBox
              eyebrow={t("quote.title")}
              total={quoteTotal ?? 0}
              currency="RON"
              note={t("quote.estimateNote")}
              lines={quoteLines}
              formatLineLabel={(label) => formatQuoteLineLabel(label, t, distanceKm, agentCount, durationHours)}
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Button
              label={riskLevel === "high" ? t("common.continue") : t("quote.toPay")}
              loading={busy}
              onPress={proceedFromQuote}
            />
          </>
        )}

        {step === "payment" && missionId && (
          <PaymentStep
            missionId={missionId}
            onSuccess={(code) => {
              setVerificationCode(code);
              setStep("result");
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}
