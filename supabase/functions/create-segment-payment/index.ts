// Chained rides (founder-approved, 2026-08-04) — client-confirmed
// continuation to a new destination mid-mission. Mirrors
// create-overage-payment/index.ts exactly: calls request_mission_segment()
// (caller's own JWT) to get the computed incremental quote, then creates
// a SEPARATE PaymentIntent for that amount (manual capture, same reason
// as overage — a genuine addition needs its own authorization, not a
// bigger capture on the original one).
import {
  corsHeaders,
  getCallerUserId,
  getStripeClient,
  getSupabaseAdminClient,
  getUserScopedClient,
  jsonResponse,
} from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getCallerUserId(req);
    const { mission_id, new_destination_address, new_destination_km, consumed_wait_minutes } = await req.json();
    if (!mission_id || !new_destination_address || new_destination_km === undefined || consumed_wait_minutes === undefined) {
      return jsonResponse(
        { error: "mission_id, new_destination_address, new_destination_km and consumed_wait_minutes are required" },
        400
      );
    }

    const userScoped = getUserScopedClient(req);
    const { data: segment, error: segmentError } = await userScoped.rpc("request_mission_segment", {
      p_mission_id: mission_id,
      p_new_destination_address: new_destination_address,
      p_new_destination_km: new_destination_km,
      p_consumed_wait_minutes: consumed_wait_minutes,
    });
    if (segmentError) {
      return jsonResponse({ error: segmentError.message }, 400);
    }

    const supabase = getSupabaseAdminClient();
    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", userId).single();
    if (!profile?.stripe_customer_id) {
      return jsonResponse({ error: "no saved Stripe customer — authorize the initial mission payment first" }, 409);
    }

    const stripe = getStripeClient();
    const amount = Math.round(Number(segment.total) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "ron",
      capture_method: "manual",
      customer: profile.stripe_customer_id,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { mission_id, quote_id: segment.quote_id, segment_id: segment.segment_id, payment_type: "segment_auth" },
    });

    await supabase.rpc("record_payment_event", {
      p_mission_id: mission_id,
      p_type: "segment_auth",
      p_stripe_payment_intent_id: paymentIntent.id,
      p_amount: segment.total,
      p_status: "processing",
    });

    return jsonResponse({
      client_secret: paymentIntent.client_secret,
      total: segment.total,
      segment_number: segment.segment_number,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
