import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";

export type RedisMessageHandler = (message: string) => void;

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
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
    await this.client?.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.requireClient().get(key);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.requireClient().set(key, value, "EX", ttlSeconds);
  }

  async setnx(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    const result = await this.requireClient().set(key, value, "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async del(key: string): Promise<void> {
    await this.requireClient().del(key);
  }

  async publish(channel: string, payload: string): Promise<void> {
    await this.requireClient().publish(channel, payload);
  }

  async subscribe(channel: string, handler: RedisMessageHandler): Promise<void> {
    const subscriber = this.requireSubscriber();
    subscriber.on("message", (receivedChannel, message) => {
      if (receivedChannel === channel) {
        handler(message);
      }
    });
    await subscriber.subscribe(channel);
  }

  private requireClient(): Redis {
    if (!this.client) {
      throw new Error("Redis client is not connected");
    }
    return this.client;
  }

  private requireSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error("Redis subscriber is not connected");
    }
    return this.subscriber;
  }
}
