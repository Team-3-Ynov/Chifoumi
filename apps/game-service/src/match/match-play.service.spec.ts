import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Redis from "ioredis-mock";
import { Logger } from "nestjs-pino";
import { MatchEventBus } from "../match-session/match-event-bus.js";
import { MatchSessionService } from "../match-session/match-session.service.js";
import { RedisService } from "../redis/redis.service.js";
import { MatchEndedPublisher } from "./match-ended-publisher.service.js";
import { MatchPlayService, PlayValidationError } from "./match-play.service.js";

describe("MatchPlayService", () => {
  let client: InstanceType<typeof Redis>;
  let redisService: RedisService;
  let matchSessionService: MatchSessionService;
  let eventBus: MatchEventBus;
  let service: MatchPlayService;
  let publishedJobs: unknown[];

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

    const logger = { warn: jest.fn() } as unknown as Logger;

    service = new MatchPlayService(matchSessionService, eventBus, matchEndedPublisher, logger);

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
});
