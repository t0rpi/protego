// Authorize (audit §4.1) — PaymentIntent, capture_method: 'manual',
// amount = quote.total_estimate. Success = a hold on the card, no
// capture. Called by the client's own app: (a) before quoted->confirmed
// for a normal-risk mission (payment required BEFORE that transition —
// see enforce_mission_transition()), or (b) after review->confirmed for
// a high-risk mission that a dispatcher already confirmed (payment is
// NOT a precondition for that transition, only for the follow-up
// "complete your payment" step the client sees).
import { corsHeaders, getCallerUserId, getStripeClient, getSupabaseAdminClient, jsonResponse } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getCallerUserId(req);
    const { mission_id } = await req.json();
    if (!mission_id) {
      return jsonResponse({ error: "mission_id is required" }, 400);
    }

    const supabase = getSupabaseAdminClient();

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, client_id, status, city")
      .eq("id", mission_id)
      .single();
    if (missionError || !mission) {
      return jsonResponse({ error: "mission not found" }, 404);
    }
    if (mission.client_id !== userId) {
      return jsonResponse({ error: "not your mission" }, 403);
    }
    if (!["quoted", "confirmed"].includes(mission.status)) {
      return jsonResponse({ error: `mission is not in a payable state (status=${mission.status})` }, 409);
    }

    const { data: existingAuth } = await supabase
      .from("payments")
      .select("id")
      .eq("mission_id", mission_id)
      .eq("type", "auth")
      .in("status", ["requires_capture", "succeeded"])
      .maybeSingle();
    if (existingAuth) {
      return jsonResponse({ error: "this mission already has a successful payment authorization" }, 409);
    }

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, total_estimate, currency")
      .eq("mission_id", mission_id)
      .eq("kind", "initial")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (quoteError || !quote) {
      return jsonResponse({ error: "no quote found for this mission — call create_quote_for_mission first" }, 409);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", userId)
      .single();

    const stripe = getStripeClient();
    let stripeCustomerId = profile?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: profile?.full_name ?? undefined,
        metadata: { protego_user_id: userId },
      });
      stripeCustomerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: stripeCustomerId }).eq("id", userId);
    }

    const amountInBani = Math.round(Number(quote.total_estimate) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInBani,
      currency: "ron",
      capture_method: "manual",
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
      metadata: { mission_id, quote_id: quote.id },
    });

    await supabase.rpc("record_payment_event", {
      p_mission_id: mission_id,
      p_type: "auth",
      p_stripe_payment_intent_id: paymentIntent.id,
      p_amount: quote.total_estimate,
      p_status: "processing",
    });

    // The publishable key is not secret and never varies per-request —
    // the mobile app reads its own EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
    // directly rather than round-tripping it through this response.
    return jsonResponse({ client_secret: paymentIntent.client_secret });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
