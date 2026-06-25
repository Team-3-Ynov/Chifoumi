import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { MatchPlayService } from "../match/match-play.service.js";
import type { MatchSessionService } from "../match-session/match-session.service.js";
import type { MatchState } from "../match-session/match-session.types.js";
import type { MatchmakingService } from "../matchmaking/matchmaking.service.js";
import type { RatingService } from "../matchmaking/rating.service.js";
import type { RedisService } from "../redis/redis.service.js";
import { DirectedMatchService } from "./directed-match.service.js";

const slotAId = "11111111-1111-4111-8111-111111111111";
const slotBId = "22222222-2222-4222-8222-222222222222";
const tournamentMatchId = "33333333-3333-4333-8333-333333333333";

function createState(matchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"): MatchState {
  return {
    matchId,
    players: [
      { userId: slotAId, displayName: "Ace", rating: 1000 },
      { userId: slotBId, displayName: "Bob", rating: 1040 },
    ],
    scoreA: 0,
    scoreB: 0,
    currentRound: 1,
    status: "WAITING_PLAYS",
    startedAt: "2026-06-09T10:00:00.000Z",
    roundDeadline: "2026-06-09T10:00:05.000Z",
    roundPlays: { a: null, b: null },
    tournamentMatchId,
  };
}

describe("DirectedMatchService", () => {
  let redisService: {
    get: jest.Mock<(key: string) => Promise<string | null>>;
  };
  let matchmakingService: {
    isInQueue: jest.Mock<(userId: string) => Promise<boolean>>;
  };
  let ratingService: {
    getRating: jest.Mock<(userId: string) => Promise<number>>;
  };
  let matchSessionService: {
    create: jest.Mock;
  };
  let matchPlayService: {
    onMatchStarted: jest.Mock;
  };
  let service: DirectedMatchService;

  beforeEach(() => {
    redisService = {
      get: jest.fn(async () => null),
    };
    matchmakingService = {
      isInQueue: jest.fn(async () => false),
    };
    ratingService = {
      getRating: jest.fn(async (userId: string) => (userId === slotAId ? 1000 : 1040)),
    };
    matchSessionService = {
      create: jest.fn(async () => createState()),
    };
    matchPlayService = {
      onMatchStarted: jest.fn(async () => undefined),
    };

    service = new DirectedMatchService(
      redisService as unknown as RedisService,
      matchmakingService as unknown as MatchmakingService,
      ratingService as unknown as RatingService,
      matchSessionService as unknown as MatchSessionService,
      matchPlayService as unknown as MatchPlayService,
      { log: jest.fn() } as never,
    );
  });

  it("creates a directed match without using the matchmaking queue", async () => {
    const result = await service.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    expect(result).toEqual({
      ok: true,
      matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(matchSessionService.create).toHaveBeenCalledWith({
      players: [
        { userId: slotAId, displayName: "Ace", rating: 1000 },
        { userId: slotBId, displayName: "Bob", rating: 1040 },
      ],
      tournamentMatchId,
    });
    expect(matchPlayService.onMatchStarted).toHaveBeenCalledTimes(1);
  });

  it("rejects when a player is already in a match", async () => {
    redisService.get.mockImplementation(async (key: string) =>
      key.includes(slotAId) ? "existing-match" : null,
    );

    const result = await service.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    expect(result).toEqual({ ok: false, code: "PLAYER_ALREADY_IN_MATCH" });
    expect(matchSessionService.create).not.toHaveBeenCalled();
  });

  it("rejects when both slots refer to the same player", async () => {
    const result = await service.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotAId, displayName: "Ace" },
    });

    expect(result).toEqual({ ok: false, code: "SAME_PLAYER" });
  });
});
