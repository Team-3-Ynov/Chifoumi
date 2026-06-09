import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CONFIG, type RedisConfig } from "../config/redis.config.js";

const USER_SOCKET_TTL_SECONDS = 3600;

export type RedisQueueEntry = {
  userId: string;
  rating: number;
};

const REMOVE_USER_SOCKET_IF_MATCH_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

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
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
    await this.client?.quit();
  }

  getClient(): Redis {
    return this.requireClient();
  }

  createSubscriber(): Redis {
    return new Redis(this.redisConfig.url);
  }

  async get(key: string): Promise<string | null> {
    return (await this.requireClient().get(key)) ?? null;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.requireClient().setex(key, ttlSeconds, value);
  }

  async setnx(key: string, ttlSeconds: number, value = "1"): Promise<boolean> {
    const result = await this.requireClient().set(key, value, "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async del(key: string): Promise<void> {
    await this.requireClient().del(key);
  }

  async hset(key: string, values: Record<string, string>): Promise<void> {
    await this.requireClient().hset(key, values);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.requireClient().hgetall(key);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.requireClient().zadd(key, score, member);
  }

  async zrem(key: string, member: string): Promise<void> {
    await this.requireClient().zrem(key, member);
  }

  async zcard(key: string): Promise<number> {
    return this.requireClient().zcard(key);
  }

  async zrangeWithScores(key: string): Promise<RedisQueueEntry[]> {
    const entries = await this.requireClient().zrange(key, 0, -1, "WITHSCORES");
    const result: RedisQueueEntry[] = [];

    for (let index = 0; index < entries.length; index += 2) {
      const userId = entries[index];
      const rating = entries[index + 1];
      if (userId && rating) {
        result.push({ userId, rating: Number.parseFloat(rating) });
      }
    }

    return result;
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    return this.requireClient().zrangebyscore(key, min, max);
  }

  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const client = this.requireClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }
    return count;
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.requireClient().publish(channel, message);
  }

  async subscribe(channel: string, listener: (message: string) => void): Promise<Redis> {
    const subscriber = this.createSubscriber();
    await subscriber.subscribe(channel);
    subscriber.on("message", (receivedChannel, message) => {
      if (receivedChannel === channel) {
        listener(message);
      }
    });
    this.subscriber = subscriber;
    return subscriber;
  }

  async evalScript<T>(script: string, keys: string[], args: string[]): Promise<T> {
    return this.requireClient().eval(script, keys.length, ...keys, ...args) as Promise<T>;
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
}
