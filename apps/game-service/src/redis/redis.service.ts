import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";

const USER_SOCKET_TTL_SECONDS = 3600;

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

  async isAccessTokenRevoked(jti: string): Promise<boolean> {
    const value = await this.requireClient().get(`blacklist:jwt:${jti}`);
    return value === "1";
  }

  async revokeAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.requireClient().set(`blacklist:jwt:${jti}`, "1", "EX", ttlSeconds);
  }

  async setUserSocket(userId: string, socketId: string): Promise<void> {
    await this.requireClient().set(
      `ws:user:${userId}:socket`,
      socketId,
      "EX",
      USER_SOCKET_TTL_SECONDS,
    );
  }

  async removeUserSocket(userId: string, socketId: string): Promise<void> {
    const key = `ws:user:${userId}:socket`;
    const current = await this.requireClient().get(key);
    if (current === socketId) {
      await this.requireClient().del(key);
    }
  }

  async getUserSocket(userId: string): Promise<string | null> {
    return (await this.requireClient().get(`ws:user:${userId}:socket`)) ?? null;
  }

  private requireClient(): Redis {
    if (!this.client) {
      throw new Error("Redis client is not connected");
    }
    return this.client;
  }
}
