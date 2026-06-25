import { randomUUID } from "node:crypto";
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";

const GENERATE_BRACKET_LOCK_TTL_SECONDS = 600;
const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

@Injectable()
export class GenerateBracketLockService implements OnModuleInit, OnModuleDestroy {
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

  lockKey(tournamentId: string): string {
    return `${this.config.BULLMQ_PREFIX}:lock:generate-bracket:${tournamentId}`;
  }

  async acquire(tournamentId: string): Promise<string | null> {
    const token = `${this.config.WORKER_ROLE}:${randomUUID()}`;
    const result = await this.requireRedis().set(
      this.lockKey(tournamentId),
      token,
      "EX",
      GENERATE_BRACKET_LOCK_TTL_SECONDS,
      "NX",
    );

    return result === "OK" ? token : null;
  }

  async release(tournamentId: string, token: string): Promise<void> {
    await this.requireRedis().eval(RELEASE_LOCK_SCRIPT, 1, this.lockKey(tournamentId), token);
  }

  private requireRedis(): Redis {
    if (!this.redis) {
      throw new Error("Redis client is not connected");
    }

    return this.redis;
  }
}
