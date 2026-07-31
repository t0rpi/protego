// Optional saved payment method (SetupIntent) — the client can save a
// card for faster future bookings and so a high-risk (review) mission
// can be charged automatically the moment a dispatcher confirms it. No
// charge happens here at all; a SetupIntent only attaches a payment
// method to the Stripe customer for later off-session use.
import { corsHeaders, getCallerUserId, getStripeClient, getSupabaseAdminClient, jsonResponse } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getCallerUserId(req);
    const supabase = getSupabaseAdminClient();

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

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
    });

    return jsonResponse({ client_secret: setupIntent.client_secret });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
