import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Redis from "ioredis-mock";
import { Logger } from "nestjs-pino";
import { MatchEventBus } from "../match-session/match-event-bus.js";
import { MatchSessionService } from "../match-session/match-session.service.js";
import { RedisService } from "../redis/redis.service.js";
import { MatchEndedPublisher } from "./match-ended-publisher.service.js";
import { MatchPlayService, PlayValidationError } from "./match-play.service.js";
import { MatchTimeoutSchedulerService } from "./match-timeout-scheduler.service.js";

describe("MatchPlayService", () => {
  let client: InstanceType<typeof Redis>;
  let redisService: RedisService;
  let matchSessionService: MatchSessionService;
  let eventBus: MatchEventBus;
  let service: MatchPlayService;
  let publishedJobs: unknown[];
  let matchTimeoutScheduler: {
    scheduleTimeout: jest.Mock;
    cancelTimeout: jest.Mock;
  };

  beforeEach(async () => {
    client = new Redis(`redis://match-play-test/${Date.now()}-${Math.random()}`);
    redisService = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(redisService, { client });

    eventBus = new MatchEventBus(redisService);
    matchSessionService = new MatchSessionService(redisService, eventBus);
    publishedJobs = [];

    const matchEndedPublisher = {
      publishMatchEnded: jest.fn(async (state) => {
        publishedJobs.push(state);
      }),
    } as unknown as MatchEndedPublisher;

    matchTimeoutScheduler = {
      scheduleTimeout: jest.fn(async () => "job-1"),
      cancelTimeout: jest.fn(async () => undefined),
    };

    const logger = { warn: jest.fn(), debug: jest.fn() } as unknown as Logger;

    service = new MatchPlayService(
      matchSessionService,
      eventBus,
      matchEndedPublisher,
      matchTimeoutScheduler as unknown as MatchTimeoutSchedulerService,
      logger,
    );

    await matchSessionService.create({
      matchId: "match-1",
      players: [
        { userId: "a", displayName: "Alice", rating: 1000 },
        { userId: "b", displayName: "Bob", rating: 1020 },
      ],
      now: new Date("2026-06-09T10:00:00.000Z"),
    });
  });

  it("stores a play without resolving until both players submit", async () => {
    await service.submitPlay({
      userId: "a",
      matchId: "match-1",
      roundNumber: 1,
      move: "rock",
    });

    const state = await matchSessionService.loadState("match-1");
    expect(state?.roundPlays.a).toBe("rock");
    expect(state?.roundPlays.b).toBeNull();
    expect(state?.status).toBe("WAITING_PLAYS");
  });

  it("resolves a round when both plays are received", async () => {
    await service.submitPlay({
      userId: "a",
      matchId: "match-1",
      roundNumber: 1,
      move: "rock",
    });
    await service.submitPlay({
      userId: "b",
      matchId: "match-1",
      roundNumber: 1,
      move: "scissors",
    });

    const state = await matchSessionService.loadState("match-1");
    expect(state?.scoreA).toBe(1);
    expect(state?.currentRound).toBe(2);
  });

  it("ends a BO3 match at 2-0", async () => {
    await service.submitPlay({ userId: "a", matchId: "match-1", roundNumber: 1, move: "rock" });
    await service.submitPlay({ userId: "b", matchId: "match-1", roundNumber: 1, move: "scissors" });
    await service.submitPlay({ userId: "a", matchId: "match-1", roundNumber: 2, move: "paper" });
    await service.submitPlay({ userId: "b", matchId: "match-1", roundNumber: 2, move: "rock" });

    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("ENDED");
    expect(state?.scoreA).toBe(2);
    expect(state?.winnerId).toBe("a");
    expect(publishedJobs).toHaveLength(1);
    expect(state?.rounds).toEqual([
      expect.objectContaining({ roundNumber: 1, moveA: "rock", moveB: "scissors", winner: "a" }),
      expect.objectContaining({ roundNumber: 2, moveA: "paper", moveB: "rock", winner: "a" }),
    ]);
    expect(await client.get("match:byUser:a")).toBeNull();
  });

  it("rejects invalid moves", async () => {
    await expect(
      service.submitPlay({
        userId: "a",
        matchId: "match-1",
        roundNumber: 1,
        move: "lizard",
      }),
    ).rejects.toBeInstanceOf(PlayValidationError);
  });

  it("rejects wrong round numbers", async () => {
    await expect(
      service.submitPlay({
        userId: "a",
        matchId: "match-1",
        roundNumber: 2,
        move: "rock",
      }),
    ).rejects.toMatchObject({ code: "WRONG_ROUND" });
  });

  it("publishes roundResolved exactly once per player on the event bus", async () => {
    const broadcastSpy = jest.spyOn(eventBus, "broadcastToMatch");

    await service.submitPlay({ userId: "a", matchId: "match-1", roundNumber: 1, move: "rock" });
    await service.submitPlay({ userId: "b", matchId: "match-1", roundNumber: 1, move: "scissors" });

    const roundResolvedCalls = broadcastSpy.mock.calls.filter(
      (call) => call[1] === "roundResolved",
    );
    expect(roundResolvedCalls).toHaveLength(2);
    expect(roundResolvedCalls.map((call) => call[3]?.recipientUserId).sort()).toEqual(["a", "b"]);

    broadcastSpy.mockRestore();
  });

  it("does not increment score on a draw", async () => {
    await service.submitPlay({ userId: "a", matchId: "match-1", roundNumber: 1, move: "rock" });
    await service.submitPlay({ userId: "b", matchId: "match-1", roundNumber: 1, move: "rock" });

    const state = await matchSessionService.loadState("match-1");
    expect(state?.scoreA).toBe(0);
    expect(state?.scoreB).toBe(0);
    expect(state?.currentRound).toBe(2);
  });

  it("does not mutate state when timeout fires after the round advanced", async () => {
    await service.submitPlay({ userId: "a", matchId: "match-1", roundNumber: 1, move: "rock" });
    await service.submitPlay({ userId: "b", matchId: "match-1", roundNumber: 1, move: "scissors" });

    await service.handleMatchTimeout("match-1", 1, "WAITING_PLAYS");

    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("WAITING_PLAYS");
    expect(state?.currentRound).toBe(2);
    expect(state?.scoreA).toBe(1);
  });

  it("forfeits the match when commit phase times out", async () => {
    await matchSessionService.mutateState("match-1", (state) => ({
      ...state,
      status: "WAITING_COMMITS",
      roundCommits: { a: "abc123", b: null },
    }));

    await service.handleMatchTimeout("match-1", 1, "WAITING_COMMITS");

    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("ENDED");
    expect(state?.winnerId).toBe("a");
    expect(state?.endReason).toBe("FORFEIT_TIMEOUT");
  });

  it("does not mutate state when commit timeout fires after phase advanced", async () => {
    await matchSessionService.mutateState("match-1", (state) => ({
      ...state,
      status: "WAITING_REVEALS",
      roundCommits: { a: "abc123", b: "def456" },
      roundReveals: { a: null, b: null },
      revealDeadline: "2026-06-09T10:00:10.000Z",
    }));

    await service.handleMatchTimeout("match-1", 1, "WAITING_COMMITS");

    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("WAITING_REVEALS");
  });

  it("forfeits the match when reveal phase times out", async () => {
    await matchSessionService.mutateState("match-1", (state) => ({
      ...state,
      status: "WAITING_REVEALS",
      roundCommits: { a: "abc123", b: "def456" },
      roundReveals: { a: "rock", b: null },
      revealDeadline: "2026-06-09T10:00:10.000Z",
    }));

    await service.handleMatchTimeout("match-1", 1, "WAITING_REVEALS");

    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("ENDED");
    expect(state?.winnerId).toBe("a");
    expect(state?.endReason).toBe("FORFEIT_TIMEOUT");
  });

  it("schedules commit phase timeout with expected state", async () => {
    await service.onCommitPhaseStarted({
      matchId: "match-1",
      currentRound: 1,
      roundDeadline: "2026-06-09T10:00:05.000Z",
    } as Parameters<MatchPlayService["onCommitPhaseStarted"]>[0]);

    expect(matchTimeoutScheduler.scheduleTimeout).toHaveBeenCalledWith(
      "match-1",
      1,
      "WAITING_COMMITS",
      expect.any(Number),
    );
  });

  it("schedules reveal timeout when reveal phase starts", async () => {
    await service.onRevealPhaseStarted({
      matchId: "match-1",
      currentRound: 1,
      revealDeadline: "2026-06-09T10:00:10.000Z",
      roundDeadline: "2026-06-09T10:00:05.000Z",
    } as Parameters<MatchPlayService["onRevealPhaseStarted"]>[0]);

    expect(matchTimeoutScheduler.scheduleTimeout).toHaveBeenCalledWith(
      "match-1",
      1,
      "WAITING_REVEALS",
      expect.any(Number),
    );
  });
});
