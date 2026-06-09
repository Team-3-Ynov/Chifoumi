import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";

export const LEADERBOARD_INVALIDATE_CHANNEL = "leaderboard:invalidate";

@Injectable()
export class RedisInvalidationService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(@Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig) {}

  onModuleInit(): void {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }
    this.client = new Redis(this.config.REDIS_URL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }

  async invalidateLeaderboard(): Promise<void> {
    await this.requireClient().publish(LEADERBOARD_INVALIDATE_CHANNEL, "*");
  }

  private requireClient(): Redis {
    if (!this.client) {
      throw new Error("Redis client is not connected");
    }
    return this.client;
  }
}
