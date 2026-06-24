import { type Job, UnrecoverableError } from "bullmq";
import type { RedisInvalidationService } from "../redis/redis-invalidation.service.js";
import type { WorkerProcessor } from "../workers/worker-processors.js";
import type { SeasonResetService } from "./season-reset.service.js";
import { seasonResetPayloadSchema } from "./season-reset.types.js";

export type SeasonResetProcessorDependencies = {
  seasonReset: SeasonResetService;
  redisInvalidation: RedisInvalidationService;
};

export function createSeasonResetProcessor(
  deps: SeasonResetProcessorDependencies,
): WorkerProcessor {
  return async (job: Job) => {
    if (job.name !== "season-reset") {
      throw new UnrecoverableError(`Unsupported job name on seasons: ${job.name}`);
    }

    const parsed = seasonResetPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError("Invalid season-reset job payload");
    }

    const result = await deps.seasonReset.processSeasonReset(parsed.data);
    if (result === "noop") {
      return;
    }

    await deps.redisInvalidation.invalidateLeaderboard();
  };
}
