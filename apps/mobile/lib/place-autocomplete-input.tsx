import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { autocompletePlaces, geocodeAddress, type GeocodeResult, type PlacePrediction } from "./places";
import { bookingStyles as s } from "./booking-styles";

function randomSessionToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface PlaceAutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (prediction: PlacePrediction) => void;
  /** Whether `value` already came from a confirmed selection (dropdown
   * tap or a previously-confirmed geocode) — while true, the geocode
   * confirmation banner stays hidden. */
  isConfirmed: boolean;
  placeholder?: string;
  /** Client-6: lets a caller intercept focus to prompt for a disabled
   * GPS/permission state before the keyboard comes up — never blocks
   * typing, just fires alongside the normal focus behavior. */
  onFocus?: () => void;
}

/**
 * Address input backed by Google Places Autocomplete (via the
 * places-autocomplete Edge Function — see lib/places.ts). Replaces the
 * plain free-text pickup/destination fields (M7 QA founder decision:
 * clients can't know a route's km, so distance must be computed from
 * real addresses, not typed). A fresh session token is used per
 * autocomplete "session" (input -> selection), matching Google's
 * session-based Places billing model.
 *
 * Founder decision (2026-08-03): free-typed text that's never tapped
 * from the dropdown must not be silently geocoded and dispatched on —
 * "unirii 10" is genuinely ambiguous (Piata Unirii vs Strada Unirii).
 * While the field is unconfirmed, a debounced geocode lookup runs
 * alongside the predictions dropdown and shows a "Folosim adresa: X"
 * confirmation banner; confirming it calls the same onSelect path as a
 * dropdown tap, so the mission's stored address is always either a
 * tapped suggestion or an explicitly-confirmed formatted_address, never
 * raw ambiguous text silently accepted.
 */
export function PlaceAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  isConfirmed,
  placeholder,
  onFocus,
}: PlaceAutocompleteInputProps) {
  const { t } = useTranslation();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [geocodeSuggestion, setGeocodeSuggestion] = useState<GeocodeResult | null>(null);
  const sessionTokenRef = useRef(randomSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      autocompletePlaces(value, sessionTokenRef.current)
        .then(setPredictions)
        .catch(() => setPredictions([]));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeocodeSuggestion(null);
    if (isConfirmed || value.trim().length < 5) return;
    geocodeDebounceRef.current = setTimeout(() => {
      geocodeAddress(value)
        .then(setGeocodeSuggestion)
        .catch(() => setGeocodeSuggestion(null));
    }, 700);
    return () => {
      if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    };
  }, [value, isConfirmed]);

  function handleSelect(prediction: PlacePrediction) {
    setPredictions([]);
    setGeocodeSuggestion(null);
    sessionTokenRef.current = randomSessionToken();
    onSelect(prediction);
  }

  function handleConfirmGeocode() {
    if (!geocodeSuggestion) return;
    handleSelect({ place_id: geocodeSuggestion.place_id, description: geocodeSuggestion.formatted_address });
  }

  return (
    <View>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor="#6B7178"
      />
      {predictions.length > 0 ? (
        <View style={{ borderWidth: tokens.border.width, borderColor: tokens.color.base.line, borderRadius: tokens.radius.md, backgroundColor: tokens.color.base.graphite, marginTop: tokens.spacing[1] }}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={{ paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[3] }}
                onPress={() => handleSelect(item)}
              >
                <Text style={s.chipText}>{item.description}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}
      {!isConfirmed && geocodeSuggestion ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: tokens.border.width,
            borderColor: tokens.color.base.gold,
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.color.base.goldDim,
            marginTop: tokens.spacing[1],
            padding: tokens.spacing[3],
            gap: tokens.spacing[2],
          }}
        >
          <Text style={[s.chipText, { flex: 1 }]}>
            {t("booking.usingAddress", { address: geocodeSuggestion.formatted_address })}
          </Text>
          <Pressable
            style={{ paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2] }}
            onPress={handleConfirmGeocode}
          >
            <Text style={[s.chipText, { color: tokens.color.base.gold, fontWeight: "700" }]}>
              {t("common.confirm")}
            </Text>
          </Pressable>
          <Pressable
            style={{ paddingHorizontal: tokens.spacing[2], paddingVertical: tokens.spacing[2] }}
            onPress={() => setGeocodeSuggestion(null)}
          >
            <Text style={s.chipText}>✕</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
