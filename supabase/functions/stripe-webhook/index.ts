// Stripe webhook receiver — the only place PaymentIntent state actually
// changes get synced into `payments` (client apps never report their
// own payment status; Stripe tells us). Idempotent: every event id is
// recorded via record_webhook_event() before any side effect, so a
// redelivered event is a no-op the second time (Stripe webhooks are
// explicitly at-least-once delivery, never exactly-once).
import Stripe from "npm:stripe@17";
import { getStripeClient, getSupabaseAdminClient, jsonResponse } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) {
    return jsonResponse({ error: "missing signature or webhook secret" }, 400);
  }

  const body = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (error) {
    return jsonResponse({ error: `signature verification failed: ${error instanceof Error ? error.message : error}` }, 400);
  }

  const supabase = getSupabaseAdminClient();

  const { data: isNew } = await supabase.rpc("record_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
  });
  if (!isNew) {
    return jsonResponse({ received: true, duplicate: true });
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const missionId = pi.metadata?.mission_id as string | undefined;

  try {
    switch (event.type) {
      case "payment_intent.amount_capturable_updated": {
        // Authorization succeeded, hold is in place, awaiting capture —
        // the exact moment a normal-risk mission is allowed to confirm.
        if (missionId) {
          await supabase.rpc("record_payment_event", {
            p_mission_id: missionId,
            p_type: "auth",
            p_stripe_payment_intent_id: pi.id,
            p_amount: pi.amount / 100,
            p_status: "requires_capture",
          });
          await supabase.rpc("confirm_mission_after_payment", { p_mission_id: missionId });
        }
        break;
      }
      case "payment_intent.succeeded": {
        // A capture completed — could be the original auth (mission
        // completion), a partial capture (cancellation fee), or an
        // overage PaymentIntent.
        if (missionId) {
          const type = pi.metadata?.payment_type === "overage_auth" ? "overage_auth" : "capture";
          await supabase.rpc("record_payment_event", {
            p_mission_id: missionId,
            p_type: type,
            p_stripe_payment_intent_id: pi.id,
            p_amount: pi.amount_received / 100,
            p_status: "succeeded",
          });
        }
        break;
      }
      case "payment_intent.canceled": {
        if (missionId) {
          await supabase.rpc("record_payment_event", {
            p_mission_id: missionId,
            p_type: "refund",
            p_stripe_payment_intent_id: pi.id,
            p_amount: 0,
            p_status: "canceled",
          });
        }
        break;
      }
      case "payment_intent.payment_failed": {
        if (missionId) {
          await supabase.rpc("record_payment_event", {
            p_mission_id: missionId,
            p_type: "auth",
            p_stripe_payment_intent_id: pi.id,
            p_amount: pi.amount / 100,
            p_status: "failed",
          });
        }
        break;
      }
      default:
        // Every other event type is intentionally ignored — recorded in
        // stripe_webhook_events for idempotency/audit, no side effect.
        break;
    }
  } catch (error) {
    // The event IS already marked processed (record_webhook_event ran
    // first) — a failure here should alert (Sentry, not wired this
    // milestone) rather than cause Stripe to keep redelivering an event
    // whose DB-side effect partially applied.
    console.error(`stripe-webhook: error handling ${event.type} (${event.id}):`, error);
    return jsonResponse({ received: true, error: "processing error, see function logs" }, 200);
  }

  return jsonResponse({ received: true });
});
