// M7 QA fix — founder decision: a free-typed address must never be
// silently geocoded and dispatched on without the client seeing and
// confirming Google's normalized formatted_address first ("unirii 10"
// is genuinely ambiguous between Piata Unirii and Strada Unirii -- an
// operational risk, not just a UX nicety). Returns the top geocoding
// result's formatted_address + place_id so the client can show a
// "Folosim adresa: X" confirmation, and so the confirmed place_id can
// be used exactly like a tapped autocomplete suggestion afterwards.
// Same server-only key trust boundary as the other Maps functions.
import { corsHeaders, getCallerUserId, getGoogleMapsApiKey, jsonResponse } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getCallerUserId(req);

    const { address } = await req.json();
    if (typeof address !== "string" || address.trim().length < 5) {
      return jsonResponse({ result: null });
    }

    const apiKey = getGoogleMapsApiKey();
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("region", "ro");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "ZERO_RESULTS") {
      return jsonResponse({ result: null });
    }
    if (data.status !== "OK" || !data.results?.length) {
      return jsonResponse({ error: `Geocoding API error: ${data.status}` }, 502);
    }

    const top = data.results[0];
    return jsonResponse({
      result: {
        formatted_address: top.formatted_address as string,
        place_id: top.place_id as string,
        lat: top.geometry.location.lat as number,
        lng: top.geometry.location.lng as number,
      },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
