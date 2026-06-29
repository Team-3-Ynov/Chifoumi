import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(@Inject(REDIS_CONFIG) private readonly redisConfig: RedisConfig) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === "true") {
      return;
    }

    this.client = new Redis(this.redisConfig.url);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  async get(key: string): Promise<string | null> {
    return (await this.requireClient().get(key)) ?? null;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.requireClient().setex(key, ttlSeconds, value);
  }

  async setnx(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.requireClient().set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async del(key: string): Promise<void> {
    await this.requireClient().del(key);
  }

  async revokeAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.requireClient().set(`blacklist:jwt:${jti}`, "1", "EX", ttlSeconds);
  }

  async isAccessTokenRevoked(jti: string): Promise<boolean> {
    const value = await this.requireClient().get(`blacklist:jwt:${jti}`);
    return value === "1";
  }

  private requireClient(): Redis {
    if (!this.client) {
      throw new Error("Redis client is not connected");
    }
    return this.client;
  }
}
