/**
 * Agent earnings per completed mission — mirrors complete_mission()'s
 * exact calculation (supabase/migrations/
 * 20260731110007_mission_transitions_agent.sql): the mission's quote
 * total x a configurable share percentage read from
 * pricing_config.agent_share_pct (20260731110006_agent_earnings.sql).
 * Never a constant here — `agentSharePct` always comes from that table.
 */
export interface EarningsInput {
  missionTotal: number;
  agentSharePct: number;
}

export function computeAgentEarnings(input: EarningsInput): number {
  return Math.round(input.missionTotal * input.agentSharePct * 100) / 100;
}
