import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";

const USER_SOCKET_TTL_SECONDS = 3600;

const REMOVE_USER_SOCKET_IF_MATCH_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

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
    subscriber.on("message", (receivedChannel: string, message: string) => {
      if (receivedChannel === channel) {
        handler(message);
      }
    });
    await subscriber.subscribe(channel);
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
    await this.requireClient().eval(REMOVE_USER_SOCKET_IF_MATCH_SCRIPT, 1, key, socketId);
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

  private requireSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error("Redis subscriber is not connected");
    }
    return this.subscriber;
  }
}
