export const MINIMUM_VERIFICATION_LEVEL_TO_CONFIRM_MISSION = 2 as const;

export interface VerificationGateInput {
  verificationLevel: number;
}

/**
 * A client may confirm a mission (`quoted` -> `confirmed`) only at
 * verification level 2 (CI + selfie approved by a dispatcher). Level 1
 * (phone/email only) is enough to explore and get a price estimate, never
 * to confirm. Source: docs/product/prd.md §7;
 * docs/testing/acceptance-tests.md M1.
 *
 * DB-level attachment point (M2, not yet built): once `missions` exists,
 * the `quoted -> confirmed` transition guard described in
 * docs/architecture/repository-audit.md §3.4 must include this exact
 * check (`profiles.verification_level >= 2`) alongside its other
 * conditions (risk_level = normal, preauthorization succeeded, client-
 * vehicle checklist complete where relevant). This function is the
 * domain-level source of truth for the condition; the M2 trigger
 * re-implements it in SQL so the rule holds even for writes that don't go
 * through the app (e.g. a direct API call).
 */
export function canConfirmMission(input: VerificationGateInput): boolean {
  return input.verificationLevel >= MINIMUM_VERIFICATION_LEVEL_TO_CONFIRM_MISSION;
}
