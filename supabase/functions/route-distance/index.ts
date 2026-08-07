// M7 QA fix — proxies Google Routes API (computeRoutes) to get a route
// distance. Accepts EITHER place_ids (client selected an autocomplete
// suggestion) OR free-text addresses (client just typed and never
// tapped a suggestion) -- geocoding the text via the Geocoding API when
// no place_id is available. This matters: requiring a selected
// suggestion for both fields meant most real typed-address bookings
// silently never computed a real distance at all, always falling back
// to the disclosed default estimate regardless of what was typed
// (founder QA finding, 2026-08-03). Same server-only key trust
// boundary as places-autocomplete.
import { corsHeaders, getCallerUserId, getGoogleMapsApiKey, jsonResponse } from "../_shared/clients.ts";

interface LatLng {
  lat: number;
  lng: number;
}

async function geocode(address: string, apiKey: string): Promise<LatLng> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", "ro");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`could not geocode address (${data.status})`);
  }
  const location = data.results[0].geometry.location;
  return { lat: location.lat, lng: location.lng };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getCallerUserId(req);

    const { origin_place_id, destination_place_id, origin_address, destination_address } = await req.json();

    const apiKey = getGoogleMapsApiKey();

    async function resolveWaypoint(placeId: unknown, address: unknown): Promise<Record<string, unknown>> {
      if (typeof placeId === "string" && placeId) {
        return { placeId };
      }
      if (typeof address === "string" && address.trim().length > 0) {
        const latLng = await geocode(address, apiKey);
        return { location: { latLng: { latitude: latLng.lat, longitude: latLng.lng } } };
      }
      throw new Error("each endpoint needs either a place_id or an address");
    }

    const [origin, destination] = await Promise.all([
      resolveWaypoint(origin_place_id, origin_address),
      resolveWaypoint(destination_place_id, destination_address),
    ]);

    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Routes API returns no fields at all without an explicit field
        // mask (cost-control default) — this is the one well-known
        // gotcha with this endpoint. Pass B: also request the encoded
        // polyline + resolved leg endpoints (works whether the client
        // gave us a place_id or a typed address — Routes API resolves
        // either into real coordinates in the response, so we don't
        // need a second geocode call just to get pins for the Map slot).
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.startLocation,routes.legs.endLocation",
      },
      body: JSON.stringify({ origin, destination, travelMode: "DRIVE" }),
    });
    const data = await res.json();

    if (!res.ok) {
      return jsonResponse({ error: `Routes API error: ${data.error?.message ?? res.status}` }, 502);
    }

    const route = data.routes?.[0];
    const meters = route?.distanceMeters;
    if (typeof meters !== "number") {
      return jsonResponse({ error: "Routes API returned no distance" }, 502);
    }

    const distanceKm = Math.round((meters / 1000) * 10) / 10;
    const leg = route.legs?.[0];
    const startLatLng = leg?.startLocation?.latLng;
    const endLatLng = leg?.endLocation?.latLng;

    return jsonResponse({
      distance_km: distanceKm,
      polyline: route.polyline?.encodedPolyline ?? null,
      origin: startLatLng ? { lat: startLatLng.latitude, lng: startLatLng.longitude } : null,
      destination: endLatLng ? { lat: endLatLng.latitude, lng: endLatLng.longitude } : null,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
