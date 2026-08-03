// M7 QA fix — proxies Google Places Autocomplete (New) so the mobile app
// never holds the real Google Maps API key (same server-only trust
// boundary as Stripe: see _shared/clients.ts's getGoogleMapsApiKey()).
// Requires a valid Protego session so an unauthenticated caller can't
// hammer our Google Cloud billing through this function.
//
// Uses Places API (New) (POST places:autocomplete), not the legacy GET
// /maps/api/place/autocomplete/json endpoint — the founder's Google
// Cloud key is restricted to "Places API (New)" + Routes + Geocoding
// only, so the legacy endpoint would be rejected outright.
import { corsHeaders, getCallerUserId, getGoogleMapsApiKey, jsonResponse } from "../_shared/clients.ts";

interface PlacePredictionNew {
  placePrediction?: {
    placeId: string;
    text?: { text?: string };
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getCallerUserId(req);

    const { input, sessiontoken } = await req.json();
    if (!input || typeof input !== "string" || input.trim().length < 3) {
      return jsonResponse({ predictions: [] });
    }

    const apiKey = getGoogleMapsApiKey();

    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input,
        languageCode: "ro",
        // Pilot scope is Oradea/Romania only (CLAUDE.md/MASTERPROMPT:
        // Oradea is the confirmed pilot city) — restricting results
        // keeps suggestions relevant and Places usage cheaper.
        includedRegionCodes: ["ro"],
        ...(typeof sessiontoken === "string" ? { sessionToken: sessiontoken } : {}),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      return jsonResponse({ error: `Places API error: ${data.error?.message ?? res.status}` }, 502);
    }

    const predictions = ((data.suggestions ?? []) as PlacePredictionNew[])
      .filter((s) => s.placePrediction?.placeId)
      .map((s) => ({
        place_id: s.placePrediction!.placeId,
        description: s.placePrediction!.text?.text ?? "",
      }));

    return jsonResponse({ predictions });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
