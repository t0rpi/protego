// Overage (audit §4.4) — client-confirmed extension mid-mission. Calls
// request_mission_overage() (caller's own JWT) to get the computed
// quote, then creates a SEPARATE PaymentIntent for the incremental
// amount (manual capture can only ever capture ≤ what was originally
// authorized, so a genuine extension needs its own authorization, not a
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
    const { mission_id, additional_hours } = await req.json();
    if (!mission_id || !additional_hours) {
      return jsonResponse({ error: "mission_id and additional_hours are required" }, 400);
    }

    const userScoped = getUserScopedClient(req);
    const { data: overage, error: overageError } = await userScoped.rpc("request_mission_overage", {
      p_mission_id: mission_id,
      p_additional_hours: additional_hours,
    });
    if (overageError) {
      return jsonResponse({ error: overageError.message }, 400);
    }

    const supabase = getSupabaseAdminClient();
    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", userId).single();
    if (!profile?.stripe_customer_id) {
      return jsonResponse({ error: "no saved Stripe customer — authorize the initial mission payment first" }, 409);
    }

    const stripe = getStripeClient();
    const amount = Math.round(Number(overage.total) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "ron",
      capture_method: "manual",
      customer: profile.stripe_customer_id,
      automatic_payment_methods: { enabled: true },
      metadata: { mission_id, quote_id: overage.quote_id, payment_type: "overage_auth" },
    });

    await supabase.rpc("record_payment_event", {
      p_mission_id: mission_id,
      p_type: "overage_auth",
      p_stripe_payment_intent_id: paymentIntent.id,
      p_amount: overage.total,
      p_status: "processing",
    });

    return jsonResponse({ client_secret: paymentIntent.client_secret, total: overage.total });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
