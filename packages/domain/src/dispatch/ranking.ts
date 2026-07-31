/**
 * Ranked agent suggestions for manual assignment (dispatcher-playbook.md
 * §2.3: "sugestii ordonate — distanță, rating, badge, vehicul — decizia
 * finală rămâne manuală"). This never auto-assigns; it only orders the
 * dispatcher's own list.
 *
 * `distanceKm` is deliberately optional: this milestone has no live
 * agent GPS captured at OFFER time (mission_tracking only exists once a
 * mission is enroute/arrived/active — after assignment, not before), so
 * a real distance can't be computed yet. When it's `undefined` the
 * dispatcher UI shows a literal placeholder ("—") rather than a
 * fabricated number, and ranking falls back to rating + badges +
 * vehicle only — a disclosed simplification, not a hidden one.
 */
export interface AgentSuggestionInput {
  agentId: string;
  rating: number | null;
  badgeCount: number;
  hasVehicle: boolean;
  distanceKm?: number;
}

export type RankedAgentSuggestion<T extends AgentSuggestionInput = AgentSuggestionInput> = T & { score: number };

const RATING_WEIGHT = 20;
const BADGE_WEIGHT = 5;
const VEHICLE_BONUS = 10;
const DISTANCE_CAP_KM = 20;

export function computeSuggestionScore(input: AgentSuggestionInput): number {
  let score = (input.rating ?? 0) * RATING_WEIGHT;
  score += input.badgeCount * BADGE_WEIGHT;
  score += input.hasVehicle ? VEHICLE_BONUS : 0;
  if (input.distanceKm !== undefined) {
    score += Math.max(0, DISTANCE_CAP_KM - input.distanceKm);
  }
  return score;
}

/**
 * Highest-scored first. Ties keep their original relative order (stable
 * sort). Generic so callers can pass richer objects (e.g. with a
 * display name attached) and get them back intact, just with `score` added.
 */
export function rankAgentSuggestions<T extends AgentSuggestionInput>(agents: T[]): RankedAgentSuggestion<T>[] {
  return agents
    .map((agent) => ({ ...agent, score: computeSuggestionScore(agent) }))
    .sort((a, b) => b.score - a.score);
}
