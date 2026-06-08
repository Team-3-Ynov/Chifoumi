export const REDIS_CONFIG = Symbol("REDIS_CONFIG");

export type RedisConfig = {
  url: string;
};

export function loadRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required");
  }
  return { url };
}
