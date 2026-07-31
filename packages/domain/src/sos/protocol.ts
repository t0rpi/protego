/**
 * The 4-step SOS script (dispatcher-playbook.md §3, design strings
 * dispatcher.p1-p4). Mirrors shield_events.protocol_steps exactly —
 * resolve_sos() (supabase/migrations/20260731120006_shield_events.sql)
 * re-enforces this same completeness check server-side; this is the
 * client-side mirror for enabling/disabling the resolve button.
 */
export const SOS_PROTOCOL_STEPS = ["p1", "p2", "p3", "p4"] as const;
export type SosProtocolStep = (typeof SOS_PROTOCOL_STEPS)[number];

export function isSosProtocolComplete(steps: Partial<Record<SosProtocolStep, boolean>>): boolean {
  return SOS_PROTOCOL_STEPS.every((step) => steps[step] === true);
}

/**
 * repository-audit.md §5.2 — system delivery budget, NOT the business
 * KPI. Kept as named constants so the dispatcher console and any future
 * load test reference the same numbers instead of scattered literals.
 */
export const SOS_LATENCY_TARGET_P95_MS = 1500 as const;
export const SOS_LATENCY_HARD_CAP_MS = 3000 as const;

/** MASTERPROMPT §2.14 / prd.md §1 — the actual business KPI: human first contact, not system delivery. */
export const SOS_HUMAN_FIRST_CONTACT_TARGET_SECONDS = 60 as const;
