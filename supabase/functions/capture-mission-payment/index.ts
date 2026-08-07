// Capture (audit §4.2) — called by the agent's app right after
// complete_mission() succeeds. Never trusts a client-supplied amount:
// reads back what complete_mission() already computed and persisted
// (the 'final' quote, plus any 'overage' quotes) directly from the DB,
// then tells Stripe to capture exactly that.
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
      .select("id, status")
      .eq("id", mission_id)
      .single();
    if (missionError || !mission) {
      return jsonResponse({ error: "mission not found" }, 404);
    }
    if (mission.status !== "done") {
      return jsonResponse({ error: "mission must be done (call complete_mission() first)" }, 409);
    }

    const { data: agentOffer } = await supabase
      .from("mission_offers")
      .select("agent_id")
      .eq("mission_id", mission_id)
      .eq("status", "accepted")
      .maybeSingle();
    if (!agentOffer || agentOffer.agent_id !== userId) {
      return jsonResponse({ error: "only the assigned agent can trigger capture" }, 403);
    }

    const { data: authPayment } = await supabase
      .from("payments")
      .select("stripe_payment_intent_id, amount")
      .eq("mission_id", mission_id)
      .eq("type", "auth")
      .eq("status", "requires_capture")
      .maybeSingle();

    const stripe = getStripeClient();
    const results: Record<string, unknown> = {};
    const failures: string[] = [];

    // F1 fix (2026-08-07): a capture failure here previously only ever
    // surfaced as a console.error() on the agent's phone (audit-
    // findings.md F1) — Stripe's payment_intent.payment_failed webhook
    // covers *async* failures, but a capture that's rejected synchronously
    // by the Stripe API (e.g. "amount_to_capture exceeds capturable
    // amount", an already-canceled PI) never fires that webhook at all.
    // record_payment_event(..., 'failed') is called directly here so the
    // failure is guaranteed to land in `payments` — and therefore on the
    // admin payments overview and the dispatcher console flag — no
    // matter what happens to the agent's app afterward.
    if (authPayment) {
      const { data: finalQuote } = await supabase
        .from("quotes")
        .select("total_estimate")
        .eq("mission_id", mission_id)
        .eq("kind", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const captureAmount = Math.min(
        Number(finalQuote?.total_estimate ?? authPayment.amount),
        Number(authPayment.amount)
      );

      try {
        const captured = await stripe.paymentIntents.capture(authPayment.stripe_payment_intent_id, {
          amount_to_capture: Math.round(captureAmount * 100),
        });
        results.capture = { id: captured.id, status: captured.status, amount: captureAmount };
      } catch (captureError) {
        await supabase.rpc("record_payment_event", {
          p_mission_id: mission_id,
          p_type: "capture",
          p_stripe_payment_intent_id: authPayment.stripe_payment_intent_id,
          p_amount: captureAmount,
          p_status: "failed",
        });
        failures.push(captureError instanceof Error ? captureError.message : "capture failed");
      }
    }

    const { data: overagePayments } = await supabase
      .from("payments")
      .select("stripe_payment_intent_id, amount")
      .eq("mission_id", mission_id)
      .eq("type", "overage_auth")
      .eq("status", "requires_capture");

    for (const overage of overagePayments ?? []) {
      try {
        const captured = await stripe.paymentIntents.capture(overage.stripe_payment_intent_id);
        results[`overage_${overage.stripe_payment_intent_id}`] = { id: captured.id, status: captured.status };
      } catch (captureError) {
        await supabase.rpc("record_payment_event", {
          p_mission_id: mission_id,
          p_type: "overage_auth",
          p_stripe_payment_intent_id: overage.stripe_payment_intent_id,
          p_amount: overage.amount,
          p_status: "failed",
        });
        failures.push(captureError instanceof Error ? captureError.message : "overage capture failed");
      }
    }

    if (failures.length > 0) {
      return jsonResponse({ ok: false, results, failures }, 502);
    }

    return jsonResponse({ ok: true, results });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
