import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { RedisService } from "../redis/redis.service.js";
import { LEADERBOARD_CACHE_TTL_SECONDS, LeaderboardService } from "./leaderboard.service.js";

describe("LeaderboardService", () => {
  let service: LeaderboardService;
  let prisma: { eloRating: { findMany: ReturnType<typeof jest.fn> } };
  let redis: {
    get: ReturnType<typeof jest.fn>;
    setex: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    prisma = {
      eloRating: {
        findMany: jest.fn(),
      },
    };
    redis = {
      get: jest.fn(),
      setex: jest.fn(),
    };
    service = new LeaderboardService(
      prisma as unknown as PrismaService,
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
    expect(prisma.eloRating.findMany).not.toHaveBeenCalled();
  });

  it("queries database and caches result on MISS", async () => {
    redis.get.mockResolvedValue(null);
    prisma.eloRating.findMany.mockResolvedValue([
      {
        rating: 1500,
        gamesPlayed: 42,
        user: { id: "user-1", displayName: "Alice" },
      },
      {
        rating: 1400,
        gamesPlayed: 50,
        user: { id: "user-2", displayName: "Bob" },
      },
    ]);

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
    expect(prisma.eloRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        orderBy: [{ rating: "desc" }, { gamesPlayed: "desc" }],
      }),
    );
    expect(redis.setex).toHaveBeenCalledWith(
      "leaderboard:top:50:all",
      LEADERBOARD_CACHE_TTL_SECONDS,
      JSON.stringify(result.data),
    );
  });

  it("filters and caches by league variant", async () => {
    redis.get.mockResolvedValue(null);
    prisma.eloRating.findMany.mockResolvedValue([
      {
        rating: 1250,
        gamesPlayed: 12,
        user: { id: "user-1", displayName: "Alice" },
      },
    ]);

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
    expect(prisma.eloRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rating: { gte: 1200, lte: 1349 } },
        take: 20,
      }),
    );
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
