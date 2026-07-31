/**
 * The 45-second mission offer window (design HANDOFF.md: "Oferta agent
 * = 45s; la expirare misiunea revine în coadă cu prioritate ridicată").
 * Mirrored server-side by mission_offers.expires_at's default
 * (`offered_at + interval '45 seconds'`) —
 * supabase/migrations/20260731110002_mission_offers.sql — this constant
 * is for the mobile app's own countdown ring, not for computing the
 * authoritative expiry itself (the DB default already does that).
 */
export const OFFER_EXPIRY_SECONDS = 45 as const;

/** Whether an offer's window has passed, as of `now` (defaults to the real clock). */
export function isOfferExpired(expiresAt: string, now: Date = new Date()): boolean {
  return now.getTime() > new Date(expiresAt).getTime();
}

/**
 * Seconds remaining on an offer's countdown, floored at 0 — feeds the
 * agent app's countdown ring directly (agentApp.offerTitle screen).
 */
export function secondsUntilOfferExpires(expiresAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 1000));
}
