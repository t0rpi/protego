// M7 QA fix — proxies Google Routes API (computeRoutes) to get a route
// distance from two Places place_ids. Routes API accepts a placeId
// waypoint directly, so no separate Geocoding/Place Details call is
// needed. Same server-only key trust boundary as places-autocomplete.
//
// Uses Routes API (POST directions/v2:computeRoutes), not the legacy
// GET /maps/api/directions/json endpoint — the founder's Google Cloud
// key is restricted to Places (New) + Routes + Geocoding only.
import { corsHeaders, getCallerUserId, getGoogleMapsApiKey, jsonResponse } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getCallerUserId(req);

    const { origin_place_id, destination_place_id } = await req.json();
    if (typeof origin_place_id !== "string" || typeof destination_place_id !== "string") {
      return jsonResponse({ error: "origin_place_id and destination_place_id are required" }, 400);
    }

    const apiKey = getGoogleMapsApiKey();

    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Routes API returns no fields at all without an explicit field
        // mask (cost-control default) — this is the one well-known
        // gotcha with this endpoint.
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { placeId: origin_place_id },
        destination: { placeId: destination_place_id },
        travelMode: "DRIVE",
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      return jsonResponse({ error: `Routes API error: ${data.error?.message ?? res.status}` }, 502);
    }

    const meters = data.routes?.[0]?.distanceMeters;
    if (typeof meters !== "number") {
      return jsonResponse({ error: "Routes API returned no distance" }, 502);
    }

    const distanceKm = Math.round((meters / 1000) * 10) / 10;
    return jsonResponse({ distance_km: distanceKm });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
