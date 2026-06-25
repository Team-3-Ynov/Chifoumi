import { z } from "zod";

export const generateBracketPayloadSchema = z.object({
  tournamentId: z.string().uuid(),
});

export type GenerateBracketPayload = z.infer<typeof generateBracketPayloadSchema>;

export type GenerateBracketResult = "generated" | "already_generated" | "noop";
