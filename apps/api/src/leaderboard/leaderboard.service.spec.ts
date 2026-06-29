import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { RedisService } from "../redis/redis.service.js";
import type { UserService } from "../user-service/user.service.js";
import { LEADERBOARD_CACHE_TTL_SECONDS, LeaderboardService } from "./leaderboard.service.js";

describe("LeaderboardService", () => {
  let service: LeaderboardService;
  let userService: { listLeaderboard: ReturnType<typeof jest.fn> };
  let redis: {
    get: ReturnType<typeof jest.fn>;
    setex: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    userService = { listLeaderboard: jest.fn() };
    redis = {
      get: jest.fn(),
      setex: jest.fn(),
    };
    service = new LeaderboardService(
      userService as unknown as UserService,
      redis as unknown as RedisService,
    );
  });

  it("returns cached leaderboard with HIT status", async () => {
    const cachedPayload = {
      items: [
        {
          rank: 1,
          userId: "user-1",
          displayName: "Alice",
          rating: 1500,
          gamesPlayed: 42,
          league: { name: "Platinum", tier: 4 },
        },
      ],
    };
    redis.get.mockResolvedValue(JSON.stringify(cachedPayload));

    const result = await service.get(50);

    expect(result.cache).toBe("HIT");
    expect(result.data).toEqual(cachedPayload);
    expect(userService.listLeaderboard).not.toHaveBeenCalled();
  });

  it("queries database and caches result on MISS", async () => {
    redis.get.mockResolvedValue(null);
    userService.listLeaderboard.mockResolvedValue({
      items: [
        {
          rank: 1,
          userId: "user-1",
          displayName: "Alice",
          rating: 1500,
          gamesPlayed: 42,
          league: { name: "Platinum", tier: 4 },
        },
        {
          rank: 2,
          userId: "user-2",
          displayName: "Bob",
          rating: 1400,
          gamesPlayed: 50,
          league: { name: "Platinum", tier: 4 },
        },
      ],
    });

    const result = await service.get(50);

    expect(result.cache).toBe("MISS");
    expect(result.data.items).toEqual([
      {
        rank: 1,
        userId: "user-1",
        displayName: "Alice",
        rating: 1500,
        gamesPlayed: 42,
        league: { name: "Platinum", tier: 4 },
      },
      {
        rank: 2,
        userId: "user-2",
        displayName: "Bob",
        rating: 1400,
        gamesPlayed: 50,
        league: { name: "Platinum", tier: 4 },
      },
    ]);
    expect(userService.listLeaderboard).toHaveBeenCalledWith(50, undefined);
    expect(redis.setex).toHaveBeenCalledWith(
      "leaderboard:top:50:all",
      LEADERBOARD_CACHE_TTL_SECONDS,
      JSON.stringify(result.data),
    );
  });

  it("filters and caches by league variant", async () => {
    redis.get.mockResolvedValue(null);
    userService.listLeaderboard.mockResolvedValue({
      items: [
        {
          rank: 1,
          userId: "user-1",
          displayName: "Alice",
          rating: 1250,
          gamesPlayed: 12,
          league: { name: "Gold", tier: 3 },
        },
      ],
    });

    const result = await service.get(20, "gold");

    expect(result.data.items).toEqual([
      {
        rank: 1,
        userId: "user-1",
        displayName: "Alice",
        rating: 1250,
        gamesPlayed: 12,
        league: { name: "Gold", tier: 3 },
      },
    ]);
    expect(userService.listLeaderboard).toHaveBeenCalledWith(20, "Gold");
    expect(redis.get).toHaveBeenCalledWith("leaderboard:top:20:gold");
    expect(redis.setex).toHaveBeenCalledWith(
      "leaderboard:top:20:gold",
      LEADERBOARD_CACHE_TTL_SECONDS,
      JSON.stringify(result.data),
    );
  });

  it("rejects an unknown league", async () => {
    await expect(service.get(20, "diamond")).rejects.toMatchObject({
      response: { code: "UNKNOWN_LEAGUE" },
    });
  });
});
