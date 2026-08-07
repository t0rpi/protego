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

export interface GeocodeResult {
  formatted_address: string;
  place_id: string;
  lat: number;
  lng: number;
}

/**
 * Founder decision (2026-08-03): a free-typed address must be shown
 * back to the client as Google's normalized formatted_address for
 * confirmation before it's treated as the real pickup/destination —
 * "unirii 10" is genuinely ambiguous (Piata Unirii vs Strada Unirii),
 * and the confirmed address is what the agent gets dispatched to.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const { data, error } = await supabase.functions.invoke("geocode-address", {
    body: { address },
  });
  if (error) throw error;
  return data.result ?? null;
}

/**
 * GPS auto-location (2026-08-04 founder decision) — reverse-geocodes a
 * device coordinate to the same formatted_address/place_id shape as
 * geocodeAddress, so a GPS fix goes through the exact same mandatory
 * confirmation path as any typed address (never dispatched on as raw
 * coordinates).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const { data, error } = await supabase.functions.invoke("geocode-address", {
    body: { lat, lng },
  });
  if (error) throw error;
  return data.result ?? null;
}

/**
 * Prefers a selected suggestion's place_id for each endpoint when
 * available; falls back to geocoding the raw typed text server-side
 * otherwise. This matters — most real bookings never tap a suggestion
 * for both fields, and requiring place_ids for both silently produced
 * the same default-estimate quote for every address (founder QA
 * finding, 2026-08-03).
 */
interface RouteEndpointParams {
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  originAddress?: string;
  destinationAddress?: string;
}

export async function computeRouteDistanceKm(params: RouteEndpointParams): Promise<number> {
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

export interface RouteResult {
  distance_km: number;
  /** Google encoded polyline — decode with @protego/domain's decodePolyline(). */
  polyline: string | null;
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
}

/**
 * Pass B: the same route-distance Edge Function, but returns the full
 * response (polyline + resolved origin/destination coordinates) for the
 * booking route step's Map slot preview — not just the distance number
 * computeRouteDistanceKm() extracts. One request either way; this is
 * just a richer read of the same response.
 */
export async function computeRoute(params: RouteEndpointParams): Promise<RouteResult> {
  const { data, error } = await supabase.functions.invoke("route-distance", {
    body: {
      origin_place_id: params.originPlaceId ?? undefined,
      destination_place_id: params.destinationPlaceId ?? undefined,
      origin_address: params.originAddress,
      destination_address: params.destinationAddress,
    },
  });
  if (error) throw error;
  return data;
}
