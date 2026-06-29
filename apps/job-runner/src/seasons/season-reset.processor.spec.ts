import { describe, expect, it, jest } from "@jest/globals";
import { type Job, UnrecoverableError } from "bullmq";
import { createSeasonResetProcessor } from "./season-reset.processor.js";

const validPayload = {
  seasonId: "33333333-3333-4333-8333-333333333333",
  source: "admin" as const,
};

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    name: "season-reset",
    data: validPayload,
    ...overrides,
  } as Job;
}

describe("createSeasonResetProcessor", () => {
  it("processes valid season-reset jobs and invalidates the leaderboard", async () => {
    const seasonReset = {
      processSeasonReset: jest.fn(async () => "processed"),
    };
    const redisInvalidation = {
      invalidateLeaderboard: jest.fn(async () => undefined),
    };
    const processor = createSeasonResetProcessor({
      seasonReset: seasonReset as never,
      redisInvalidation: redisInvalidation as never,
    });

    await processor(createJob());

    expect(seasonReset.processSeasonReset).toHaveBeenCalledWith(validPayload);
    expect(redisInvalidation.invalidateLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("invalidates leaderboard for idempotent replays", async () => {
    const seasonReset = {
      processSeasonReset: jest.fn(async () => "already_processed"),
    };
    const redisInvalidation = {
      invalidateLeaderboard: jest.fn(async () => undefined),
    };
    const processor = createSeasonResetProcessor({
      seasonReset: seasonReset as never,
      redisInvalidation: redisInvalidation as never,
    });

    await processor(createJob());

    expect(redisInvalidation.invalidateLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("skips leaderboard invalidation when no season needs processing", async () => {
    const seasonReset = {
      processSeasonReset: jest.fn(async () => "noop"),
    };
    const redisInvalidation = {
      invalidateLeaderboard: jest.fn(async () => undefined),
    };
    const processor = createSeasonResetProcessor({
      seasonReset: seasonReset as never,
      redisInvalidation: redisInvalidation as never,
    });

    await processor(createJob({ data: { source: "cron-scheduler" } }));

    expect(redisInvalidation.invalidateLeaderboard).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads without retry", async () => {
    const processor = createSeasonResetProcessor({
      seasonReset: { processSeasonReset: jest.fn() } as never,
      redisInvalidation: { invalidateLeaderboard: jest.fn() } as never,
    });

    await expect(processor(createJob({ data: { invalid: true } }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("rejects unsupported job names without retry", async () => {
    const processor = createSeasonResetProcessor({
      seasonReset: { processSeasonReset: jest.fn() } as never,
      redisInvalidation: { invalidateLeaderboard: jest.fn() } as never,
    });

    await expect(processor(createJob({ name: "other-job" }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("propagates service failures so BullMQ can retry", async () => {
    const error = new Error("database unavailable");
    const processor = createSeasonResetProcessor({
      seasonReset: {
        processSeasonReset: jest.fn(async () => {
          throw error;
        }),
      } as never,
      redisInvalidation: { invalidateLeaderboard: jest.fn() } as never,
    });

    await expect(processor(createJob())).rejects.toBe(error);
  });
});
