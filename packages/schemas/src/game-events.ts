import { z } from "zod";

export const moveSchema = z.enum(["rock", "paper", "scissors"]);
export const roundWinnerSchema = z.enum(["a", "b", "draw"]);
export const matchEndReasonSchema = z.enum([
  "BEST_OF_3",
  "FORFEIT_TIMEOUT",
  "DISCONNECT_FORFEIT",
  "MAX_ROUNDS_DRAW",
]);

export const connectedPayloadSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
});

export const queueJoinedPayloadSchema = z.object({
  queuedAt: z.string().datetime(),
  currentRating: z.number().int(),
});

export const queueLeftPayloadSchema = z.object({}).strict();

export const matchFoundPayloadSchema = z.object({
  matchId: z.string().min(1),
  opponent: z.object({
    userId: z.string().min(1).optional(),
    displayName: z.string().min(1),
    rating: z.number().int(),
  }),
  bestOf: z.literal(3),
});

export const roundStartPayloadSchema = z.object({
  matchId: z.string().min(1),
  roundNumber: z.number().int().positive(),
  deadline: z.string().datetime(),
});

export const roundResolvedPayloadSchema = z.object({
  matchId: z.string().min(1),
  roundNumber: z.number().int().positive(),
  yourMove: moveSchema,
  theirMove: moveSchema,
  winner: roundWinnerSchema,
  scoreA: z.number().int().nonnegative(),
  scoreB: z.number().int().nonnegative(),
});

export const matchEndedPayloadSchema = z.object({
  matchId: z.string().min(1),
  winner: z.string().min(1).nullable(),
  finalScore: z.object({
    a: z.number().int().nonnegative(),
    b: z.number().int().nonnegative(),
  }),
  eloDelta: z.object({
    a: z.number().int(),
    b: z.number().int(),
  }),
  reason: matchEndReasonSchema.optional(),
});

export const matchResumedPayloadSchema = z.object({
  matchId: z.string().min(1),
  currentRound: z.number().int().positive(),
  scoreA: z.number().int().nonnegative(),
  scoreB: z.number().int().nonnegative(),
  currentState: z.literal("WAITING_PLAYS"),
  deadline: z.string().datetime(),
});

export const gameSocketErrorSchema = z.object({
  code: z.union([z.string(), z.number()]),
  message: z.string().min(1),
});

export const playPayloadSchema = z.object({
  matchId: z.string().min(1),
  roundNumber: z.number().int().positive(),
  move: moveSchema,
});

export type Move = z.infer<typeof moveSchema>;
export type ConnectedPayload = z.infer<typeof connectedPayloadSchema>;
export type QueueJoinedPayload = z.infer<typeof queueJoinedPayloadSchema>;
export type MatchFoundPayload = z.infer<typeof matchFoundPayloadSchema>;
export type RoundStartPayload = z.infer<typeof roundStartPayloadSchema>;
export type RoundResolvedPayload = z.infer<typeof roundResolvedPayloadSchema>;
export type MatchEndedPayload = z.infer<typeof matchEndedPayloadSchema>;
export type MatchResumedPayload = z.infer<typeof matchResumedPayloadSchema>;
export type GameSocketError = z.infer<typeof gameSocketErrorSchema>;
export type PlayPayload = z.infer<typeof playPayloadSchema>;
