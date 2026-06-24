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
      del: jest.fn(async () => 1),
      quit: jest.fn(async () => "OK"),
    };
    const service = new SeasonResetLockService({
      BULLMQ_PREFIX: "rps",
      WORKER_ROLE: "cron",
      REDIS_URL: "redis://localhost:6379",
    } as never);
    (service as never as { redis: typeof redis }).redis = redis;

    await expect(service.acquire("season-id")).resolves.toBe(true);
    await service.release("season-id");

    expect(redis.set).toHaveBeenCalledWith(
      "rps:lock:season-reset:season-id",
      "cron",
      "EX",
      600,
      "NX",
    );
    expect(redis.del).toHaveBeenCalledWith("rps:lock:season-reset:season-id");
  });
});
