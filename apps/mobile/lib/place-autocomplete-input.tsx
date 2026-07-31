import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { tokens } from "@protego/ui";
import { autocompletePlaces, type PlacePrediction } from "./places";
import { bookingStyles as s } from "./booking-styles";

function randomSessionToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface PlaceAutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (prediction: PlacePrediction) => void;
  placeholder?: string;
}

/**
 * Address input backed by Google Places Autocomplete (via the
 * places-autocomplete Edge Function — see lib/places.ts). Replaces the
 * plain free-text pickup/destination fields (M7 QA founder decision:
 * clients can't know a route's km, so distance must be computed from
 * real addresses, not typed). A fresh session token is used per
 * autocomplete "session" (input -> selection), matching Google's
 * session-based Places billing model.
 */
export function PlaceAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  placeholder,
}: PlaceAutocompleteInputProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const sessionTokenRef = useRef(randomSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleSelect(prediction: PlacePrediction) {
    setPredictions([]);
    sessionTokenRef.current = randomSessionToken();
    onSelect(prediction);
  }

  return (
    <View>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
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
    </View>
  );
}
