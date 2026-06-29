import { beforeEach, describe, expect, it } from "@jest/globals";
import Redis from "ioredis-mock";
import { RedisService } from "../redis/redis.service.js";
import {
  MATCHMAKING_QUEUE_KEY,
  matchByUserKey,
  matchmakingMetaKey,
} from "./matchmaking.constants.js";
import { MatchmakingService } from "./matchmaking.service.js";
import { RatingService } from "./rating.service.js";

describe("MatchmakingService", () => {
  let client: InstanceType<typeof Redis>;
  let service: MatchmakingService;

  beforeEach(() => {
    client = new Redis(`redis://matchmaking-service-test/${Date.now()}-${Math.random()}`);
    const redisService = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(redisService, { client });
    service = new MatchmakingService(redisService, new RatingService(redisService));
  });

  it("enqueues a player and returns queue metadata", async () => {
    const result = await service.joinQueue("user-enqueue", "Ace");

    expect(result).toEqual({
      ok: true,
      queuedAt: expect.any(Number),
      currentRating: 1000,
    });
    expect(await client.zscore(MATCHMAKING_QUEUE_KEY, "user-enqueue")).toBe("1000");
    expect(await client.hget(matchmakingMetaKey("user-enqueue"), "displayName")).toBe("Ace");
  });

  it("rejects duplicate joinQueue with ALREADY_IN_QUEUE", async () => {
    await service.joinQueue("user-dup", "Ace");
    const result = await service.joinQueue("user-dup", "Ace");

    expect(result).toEqual({ ok: false, code: "ALREADY_IN_QUEUE" });
  });

  it("rejects joinQueue when the player is already in a match", async () => {
    await client.set(matchByUserKey("user-in-match"), "match-123");

    const result = await service.joinQueue("user-in-match", "Ace");

    expect(result).toEqual({ ok: false, code: "ALREADY_IN_MATCH" });
  });

  it("rate limits joinQueue to one call per second", async () => {
    const first = await service.joinQueue("user-rate", "Ace");
    expect(first).toEqual({
      ok: true,
      queuedAt: expect.any(Number),
      currentRating: 1000,
    });
    await service.leaveQueue("user-rate");

    const second = await service.joinQueue("user-rate", "Ace");
    expect(second).toEqual({ ok: false, code: "RATE_LIMITED" });
  });

  it("removes a player from the queue on leaveQueue", async () => {
    const joined = await service.joinQueue("user-leave", "Ace");
    expect(joined.ok).toBe(true);

    const removed = await service.leaveQueue("user-leave");

    expect(removed).toBe(true);
    expect(await client.zscore(MATCHMAKING_QUEUE_KEY, "user-leave")).toBeNull();
  });
});
