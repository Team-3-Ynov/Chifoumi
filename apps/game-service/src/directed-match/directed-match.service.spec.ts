import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { MatchPlayService } from "../match/match-play.service.js";
import type { MatchSessionService } from "../match-session/match-session.service.js";
import type { MatchState } from "../match-session/match-session.types.js";
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
    setnx: jest.Mock<(key: string, ttlSeconds: number) => Promise<boolean>>;
    evalScript: jest.Mock<(script: string, keys: string[], args: string[]) => Promise<number>>;
    del: jest.Mock<(key: string) => Promise<void>>;
  };
  let ratingService: {
    getRating: jest.Mock<(userId: string) => Promise<number>>;
  };
  let matchSessionService: {
    create: jest.Mock<
      (input: {
        players: unknown;
        matchId?: string;
        tournamentMatchId?: string;
      }) => Promise<MatchState>
    >;
  };
  let matchPlayService: {
    onMatchStarted: jest.Mock;
  };
  let service: DirectedMatchService;

  beforeEach(() => {
    redisService = {
      setnx: jest.fn(async () => true),
      evalScript: jest.fn(async () => 1),
      del: jest.fn(async () => undefined),
    };
    ratingService = {
      getRating: jest.fn(async (userId: string) => (userId === slotAId ? 1000 : 1040)),
    };
    matchSessionService = {
      create: jest.fn(
        async (input: { players: unknown; matchId?: string; tournamentMatchId?: string }) =>
          createState(input.matchId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      ),
    };
    matchPlayService = {
      onMatchStarted: jest.fn(async () => undefined),
    };

    service = new DirectedMatchService(
      redisService as unknown as RedisService,
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

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected directed match to start");
    }

    expect(redisService.setnx).toHaveBeenCalledTimes(1);
    expect(redisService.evalScript).toHaveBeenCalledTimes(1);
    expect(redisService.evalScript).toHaveBeenCalledWith(
      expect.any(String),
      ["matchmaking:queue"],
      expect.arrayContaining([
        "match:byUser:",
        "matchmaking:meta:",
        `tournament-match:${tournamentMatchId}:match`,
      ]),
    );
    expect(matchSessionService.create).toHaveBeenCalledWith({
      players: [
        { userId: slotAId, displayName: "Ace", rating: 1000 },
        { userId: slotBId, displayName: "Bob", rating: 1040 },
      ],
      matchId: result.matchId,
      tournamentMatchId,
    });
    expect(matchPlayService.onMatchStarted).toHaveBeenCalledTimes(1);
  });

  it("allows directed matches to pull players out of the matchmaking queue", async () => {
    await service.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    const script = redisService.evalScript.mock.calls[0]?.[0] ?? "";
    expect(script).toContain('redis.call("ZREM", queueKey, userA, userB)');
    expect(script).toContain('redis.call("DEL", metaPrefix .. userA, metaPrefix .. userB)');
    expect(script).not.toContain('redis.call("ZSCORE", queueKey');
  });

  it("rejects when atomic player claim fails", async () => {
    redisService.evalScript.mockResolvedValue(0);

    const result = await service.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    expect(result).toEqual({ ok: false, code: "PLAYER_ALREADY_IN_MATCH" });
    expect(matchSessionService.create).not.toHaveBeenCalled();
  });

  it("rejects when the tournament match is already claimed", async () => {
    redisService.evalScript.mockResolvedValue(2);

    const result = await service.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    expect(result).toEqual({ ok: false, code: "TOURNAMENT_MATCH_ALREADY_STARTED" });
    expect(matchSessionService.create).not.toHaveBeenCalled();
  });

  it("rejects when pair lock cannot be acquired", async () => {
    redisService.setnx.mockResolvedValue(false);

    const result = await service.startMatch({
      tournamentMatchId,
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    expect(result).toEqual({ ok: false, code: "PLAYER_ALREADY_IN_MATCH" });
    expect(redisService.evalScript).not.toHaveBeenCalled();
    expect(matchSessionService.create).not.toHaveBeenCalled();
  });

  it("rejects when tournamentMatchId is not a UUID", async () => {
    const result = await service.startMatch({
      tournamentMatchId: "bracket-1",
      slotA: { userId: slotAId, displayName: "Ace" },
      slotB: { userId: slotBId, displayName: "Bob" },
    });

    expect(result).toEqual({ ok: false, code: "INVALID_TOURNAMENT_MATCH" });
    expect(redisService.setnx).not.toHaveBeenCalled();
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

  it("releases player claims when session creation fails", async () => {
    matchSessionService.create.mockRejectedValue(new Error("redis unavailable"));

    await expect(
      service.startMatch({
        tournamentMatchId,
        slotA: { userId: slotAId, displayName: "Ace" },
        slotB: { userId: slotBId, displayName: "Bob" },
      }),
    ).rejects.toThrow("redis unavailable");

    expect(redisService.del).toHaveBeenCalledTimes(3);
    expect(redisService.del).toHaveBeenCalledWith(`tournament-match:${tournamentMatchId}:match`);
  });
});
