import { z } from "zod";
import { MISSION_STATUSES } from "@protego/domain";

/**
 * zod mirror of the canonical mission status enum (@protego/domain).
 * M0 scope: schema only, no request/response schemas for booking/payments
 * yet — those land with M2/M5.
 */
export const missionStatusSchema = z.enum(MISSION_STATUSES);
