import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Database } from "@protego/supabase";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { bookingStyles as s } from "../../../lib/booking-styles";
import { PaymentStep } from "../../../lib/payment-step";

type ServiceKey = "protect_ride" | "escort" | "hourly";
type Mobility = Database["public"]["Enums"]["mission_mobility"];
type AgentPreference = Database["public"]["Enums"]["mission_agent_preference"];
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step: where/when
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [durationHours, setDurationHours] = useState(MIN_DURATION[serviceKey]);
  const [distanceKm, setDistanceKm] = useState("");

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
  const [agentPreference, setAgentPreference] = useState<AgentPreference>("any");
  const [dressCode, setDressCode] = useState<DressCode>("casual");

  // step: mobility
  const [mobility, setMobility] = useState<Mobility>("on_foot");
  const [vehicleConsent, setVehicleConsent] = useState(false);
  const [vehicleInsurance, setVehicleInsurance] = useState(false);
  const [vehicleSignature, setVehicleSignature] = useState(false);

  // step: context
  const [hasKnownThreat, setHasKnownThreat] = useState(false);
  const [contextKind, setContextKind] = useState<ContextKind>("usual");
  const [contextDetails, setContextDetails] = useState("");

  // step: quote/result
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<"normal" | "high" | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);

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

  useEffect(() => {
    if (!session) return;
    supabase
      .from("protected_persons")
      .select("id, full_name")
      .eq("owner_id", session.user.id)
      .then(({ data }) => setProtectedPersons(data ?? []));
  }, [session]);

  const isRide = serviceKey === "protect_ride";

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
        distance_km: isRide ? Number(distanceKm) || null : null,
        protected_person_id: selectedPersonId,
        agent_count: agentCount,
        agent_preference: agentPreference,
        dress_code: dressCode,
        mobility,
        context_threat_known: hasKnownThreat,
        context_kind: contextKind,
        context_details: contextDetails || null,
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
            <>
              <Text style={s.reviewPill}>{t("review.pill")}</Text>
              <Text style={s.title}>{t("review.headline")}</Text>
              <Text style={s.intro}>{t("review.body", { min: 15 })}</Text>
              <Text style={s.note}>{t("review.nothingCharged")}</Text>
            </>
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
              <TextInput style={s.input} value={pickupAddress} onChangeText={setPickupAddress} />
            </View>
            {isRide ? (
              <>
                <View>
                  <Text style={s.label}>{t("booking.destPh")}</Text>
                  <TextInput style={s.input} value={destinationAddress} onChangeText={setDestinationAddress} />
                </View>
                <View>
                  <Text style={s.label}>km</Text>
                  <TextInput
                    style={s.input}
                    value={distanceKm}
                    onChangeText={setDistanceKm}
                    keyboardType="numeric"
                  />
                </View>
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
            <Pressable style={s.button} onPress={() => setStep("when")}>
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
            <Text style={s.label}>{t("booking.preference")}</Text>
            <View style={s.row}>
              {(["any", "female", "male"] as const).map((pref) => (
                <Pressable
                  key={pref}
                  style={[s.chip, agentPreference === pref && s.chipSelected]}
                  onPress={() => setAgentPreference(pref)}
                >
                  <Text style={s.chipText}>{t(`booking.pref${pref === "any" ? "Any" : pref === "female" ? "Female" : "Male"}`)}</Text>
                </Pressable>
              ))}
            </View>
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

        {step === "mobility" && (
          <>
            <Text style={s.title}>{t("booking.mobilityTitle")}</Text>
            <Pressable
              style={[s.card, mobility === "protego_vehicle" && s.cardSelected]}
              onPress={() => setMobility("protego_vehicle")}
            >
              <Text style={s.cardTitle}>{t("booking.vehProtego")}</Text>
              <Text style={s.cardDesc}>{t("booking.vehProtegoDesc")}</Text>
            </Pressable>
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

            <Pressable style={s.button} onPress={() => setStep("context")}>
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
            <Text style={s.title}>{t("quote.title")}</Text>
            <Text style={s.note}>{t("quote.estimateNote")}</Text>
            {quoteLines.map((line, index) => (
              <View style={s.quoteLine} key={`${line.label}-${index}`}>
                <Text style={s.quoteLineLabel}>{line.label}</Text>
                <Text style={s.quoteLineAmount}>{line.amount} lei</Text>
              </View>
            ))}
            <Text style={s.quoteTotal}>{quoteTotal} lei</Text>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={proceedFromQuote} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#161307" />
              ) : (
                <Text style={s.buttonText}>
                  {riskLevel === "high" ? t("common.continue") : t("quote.toPay")}
                </Text>
              )}
            </Pressable>
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
