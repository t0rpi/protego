import { supabase } from "./supabase";

/**
 * Thin wrappers around the Stripe Edge Functions
 * (supabase/functions/*) — never talks to Stripe directly from the
 * client beyond confirming a PaymentSheet/SetupIntent with the
 * client_secret these return. No secret key ever reaches this app.
 */

export async function authorizeMissionPayment(missionId: string): Promise<{ client_secret: string }> {
  const { data, error } = await supabase.functions.invoke("authorize-mission-payment", {
    body: { mission_id: missionId },
  });
  if (error) throw error;
  return data;
}

export async function createSetupIntent(): Promise<{ client_secret: string }> {
  const { data, error } = await supabase.functions.invoke("create-setup-intent", { body: {} });
  if (error) throw error;
  return data;
}

export async function cancelMissionPayment(
  missionId: string
): Promise<{ ok: true; fee: number; stripe_action: string }> {
  const { data, error } = await supabase.functions.invoke("cancel-mission-payment", {
    body: { mission_id: missionId },
  });
  if (error) throw error;
  return data;
}

export async function createOveragePayment(
  missionId: string,
  additionalHours: number
): Promise<{ client_secret: string; total: number }> {
  const { data, error } = await supabase.functions.invoke("create-overage-payment", {
    body: { mission_id: missionId, additional_hours: additionalHours },
  });
  if (error) throw error;
  return data;
}

export async function captureMissionPayment(missionId: string): Promise<{ ok: true; results: unknown }> {
  const { data, error } = await supabase.functions.invoke("capture-mission-payment", {
    body: { mission_id: missionId },
  });
  if (error) throw error;
  return data;
}
