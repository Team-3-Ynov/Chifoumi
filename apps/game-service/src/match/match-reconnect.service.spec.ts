import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Redis from "ioredis-mock";
import { MatchSessionService } from "../match-session/match-session.service.js";
import { MatchmakingService } from "../matchmaking/matchmaking.service.js";
import { RedisService } from "../redis/redis.service.js";
import { MatchDisconnectSchedulerService } from "./match-disconnect-scheduler.service.js";
import { MatchReconnectService } from "./match-reconnect.service.js";
import { MatchReconnectMetricsService } from "./match-reconnect-metrics.service.js";

describe("MatchReconnectService", () => {
  let client: InstanceType<typeof Redis>;
  let redisService: RedisService;
  let matchSessionService: MatchSessionService;
  let matchmakingService: MatchmakingService;
  let disconnectScheduler: {
    scheduleForfeit: jest.Mock;
    cancelForfeit: jest.Mock;
  };
  let metrics: MatchReconnectMetricsService;
  let service: MatchReconnectService;

  beforeEach(async () => {
    client = new Redis(`redis://match-reconnect-test/${Date.now()}-${Math.random()}`);
    redisService = new RedisService({ url: "redis://localhost:6379" });
    Object.assign(redisService, { client });

    matchSessionService = new MatchSessionService(redisService, {
      broadcastToMatch: jest.fn(async () => undefined),
    } as never);

    matchmakingService = new MatchmakingService(redisService, {
      getRating: jest.fn(async () => 1000),
    } as never);

    disconnectScheduler = {
      scheduleForfeit: jest.fn(async () => "job-1"),
      cancelForfeit: jest.fn(async () => undefined),
    };

    metrics = new MatchReconnectMetricsService();
    service = new MatchReconnectService(
      matchmakingService,
      matchSessionService,
      disconnectScheduler as unknown as MatchDisconnectSchedulerService,
      metrics,
      redisService,
    );

    await matchSessionService.create({
      matchId: "match-1",
      players: [
        { userId: "player-a", displayName: "Ace", rating: 1000 },
        { userId: "player-b", displayName: "Bob", rating: 1020 },
      ],
      now: new Date("2026-06-09T10:00:00.000Z"),
    });
  });

  it("schedules a disconnect forfeit instead of leaving the queue when in match", async () => {
    await redisService.setUserSocket("player-a", "socket-a");

    await service.handleDisconnect("player-a", "socket-a");

    expect(disconnectScheduler.scheduleForfeit).toHaveBeenCalledWith("player-a", "match-1");
    expect(await redisService.getUserSocket("player-a")).toBeNull();
    expect(await matchmakingService.isInMatch("player-a")).toBe(true);
  });

  it("removes the player from the queue on disconnect when not in match", async () => {
    await matchmakingService.joinQueue("queue-user", "Queue");
    await redisService.setUserSocket("queue-user", "socket-q");

    await service.handleDisconnect("queue-user", "socket-q");

    expect(disconnectScheduler.scheduleForfeit).not.toHaveBeenCalled();
    expect(await matchmakingService.isInQueue("queue-user")).toBe(false);
    expect(await redisService.getUserSocket("queue-user")).toBeNull();
  });

  it("emits matchResumed payload and cancels pending forfeit on reconnect", async () => {
    const resumed = await service.handleReconnect("player-a");

    expect(resumed).toEqual({
      matchId: "match-1",
      currentRound: 1,
      scoreA: 0,
      scoreB: 0,
      currentState: "WAITING_PLAYS",
      deadline: "2026-06-09T10:00:05.000Z",
    });
    expect(disconnectScheduler.cancelForfeit).toHaveBeenCalledWith("player-a");
  });

  it("returns null when the player has no active match", async () => {
    await expect(service.handleReconnect("unknown-user")).resolves.toBeNull();
  });
});
