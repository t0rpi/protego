/**
 * Canonical `missions` status enum.
 * Source: docs/architecture/repository-audit.md §3.4 (mission state machine).
 *
 * M0 scope: the enum only, as the single source of truth other packages/
 * apps import from. Transition guards (which status can move to which,
 * and under what condition) land with the milestones that implement them
 * — M2 (booking → review/confirmed), M3 (agent accept/checklist gating),
 * M5 (payments capture on `done`). No logic here yet.
 */
export const MISSION_STATUSES = [
  "draft",
  "quoted",
  "review",
  "confirmed",
  "assigned",
  "enroute",
  "arrived",
  "active",
  "done",
  "cancelled_client",
  "cancelled_agent",
  "cancelled_dispatcher",
  "no_agent_available",
] as const;

export type MissionStatus = (typeof MISSION_STATUSES)[number];
