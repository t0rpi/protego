/**
 * repository-audit.md §5.1 — Realtime Broadcast cadence (high-frequency,
 * ephemeral, never written to the DB per-ping) vs. the much coarser
 * cadence mission_tracking is actually persisted at (downsampled, for
 * audit/report — supabase/migrations/20260731120001_mission_tracking.sql).
 */
export const TRACKING_BROADCAST_INTERVAL_SECONDS = 4 as const; // audit range: 3-5s
export const TRACKING_PERSIST_INTERVAL_SECONDS = 20 as const; // audit range: 15-30s

export const TRACKING_STATUS_LATENCY_TARGET_P95_MS = 1000 as const;
export const TRACKING_POSITION_LATENCY_TARGET_P95_MS = 2000 as const;
