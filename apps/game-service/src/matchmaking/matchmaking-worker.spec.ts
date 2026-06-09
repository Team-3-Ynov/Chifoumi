import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Redis from "ioredis-mock";
import { Logger } from "nestjs-pino";
import { RedisService } from "../redis/redis.service.js";
import { MatchSessionService } from "./match-session.service.js";
import {
  MATCHMAKING_QUEUE_KEY,
  matchByUserKey,
  matchmakingMetaKey,
  matchmakingPairLockKey,
  USER_RATING_PREFIX,
} from "./matchmaking.constants.js";
import { MatchmakingService } from "./matchmaking.service.js";
import { MatchmakingMetricsService } from "./matchmaking-metrics.service.js";
import { MatchmakingWorkerService } from "./matchmaking-worker.service.js";
import { RatingService } from "./rating.service.js";

function createWorker(redisService: RedisService): MatchmakingWorkerService {
  const ratingService = new RatingService(redisService);
  const matchmakingService = new MatchmakingService(redisService, ratingService);
  const matchSessionService = new MatchSessionService(redisService);
  const metricsService = new MatchmakingMetricsService();
  const logger = { log: jest.fn() } as unknown as Logger;

  return new MatchmakingWorkerService(
    redisService,
    matchmakingService,
    matchSessionService,
    metricsService,
    logger,
  );
}

async function seedQueueMember(
  client: InstanceType<typeof Redis>,
  userId: string,
  rating: number,
  displayName: string,
  queuedAt: number,
): Promise<void> {
  await client.set(`${USER_RATING_PREFIX}${userId}`, String(rating));
  await client.zadd(MATCHMAKING_QUEUE_KEY, rating, userId);
  await client.hset(matchmakingMetaKey(userId), {
    userId,
    rating: String(rating),
    displayName,
    queuedAt: String(queuedAt),
  });
}

describe("MatchmakingWorkerService", () => {
  let client: InstanceType<typeof Redis>;
  let redisService: RedisService;
  let worker: MatchmakingWorkerService;

  beforeEach(() => {
    client = new Redis(`redis://matchmaking-worker-test/${Date.now()}-${Math.random()}`);
    redisService = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(redisService, { client });
    worker = createWorker(redisService);
  });

  it("pairs players within the initial ±50 rating window", async () => {
    const now = Date.now();
    await seedQueueMember(client, "player-a", 1000, "Ace", now);
    await seedQueueMember(client, "player-b", 1040, "Bob", now);

    const matches = await worker.tick(now + 100);

    expect(matches).toBe(1);
    expect(await client.zcard(MATCHMAKING_QUEUE_KEY)).toBe(0);
    expect(await client.get(matchByUserKey("player-a"))).not.toBeNull();
    expect(await client.get(matchByUserKey("player-b"))).not.toBeNull();
  });

  it("does not pair players outside the current ELO window", async () => {
    const now = Date.now();
    await seedQueueMember(client, "player-a", 1000, "Ace", now);
    await seedQueueMember(client, "player-b", 1100, "Bob", now);

    const matches = await worker.tick(now + 100);

    expect(matches).toBe(0);
    expect(await client.zcard(MATCHMAKING_QUEUE_KEY)).toBe(2);
  });

  it("widens the ELO window after 10 seconds", async () => {
    const now = Date.now();
    await seedQueueMember(client, "player-a", 1000, "Ace", now);
    await seedQueueMember(client, "player-b", 1090, "Bob", now);

    const matches = await worker.tick(now + 10_500);

    expect(matches).toBe(1);
  });

  it("allows only one worker to commit the same pair", async () => {
    const now = Date.now();
    await seedQueueMember(client, "player-a", 1000, "Ace", now);
    await seedQueueMember(client, "player-b", 1020, "Bob", now);

    const workerB = createWorker(redisService);
    const [first, second] = await Promise.all([worker.tick(now + 100), workerB.tick(now + 100)]);

    expect(first + second).toBe(1);
    expect(await client.zcard(MATCHMAKING_QUEUE_KEY)).toBe(0);
    expect(await client.exists(matchmakingPairLockKey("player-a", "player-b"))).toBe(0);
  });
});
