/**
 * Canonical `agents.status` enum, mirrored server-side by
 * enforce_agent_status_transition() —
 * supabase/migrations/20260731110001_agents_extensions.sql. Onboarding
 * progresses in_review -> approved -> active with no skipping
 * (acceptance-tests.md M3); "blocked" is reachable from any of those
 * (dispatcher decision, e.g. an expired document) or as an in_review
 * rejection, and recovery from blocked returns to "approved" — a
 * dispatcher must re-confirm readiness, never straight back to active.
 */
export const AGENT_STATUSES = ["in_review", "approved", "active", "blocked"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<AgentStatus, readonly AgentStatus[]> = {
  in_review: ["approved", "blocked"],
  approved: ["active", "blocked"],
  active: ["blocked"],
  blocked: ["approved"],
};

export function canTransitionAgentStatus(from: AgentStatus, to: AgentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface AgentEligibilityInput {
  status: AgentStatus;
  isAvailable: boolean;
  hasExpiredDocument: boolean;
}

/**
 * Whether an agent can receive a new mission offer — mirrors
 * create_mission_offer()'s gates exactly (repository-audit.md §6): must
 * be active, available, and have no expired document. Client-side
 * preview only (e.g. to decide whether to even show the availability
 * toggle as "on"); the DB function is the one that actually enforces this.
 */
export function isAgentEligibleForOffers(input: AgentEligibilityInput): boolean {
  return input.status === "active" && input.isAvailable && !input.hasExpiredDocument;
}

/**
 * Whether an agent can start protection on an already-assigned mission
 * — mirrors start_mission_protection()'s document check. Status/
 * availability don't matter once assigned (an agent already mid-mission
 * stays authorized to finish it even if they flip is_available off),
 * only the expired-document gate is repeated here.
 */
export function isAgentEligibleToStartMission(input: Pick<AgentEligibilityInput, "hasExpiredDocument">): boolean {
  return !input.hasExpiredDocument;
}
