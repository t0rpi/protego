// M7 QA fix — proxies Google Directions to compute a route distance from
// two Places place_ids (Directions accepts "place_id:XXX" directly as
// origin/destination, so no separate Place Details call is needed).
// Same server-only key trust boundary as places-autocomplete.
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
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `place_id:${origin_place_id}`);
    url.searchParams.set("destination", `place_id:${destination_place_id}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "ro");

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.routes?.length) {
      return jsonResponse({ error: `Directions API error: ${data.status}` }, 502);
    }

    const meters = data.routes[0]?.legs?.[0]?.distance?.value;
    if (typeof meters !== "number") {
      return jsonResponse({ error: "Directions API returned no distance" }, 502);
    }

    const distanceKm = Math.round((meters / 1000) * 10) / 10;
    return jsonResponse({ distance_km: distanceKm });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
