/**
 * Agent earnings per completed mission — mirrors complete_mission()'s
 * exact calculation (supabase/migrations/
 * 20260731130003_payments.sql): 55% of the LABOR COMPONENT only
 * (v2.3 §23 — "nu din total, vehiculul și taxa de platformă revin
 * firmei"), with an optional floor (confirmed for Protect Ride at 35
 * lei/mission only — `agentMinimumPerMission` is null for Escort/
 * Hourly, no floor invented for them).
 */
export interface EarningsInput {
  laborComponent: number;
  agentSharePct: number;
  agentMinimumPerMission?: number | null;
}

export function computeAgentEarnings(input: EarningsInput): number {
  const computed = Math.round(input.laborComponent * input.agentSharePct * 100) / 100;
  if (input.agentMinimumPerMission != null && computed < input.agentMinimumPerMission) {
    return input.agentMinimumPerMission;
  }
  return computed;
}
