import { supabase } from "./supabase";

/**
 * Thin wrappers around the Places/Directions Edge Functions
 * (supabase/functions/places-autocomplete, /route-distance) — same
 * "no secret key in the app" pattern as lib/payments.ts. The real
 * Google Maps API key never reaches this app.
 */

export interface PlacePrediction {
  place_id: string;
  description: string;
}

export async function autocompletePlaces(
  input: string,
  sessionToken: string
): Promise<PlacePrediction[]> {
  const { data, error } = await supabase.functions.invoke("places-autocomplete", {
    body: { input, sessiontoken: sessionToken },
  });
  if (error) throw error;
  return data.predictions ?? [];
}

export async function computeRouteDistanceKm(
  originPlaceId: string,
  destinationPlaceId: string
): Promise<number> {
  const { data, error } = await supabase.functions.invoke("route-distance", {
    body: { origin_place_id: originPlaceId, destination_place_id: destinationPlaceId },
  });
  if (error) throw error;
  return data.distance_km;
}
