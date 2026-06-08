import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";

export const LEADERBOARD_INVALIDATE_CHANNEL = "leaderboard:invalidate";
export const LEADERBOARD_CACHE_KEY_PREFIX = "leaderboard:top:";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;

  constructor(@Inject(REDIS_CONFIG) private readonly redisConfig: RedisConfig) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.client = new Redis(this.redisConfig.url);
    this.subscriber = new Redis(this.redisConfig.url);
    await this.subscriber.subscribe(LEADERBOARD_INVALIDATE_CHANNEL);
    this.subscriber.on("message", (channel: string) => {
      if (channel === LEADERBOARD_INVALIDATE_CHANNEL) {
        void this.invalidateLeaderboardCache();
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
    await this.client?.quit();
  }

  async get(key: string): Promise<string | null> {
    return (await this.requireClient().get(key)) ?? null;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.requireClient().setex(key, ttlSeconds, value);
  }

  async invalidateLeaderboardCache(): Promise<void> {
    const client = this.requireClient();
    const keys = await client.keys(`${LEADERBOARD_CACHE_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  private requireClient(): Redis {
    if (!this.client) {
      throw new Error("Redis client is not connected");
    }
    return this.client;
  }
}
