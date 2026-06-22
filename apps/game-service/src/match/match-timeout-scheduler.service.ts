import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";
import { RedisService } from "../redis/redis.service.js";
import {
  MATCH_TIMEOUT_JOB_NAME,
  MATCH_TIMEOUT_JOB_TTL_SECONDS,
  MATCH_TIMEOUT_QUEUE,
  matchTimeoutJobKey,
} from "./match-timeout.constants.js";
import type { MatchTimeoutExpectedState } from "./match-timeout.types.js";

@Injectable()
export class MatchTimeoutSchedulerService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(
    @Inject(REDIS_CONFIG) private readonly redisConfig: RedisConfig,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit(): void {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    const prefix = process.env.BULLMQ_PREFIX ?? "rps";
    this.queue = new Queue(MATCH_TIMEOUT_QUEUE, {
      connection: { url: this.redisConfig.url },
      prefix,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async scheduleTimeout(
    matchId: string,
    roundNumber: number,
    expectedState: MatchTimeoutExpectedState,
    delayMs: number,
  ): Promise<string | null> {
    await this.cancelTimeout(matchId);

    if (!this.queue) {
      return null;
    }

    const job = await this.queue.add(
      MATCH_TIMEOUT_JOB_NAME,
      { matchId, roundNumber, expectedState },
      {
        delay: Math.max(0, delayMs),
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    if (!job.id) {
      return null;
    }

    await this.redisService.setex(
      matchTimeoutJobKey(matchId),
      MATCH_TIMEOUT_JOB_TTL_SECONDS,
      job.id,
    );

    return job.id;
  }

  async cancelTimeout(matchId: string): Promise<void> {
    const jobId = await this.redisService.get(matchTimeoutJobKey(matchId));
    if (!jobId) {
      return;
    }

    if (this.queue) {
      const job = await this.queue.getJob(jobId);
      if (job) {
        try {
          await job.remove();
        } catch {
          // Job may already be active or completed.
        }
      }
    }

    await this.redisService.del(matchTimeoutJobKey(matchId));
  }
}
