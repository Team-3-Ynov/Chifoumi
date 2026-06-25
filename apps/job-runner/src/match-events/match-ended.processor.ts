import { type Job, UnrecoverableError } from "bullmq";
import { z } from "zod";
import type { MatchPersistenceService } from "../persistence/match-persistence.service.js";
import type { RedisInvalidationService } from "../redis/redis-invalidation.service.js";
import type { TournamentProgressionService } from "../tournaments/tournament-progression.service.js";
import type { WorkerProcessor } from "../workers/worker-processors.js";
import type { MatchEndedPayload } from "./match-ended.types.js";

const moveSchema = z.enum(["rock", "paper", "scissors"]).nullable();
const roundWinnerSchema = z.enum(["a", "b", "draw"]);

const matchEndedPayloadSchema = z
  .object({
    matchId: z.string().uuid(),
    tournamentMatchId: z.string().uuid().optional(),
    players: z.tuple([
      z.object({
        userId: z.string().uuid(),
        displayName: z.string(),
        rating: z.number(),
      }),
      z.object({
        userId: z.string().uuid(),
        displayName: z.string(),
        rating: z.number(),
      }),
    ]),
    rounds: z.array(
      z.object({
        roundNumber: z.number().int().positive(),
        moveA: moveSchema,
        moveB: moveSchema,
        winner: roundWinnerSchema,
        resolvedAt: z.string().datetime(),
      }),
    ),
    winner: z.string().uuid().nullable(),
    finalScore: z.object({
      a: z.number().int().nonnegative(),
      b: z.number().int().nonnegative(),
    }),
    startedAt: z.string().datetime(),
  })
  .refine(
    (payload) =>
      payload.winner === null ||
      payload.winner === payload.players[0].userId ||
      payload.winner === payload.players[1].userId,
    {
      message: "winner must be null or one of the match players",
      path: ["winner"],
    },
  );

export type MatchEventsProcessorDependencies = {
  matchPersistence: MatchPersistenceService;
  redisInvalidation: RedisInvalidationService;
  tournamentProgression: TournamentProgressionService;
};

export function createMatchEndedProcessor(deps: MatchEventsProcessorDependencies): WorkerProcessor {
  return async (job: Job) => {
    if (job.name !== "match-ended") {
      throw new UnrecoverableError(`Unsupported job name on match-events: ${job.name}`);
    }

    const parsed = matchEndedPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError("Invalid match-ended job payload");
    }

    const persistenceStatus = await deps.matchPersistence.persistMatchEnded(
      parsed.data as MatchEndedPayload,
    );
    if (persistenceStatus === "created" || persistenceStatus === "already_exists") {
      await deps.redisInvalidation.invalidateLeaderboard();
    }

    await deps.tournamentProgression.processMatchEnded({
      matchId: parsed.data.matchId,
      winnerId: parsed.data.winner,
      tournamentMatchId: parsed.data.tournamentMatchId,
    });
  };
}
