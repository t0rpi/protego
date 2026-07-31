// Cancel/refund (audit §4.3) — calls cancel_mission_by_client() (the
// caller's own JWT, so its ownership/status checks apply naturally) to
// get the computed fee, then acts on Stripe: fee=0 -> cancel the
// PaymentIntent (full release); fee>0 -> partial capture for the fee
// (Stripe automatically releases the remaining, uncaptured hold).
import {
  corsHeaders,
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
    const { mission_id } = await req.json();
    if (!mission_id) {
      return jsonResponse({ error: "mission_id is required" }, 400);
    }

    const userScoped = getUserScopedClient(req);
    const { data: fee, error: cancelError } = await userScoped.rpc("cancel_mission_by_client", {
      p_mission_id: mission_id,
    });
    if (cancelError) {
      return jsonResponse({ error: cancelError.message }, 400);
    }

    const supabase = getSupabaseAdminClient();
    const { data: authPayment } = await supabase
      .from("payments")
      .select("stripe_payment_intent_id")
      .eq("mission_id", mission_id)
      .eq("type", "auth")
      .eq("status", "requires_capture")
      .maybeSingle();

    if (!authPayment) {
      // draft/quoted/review cancellations never had a payment authorized —
      // nothing to do on the Stripe side.
      return jsonResponse({ ok: true, fee: 0, stripe_action: "none" });
    }

    const stripe = getStripeClient();
    const feeAmount = Number(fee ?? 0);

    if (feeAmount <= 0) {
      const canceled = await stripe.paymentIntents.cancel(authPayment.stripe_payment_intent_id);
      return jsonResponse({ ok: true, fee: 0, stripe_action: "canceled", status: canceled.status });
    }

    const captured = await stripe.paymentIntents.capture(authPayment.stripe_payment_intent_id, {
      amount_to_capture: Math.round(feeAmount * 100),
    });
    return jsonResponse({ ok: true, fee: feeAmount, stripe_action: "partial_capture", status: captured.status });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
