/**
 * Client-vehicle rule (business-rules.md §5). Split into two phases —
 * see the migration comment in supabase/migrations/
 * 20260731100004_mission_vehicle_checklists.sql for the full reasoning:
 *
 *   1. Client-provided, at booking time (M2, this module): consent +
 *      insurance confirmation + signature. Gates quoted->confirmed.
 *   2. Agent-provided, at mission start (M3, not modeled here beyond
 *      the schema): the 6-photo checklist (front/back/left/right/km/
 *      fuel). Gates arrived->active, a transition M2 doesn't reach.
 */
export interface BookingTimeChecklistState {
  consentSignedAt: string | null;
  insuranceConfirmed: boolean;
  clientSignatureAt: string | null;
}

/** The 6 photos an agent captures before departure — schema-ready, M3 concern. */
export const VEHICLE_CHECKLIST_PHOTO_KEYS = ["front", "back", "left", "right", "km", "fuel"] as const;
export type VehiclePhotoKey = (typeof VEHICLE_CHECKLIST_PHOTO_KEYS)[number];

/**
 * Whether the client has done everything THEY are responsible for
 * before the booking can proceed to the payment step. Does not check
 * photos — those don't (and can't) exist yet at booking time, since no
 * agent has been assigned (mirrors the DB guard in
 * enforce_mission_transition(), quoted->confirmed branch).
 */
export function isBookingTimeChecklistComplete(state: BookingTimeChecklistState): boolean {
  return Boolean(state.consentSignedAt) && state.insuranceConfirmed && Boolean(state.clientSignatureAt);
}

/** M3 concern: whether the agent's photo checklist is complete (arrived->active gate). */
export function isPhotoChecklistComplete(photos: Partial<Record<VehiclePhotoKey, string>>): boolean {
  return VEHICLE_CHECKLIST_PHOTO_KEYS.every((key) => Boolean(photos[key]));
}
