import { describe, expect, it, jest } from "@jest/globals";
import { SeasonResetLockService } from "./season-reset-lock.service.js";

describe("SeasonResetLockService", () => {
  it("builds a namespaced lock key per season", () => {
    const service = new SeasonResetLockService({
      BULLMQ_PREFIX: "rps",
      WORKER_ROLE: "cron",
    } as never);

    expect(service.lockKey("33333333-3333-4333-8333-333333333333")).toBe(
      "rps:lock:season-reset:33333333-3333-4333-8333-333333333333",
    );
  });

  it("acquires and releases the distributed lock", async () => {
    const redis = {
      set: jest.fn(async () => "OK"),
      eval: jest.fn(async () => 1),
      quit: jest.fn(async () => "OK"),
    };
    const service = new SeasonResetLockService({
      BULLMQ_PREFIX: "rps",
      WORKER_ROLE: "cron",
      REDIS_URL: "redis://localhost:6379",
    } as never);
    (service as never as { redis: typeof redis }).redis = redis;

    const token = await service.acquire("season-id");
    expect(token).toEqual(expect.stringMatching(/^cron:/));

    await service.release("season-id", token ?? "missing-token");

    expect(redis.set).toHaveBeenCalledWith(
      "rps:lock:season-reset:season-id",
      token,
      "EX",
      600,
      "NX",
    );
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("GET", KEYS[1]) == ARGV[1]'),
      1,
      "rps:lock:season-reset:season-id",
      token,
    );
  });

  it("returns null when the distributed lock is already held", async () => {
    const redis = {
      set: jest.fn(async () => null),
    };
    const service = new SeasonResetLockService({
      BULLMQ_PREFIX: "rps",
      WORKER_ROLE: "cron",
      REDIS_URL: "redis://localhost:6379",
    } as never);
    (service as never as { redis: typeof redis }).redis = redis;

    await expect(service.acquire("season-id")).resolves.toBeNull();
  });
});
