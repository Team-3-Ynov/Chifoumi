import { describe, expect, it, jest } from "@jest/globals";
import { GenerateBracketLockService } from "./generate-bracket-lock.service.js";

describe("GenerateBracketLockService", () => {
  it("builds a namespaced lock key per tournament", () => {
    const service = new GenerateBracketLockService({
      BULLMQ_PREFIX: "rps",
      WORKER_ROLE: "bracket-generator",
    } as never);

    expect(service.lockKey("44444444-4444-4444-8444-444444444444")).toBe(
      "rps:lock:generate-bracket:44444444-4444-4444-8444-444444444444",
    );
  });

  it("acquires and releases the distributed lock", async () => {
    const redis = {
      set: jest.fn(async () => "OK"),
      eval: jest.fn(async () => 1),
      quit: jest.fn(async () => "OK"),
    };
    const service = new GenerateBracketLockService({
      BULLMQ_PREFIX: "rps",
      WORKER_ROLE: "bracket-generator",
      REDIS_URL: "redis://localhost:6379",
    } as never);
    (service as never as { redis: typeof redis }).redis = redis;

    const token = await service.acquire("tournament-id");
    expect(token).toEqual(expect.stringMatching(/^bracket-generator:/));

    await service.release("tournament-id", token ?? "missing-token");

    expect(redis.set).toHaveBeenCalledWith(
      "rps:lock:generate-bracket:tournament-id",
      token,
      "EX",
      600,
      "NX",
    );
  });

  it("returns null when the distributed lock is already held", async () => {
    const redis = {
      set: jest.fn(async () => null),
    };
    const service = new GenerateBracketLockService({
      BULLMQ_PREFIX: "rps",
      WORKER_ROLE: "bracket-generator",
      REDIS_URL: "redis://localhost:6379",
    } as never);
    (service as never as { redis: typeof redis }).redis = redis;

    await expect(service.acquire("tournament-id")).resolves.toBeNull();
  });
});
