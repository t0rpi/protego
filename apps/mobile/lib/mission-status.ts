/**
 * F5 fix (2026-08-07, audit-findings.md): a client who closes the app
 * while a mission is "in review" (or any in-flight state) had no path
 * back to it once it moved forward — Home never checked for one,
 * History only ever listed status='done'. Shared here so Home's banner
 * and History's active section can never drift out of sync on which
 * statuses count as "in progress".
 */
export const ACTIVE_MISSION_STATUSES = ["review", "confirmed", "assigned", "enroute", "arrived", "active"] as const;

export type ActiveMissionStatus = (typeof ACTIVE_MISSION_STATUSES)[number];
