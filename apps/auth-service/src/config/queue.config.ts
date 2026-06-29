export const QUEUE_CONFIG = Symbol("QUEUE_CONFIG");

export type QueueConfig = {
  redisUrl: string;
  bullmqPrefix: string;
};

export function loadQueueConfig(): QueueConfig {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required");
  }

  return {
    redisUrl,
    bullmqPrefix: process.env.BULLMQ_PREFIX ?? "rps",
  };
}
