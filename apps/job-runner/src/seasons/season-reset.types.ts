import { z } from "zod";

export const seasonResetPayloadSchema = z.object({
  seasonId: z.string().uuid().optional(),
  source: z.enum(["admin", "cron-scheduler"]),
});

export type SeasonResetPayload = z.infer<typeof seasonResetPayloadSchema>;

export type SeasonResetResult = "processed" | "already_processed" | "noop";
