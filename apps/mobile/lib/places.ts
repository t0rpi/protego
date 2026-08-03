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

/**
 * Prefers a selected suggestion's place_id for each endpoint when
 * available; falls back to geocoding the raw typed text server-side
 * otherwise. This matters — most real bookings never tap a suggestion
 * for both fields, and requiring place_ids for both silently produced
 * the same default-estimate quote for every address (founder QA
 * finding, 2026-08-03).
 */
export async function computeRouteDistanceKm(params: {
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  originAddress?: string;
  destinationAddress?: string;
}): Promise<number> {
  const { data, error } = await supabase.functions.invoke("route-distance", {
    body: {
      origin_place_id: params.originPlaceId ?? undefined,
      destination_place_id: params.destinationPlaceId ?? undefined,
      origin_address: params.originAddress,
      destination_address: params.destinationAddress,
    },
  });
  if (error) throw error;
  return data.distance_km;
}
