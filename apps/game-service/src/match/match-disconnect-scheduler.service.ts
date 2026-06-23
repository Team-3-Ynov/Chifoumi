import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";
import { RedisService } from "../redis/redis.service.js";
import {
  MATCH_DISCONNECT_FORFEIT_FAILED_JOBS_RETAINED,
  MATCH_DISCONNECT_FORFEIT_JOB_ATTEMPTS,
  MATCH_DISCONNECT_FORFEIT_JOB_BACKOFF_MS,
  MATCH_DISCONNECT_FORFEIT_JOB_NAME,
  MATCH_DISCONNECT_FORFEIT_JOB_TTL_SECONDS,
  MATCH_DISCONNECT_FORFEIT_QUEUE,
  MATCH_DISCONNECT_FORFEIT_WINDOW_MS,
  matchDisconnectForfeitJobKey,
} from "./match-disconnect.constants.js";

@Injectable()
export class MatchDisconnectSchedulerService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(
    @Inject(REDIS_CONFIG) private readonly redisConfig: RedisConfig,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  onModuleInit(): void {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    const prefix = process.env.BULLMQ_PREFIX ?? "rps";
    this.queue = new Queue(MATCH_DISCONNECT_FORFEIT_QUEUE, {
      connection: { url: this.redisConfig.url },
      prefix,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async scheduleForfeit(
    userId: string,
    matchId: string,
    delayMs = MATCH_DISCONNECT_FORFEIT_WINDOW_MS,
  ): Promise<string | null> {
    await this.cancelForfeit(userId);

    if (!this.queue) {
      return null;
    }

    const job = await this.queue.add(
      MATCH_DISCONNECT_FORFEIT_JOB_NAME,
      { userId, matchId },
      {
        delay: Math.max(0, delayMs),
        attempts: MATCH_DISCONNECT_FORFEIT_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: MATCH_DISCONNECT_FORFEIT_JOB_BACKOFF_MS,
        },
        removeOnComplete: true,
        removeOnFail: MATCH_DISCONNECT_FORFEIT_FAILED_JOBS_RETAINED,
      },
    );

    if (!job.id) {
      return null;
    }

    await this.redisService.setex(
      matchDisconnectForfeitJobKey(userId),
      MATCH_DISCONNECT_FORFEIT_JOB_TTL_SECONDS,
      job.id,
    );

    return job.id;
  }

  async cancelForfeit(userId: string): Promise<void> {
    const jobId = await this.redisService.get(matchDisconnectForfeitJobKey(userId));
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

    await this.redisService.del(matchDisconnectForfeitJobKey(userId));
  }

  async cancelForfeitForPlayers(userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((userId) => this.cancelForfeit(userId)));
  }
}
