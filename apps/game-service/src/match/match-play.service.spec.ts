import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Redis from "ioredis-mock";
import { Logger } from "nestjs-pino";
import { MatchEventBus } from "../match-session/match-event-bus.js";
import { MatchSessionService } from "../match-session/match-session.service.js";
import { MatchmakingMetricsService } from "../matchmaking/matchmaking-metrics.service.js";
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
  let matchEndedPublisher: {
    publishMatchEnded: jest.MockedFunction<MatchEndedPublisher["publishMatchEnded"]>;
  };
  let matchTimeoutScheduler: {
    scheduleTimeout: jest.Mock;
    cancelTimeout: jest.Mock;
  };
  let metrics: {
    recordMatchPlayed: jest.Mock;
  };

  beforeEach(async () => {
    client = new Redis(`redis://match-play-test/${Date.now()}-${Math.random()}`);
    await client.flushall();
    redisService = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(redisService, { client });

    eventBus = new MatchEventBus(redisService);
    matchSessionService = new MatchSessionService(redisService, eventBus);
    publishedJobs = [];

    matchEndedPublisher = {
      publishMatchEnded: jest.fn(async (state) => {
        publishedJobs.push(state);
      }) as jest.MockedFunction<MatchEndedPublisher["publishMatchEnded"]>,
    };

    matchTimeoutScheduler = {
      scheduleTimeout: jest.fn(async () => "job-1"),
      cancelTimeout: jest.fn(async () => undefined),
    };

    const matchDisconnectScheduler = {
      cancelForfeitForPlayers: jest.fn(async () => undefined),
    };

    const logger = { warn: jest.fn(), debug: jest.fn() } as unknown as Logger;
    metrics = {
      recordMatchPlayed: jest.fn(),
    };

    service = new MatchPlayService(
      matchSessionService,
      eventBus,
      matchEndedPublisher as unknown as MatchEndedPublisher,
      matchTimeoutScheduler as unknown as MatchTimeoutSchedulerService,
      metrics as unknown as MatchmakingMetricsService,
      matchDisconnectScheduler as unknown as import("./match-disconnect-scheduler.service.js").MatchDisconnectSchedulerService,
      redisService,
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
    const broadcastSpy = jest.spyOn(eventBus, "broadcastToMatch");

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
    expect(
      broadcastSpy.mock.calls.filter((call) => call[1] === "matchEnded").map((call) => call[2]),
    ).toEqual([
      expect.objectContaining({ eloDelta: { a: 21, b: -21 } }),
      expect.objectContaining({ eloDelta: { a: 21, b: -21 } }),
    ]);
    expect(await client.get("match:byUser:a")).toBeNull();

    broadcastSpy.mockRestore();
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

  it("ends the match without a winner when both players miss the play timeout", async () => {
    await service.handleMatchTimeout("match-1", 1, "WAITING_PLAYS");

    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("ENDED");
    expect(state?.winnerId).toBeUndefined();
    expect(state?.endReason).toBe("FORFEIT_TIMEOUT");
    expect(publishedJobs).toHaveLength(1);
  });

  it("releases the finalize guard when publishing the match-ended job fails", async () => {
    matchEndedPublisher.publishMatchEnded.mockRejectedValueOnce(new Error("queue unavailable"));

    await expect(service.handleMatchTimeout("match-1", 1, "WAITING_PLAYS")).rejects.toThrow(
      "queue unavailable",
    );
    expect(publishedJobs).toHaveLength(0);

    await service.handleMatchTimeout("match-1", 1, "WAITING_PLAYS");

    expect(publishedJobs).toHaveLength(1);
  });
  it("forfeits the match when a disconnected player does not reconnect", async () => {
    const forfeited = await service.handleDisconnectForfeit("a", "match-1");

    expect(forfeited).toBe(true);
    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("ENDED");
    expect(state?.winnerId).toBe("b");
    expect(state?.endReason).toBe("DISCONNECT_FORFEIT");
    expect(metrics.recordMatchPlayed).toHaveBeenCalledWith("forfeit");
  });

  it("skips disconnect forfeit when the player has an active socket", async () => {
    await redisService.setUserSocket("a", "socket-a");

    const forfeited = await service.handleDisconnectForfeit("a", "match-1");

    expect(forfeited).toBe(false);
    const state = await matchSessionService.loadState("match-1");
    expect(state?.status).toBe("WAITING_PLAYS");
  });
});
