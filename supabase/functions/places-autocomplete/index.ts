// M7 QA fix — proxies Google Places Autocomplete so the mobile app never
// holds the real Google Maps API key (same server-only trust boundary as
// Stripe: see _shared/clients.ts's getGoogleMapsApiKey()). Requires a
// valid Protego session so an unauthenticated caller can't hammer our
// Google Cloud billing through this function.
import { corsHeaders, getCallerUserId, getGoogleMapsApiKey, jsonResponse } from "../_shared/clients.ts";

interface GooglePrediction {
  place_id: string;
  description: string;
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
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "ro");
    // Pilot scope is Oradea/Romania only (CLAUDE.md/MASTERPROMPT: Oradea
    // is the confirmed pilot city) — restricting results keeps
    // suggestions relevant and Places usage cheaper.
    url.searchParams.set("components", "country:ro");
    if (typeof sessiontoken === "string") {
      url.searchParams.set("sessiontoken", sessiontoken);
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return jsonResponse({ error: `Places API error: ${data.status}` }, 502);
    }

    const predictions = ((data.predictions ?? []) as GooglePrediction[]).map((p) => ({
      place_id: p.place_id,
      description: p.description,
    }));

    return jsonResponse({ predictions });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
