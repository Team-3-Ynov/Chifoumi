import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";

const SEASON_RESET_LOCK_TTL_SECONDS = 600;

@Injectable()
export class SeasonResetLockService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;

  constructor(@Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig) {}

  onModuleInit(): void {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.redis = new Redis(this.config.REDIS_URL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
    this.redis = null;
  }

  lockKey(seasonId: string): string {
    return `${this.config.BULLMQ_PREFIX}:lock:season-reset:${seasonId}`;
  }

  async acquire(seasonId: string): Promise<boolean> {
    const result = await this.requireRedis().set(
      this.lockKey(seasonId),
      this.config.WORKER_ROLE,
      "EX",
      SEASON_RESET_LOCK_TTL_SECONDS,
      "NX",
    );

    return result === "OK";
  }

  async release(seasonId: string): Promise<void> {
    await this.requireRedis().del(this.lockKey(seasonId));
  }

  private requireRedis(): Redis {
    if (!this.redis) {
      throw new Error("Redis client is not connected");
    }

    return this.redis;
  }
}
