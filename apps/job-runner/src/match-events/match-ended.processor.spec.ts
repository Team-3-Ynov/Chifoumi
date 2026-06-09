import { describe, expect, it, jest } from "@jest/globals";
import { type Job, UnrecoverableError } from "bullmq";
import { createMatchEndedProcessor } from "./match-ended.processor.js";

const validPayload = {
  matchId: "33333333-3333-4333-8333-333333333333",
  players: [
    { userId: "11111111-1111-4111-8111-111111111111", displayName: "alice", rating: 1000 },
    { userId: "22222222-2222-4222-8222-222222222222", displayName: "bob", rating: 1000 },
  ],
  rounds: [
    {
      roundNumber: 1,
      moveA: "rock",
      moveB: "scissors",
      winner: "a",
      resolvedAt: "2026-06-09T10:00:01.000Z",
    },
  ],
  winner: "11111111-1111-4111-8111-111111111111",
  finalScore: { a: 2, b: 0 },
  startedAt: "2026-06-09T10:00:00.000Z",
};

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    name: "match-ended",
    data: validPayload,
    ...overrides,
  } as Job;
}

describe("createMatchEndedProcessor", () => {
  it("persists valid match-ended jobs and invalidates the leaderboard", async () => {
    const matchPersistence = {
      persistMatchEnded: jest.fn(async () => true),
    };
    const redisInvalidation = {
      invalidateLeaderboard: jest.fn(async () => undefined),
    };
    const processor = createMatchEndedProcessor({
      matchPersistence: matchPersistence as never,
      redisInvalidation: redisInvalidation as never,
    });

    await processor(createJob());

    expect(matchPersistence.persistMatchEnded).toHaveBeenCalledWith(validPayload);
    expect(redisInvalidation.invalidateLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate leaderboard for idempotent replays", async () => {
    const matchPersistence = {
      persistMatchEnded: jest.fn(async () => false),
    };
    const redisInvalidation = {
      invalidateLeaderboard: jest.fn(async () => undefined),
    };
    const processor = createMatchEndedProcessor({
      matchPersistence: matchPersistence as never,
      redisInvalidation: redisInvalidation as never,
    });

    await processor(createJob());

    expect(redisInvalidation.invalidateLeaderboard).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads without retry", async () => {
    const processor = createMatchEndedProcessor({
      matchPersistence: { persistMatchEnded: jest.fn() } as never,
      redisInvalidation: { invalidateLeaderboard: jest.fn() } as never,
    });

    await expect(processor(createJob({ data: { invalid: true } }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});
