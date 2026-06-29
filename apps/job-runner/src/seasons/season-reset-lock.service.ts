import { randomUUID } from "node:crypto";
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";

const SEASON_RESET_LOCK_TTL_SECONDS = 600;
const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

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

  async acquire(seasonId: string): Promise<string | null> {
    const token = `${this.config.WORKER_ROLE}:${randomUUID()}`;
    const result = await this.requireRedis().set(
      this.lockKey(seasonId),
      token,
      "EX",
      SEASON_RESET_LOCK_TTL_SECONDS,
      "NX",
    );

    return result === "OK" ? token : null;
  }

  async release(seasonId: string, token: string): Promise<void> {
    await this.requireRedis().eval(RELEASE_LOCK_SCRIPT, 1, this.lockKey(seasonId), token);
  }

  private requireRedis(): Redis {
    if (!this.redis) {
      throw new Error("Redis client is not connected");
    }

    return this.redis;
  }
}
