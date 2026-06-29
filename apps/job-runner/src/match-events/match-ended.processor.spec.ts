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

function createTournamentProgression(): {
  processMatchEnded: () => Promise<"not_tournament_match">;
} {
  return {
    processMatchEnded: jest.fn(async (): Promise<"not_tournament_match"> => "not_tournament_match"),
  };
}

describe("createMatchEndedProcessor", () => {
  it("persists valid match-ended jobs and invalidates the leaderboard", async () => {
    const matchPersistence = {
      persistMatchEnded: jest.fn(async () => "created"),
    };
    const redisInvalidation = {
      invalidateLeaderboard: jest.fn(async () => undefined),
    };
    const tournamentProgression = {
      processMatchEnded: jest.fn(async () => "not_tournament_match"),
    };
    const processor = createMatchEndedProcessor({
      matchPersistence: matchPersistence as never,
      redisInvalidation: redisInvalidation as never,
      tournamentProgression: tournamentProgression as never,
    });

    await processor(createJob());

    expect(matchPersistence.persistMatchEnded).toHaveBeenCalledWith(validPayload);
    expect(redisInvalidation.invalidateLeaderboard).toHaveBeenCalledTimes(1);
    expect(tournamentProgression.processMatchEnded).toHaveBeenCalledWith({
      matchId: validPayload.matchId,
      winnerId: validPayload.winner,
      tournamentMatchId: undefined,
    });
  });

  it("invalidates leaderboard for idempotent replays", async () => {
    const matchPersistence = {
      persistMatchEnded: jest.fn(async () => "already_exists"),
    };
    const redisInvalidation = {
      invalidateLeaderboard: jest.fn(async () => undefined),
    };
    const processor = createMatchEndedProcessor({
      matchPersistence: matchPersistence as never,
      redisInvalidation: redisInvalidation as never,
      tournamentProgression: createTournamentProgression() as never,
    });

    await processor(createJob());

    expect(redisInvalidation.invalidateLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid payloads without retry", async () => {
    const processor = createMatchEndedProcessor({
      matchPersistence: { persistMatchEnded: jest.fn() } as never,
      redisInvalidation: { invalidateLeaderboard: jest.fn() } as never,
      tournamentProgression: createTournamentProgression() as never,
    });

    await expect(processor(createJob({ data: { invalid: true } }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("rejects payloads whose winner is not a match player without retry", async () => {
    const processor = createMatchEndedProcessor({
      matchPersistence: { persistMatchEnded: jest.fn() } as never,
      redisInvalidation: { invalidateLeaderboard: jest.fn() } as never,
      tournamentProgression: createTournamentProgression() as never,
    });

    await expect(
      processor(
        createJob({
          data: {
            ...validPayload,
            winner: "44444444-4444-4444-8444-444444444444",
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it("propagates persistence failures so BullMQ can retry", async () => {
    const error = new Error("database unavailable");
    const processor = createMatchEndedProcessor({
      matchPersistence: {
        persistMatchEnded: jest.fn(async () => {
          throw error;
        }),
      } as never,
      redisInvalidation: { invalidateLeaderboard: jest.fn() } as never,
      tournamentProgression: createTournamentProgression() as never,
    });

    await expect(processor(createJob())).rejects.toBe(error);
  });
});
