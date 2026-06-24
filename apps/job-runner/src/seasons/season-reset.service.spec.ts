import { SeasonStatus } from "@chifoumi/db";
import { softResetRating } from "@chifoumi/elo";
import { describe, expect, it, jest } from "@jest/globals";
import { SeasonResetService } from "./season-reset.service.js";

const seasonId = "33333333-3333-4333-8333-333333333333";
const userAId = "11111111-1111-4111-8111-111111111111";
const userBId = "22222222-2222-4222-8222-222222222222";
const upcomingSeasonId = "55555555-5555-4555-8555-555555555555";

function createService(overrides: {
  prisma?: Record<string, unknown>;
  seasonResetLock?: Record<string, unknown>;
  notificationsQueue?: Record<string, unknown>;
}) {
  return new SeasonResetService(
    overrides.prisma as never,
    overrides.seasonResetLock as never,
    overrides.notificationsQueue as never,
  );
}

describe("SeasonResetService", () => {
  it("archives standings, soft-resets ratings, activates next season and enqueues rewards", async () => {
    const closedSeason = {
      id: seasonId,
      name: "Season 1",
      status: SeasonStatus.closed,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
    };
    const bronzeLeagueId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const goldLeagueId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const leagues = [
      { id: bronzeLeagueId, name: "Bronze", tier: 1, minRating: 0, maxRating: 1099 },
      { id: goldLeagueId, name: "Gold", tier: 3, minRating: 1200, maxRating: 1349 },
    ];
    const ratings = [
      { userId: userAId, rating: 1200, gamesPlayed: 10, user: { id: userAId } },
      { userId: userBId, rating: 1000, gamesPlayed: 5, user: { id: userBId } },
    ];

    const prisma = {
      season: {
        findUnique: jest.fn(async () => closedSeason),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => ({ id: upcomingSeasonId, status: SeasonStatus.upcoming })),
        update: jest.fn(async () => ({ id: upcomingSeasonId, status: SeasonStatus.active })),
      },
      seasonStanding: {
        count: jest.fn(async () => 0),
        createMany: jest.fn(async () => ({ count: 2 })),
        findMany: jest.fn(async () => [
          {
            id: "standing-a",
            rank: 1,
            rewardsDistributed: false,
            user: { email: "alice@test.com", displayName: "alice" },
            finalLeague: { name: "Silver" },
          },
          {
            id: "standing-b",
            rank: 2,
            rewardsDistributed: false,
            user: { email: "bob@test.com", displayName: "bob" },
            finalLeague: { name: "Bronze" },
          },
        ]),
        update: jest.fn(async () => ({})),
      },
      league: {
        findMany: jest.fn(async () => leagues),
      },
      eloRating: {
        findMany: jest.fn(async () => ratings),
        update: jest.fn(async () => ({})),
      },
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<void>) => {
        await callback(prisma);
      }),
    };

    const seasonResetLock = {
      acquire: jest.fn(async () => true),
      release: jest.fn(async () => undefined),
    };
    const notificationsQueue = {
      enqueueSeasonRewardMail: jest.fn(async () => undefined),
    };

    const service = createService({ prisma, seasonResetLock, notificationsQueue });
    const result = await service.processSeasonReset({ seasonId, source: "admin" });

    expect(result).toBe("processed");
    expect(seasonResetLock.acquire).toHaveBeenCalledWith(seasonId);
    expect(prisma.seasonStanding.createMany).toHaveBeenCalledWith({
      data: [
        {
          seasonId,
          userId: userAId,
          finalRating: 1200,
          finalLeagueId: goldLeagueId,
          rank: 1,
        },
        {
          seasonId,
          userId: userBId,
          finalRating: 1000,
          finalLeagueId: bronzeLeagueId,
          rank: 2,
        },
      ],
    });
    expect(prisma.eloRating.update).toHaveBeenCalledWith({
      where: { userId: userAId },
      data: { rating: softResetRating(1200), gamesPlayed: 0 },
    });
    expect(notificationsQueue.enqueueSeasonRewardMail).toHaveBeenCalledTimes(2);
    expect(seasonResetLock.release).toHaveBeenCalledWith(seasonId);
  });

  it("is idempotent when standings already exist", async () => {
    const closedSeason = {
      id: seasonId,
      name: "Season 1",
      status: SeasonStatus.closed,
    };

    const prisma = {
      season: {
        findUnique: jest.fn(async () => closedSeason),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      seasonStanding: {
        count: jest.fn(async () => 2),
        findMany: jest.fn(async () => []),
      },
      league: { findMany: jest.fn() },
      eloRating: { findMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };

    const service = createService({
      prisma,
      seasonResetLock: {
        acquire: jest.fn(async () => true),
        release: jest.fn(async () => undefined),
      },
      notificationsQueue: {
        enqueueSeasonRewardMail: jest.fn(),
      },
    });

    const result = await service.processSeasonReset({ seasonId, source: "admin" });

    expect(result).toBe("already_processed");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.eloRating.update).not.toHaveBeenCalled();
  });

  it("returns noop when cron finds no eligible season", async () => {
    const prisma = {
      season: {
        findFirst: jest.fn(async () => null),
      },
    };

    const service = createService({
      prisma,
      seasonResetLock: { acquire: jest.fn(), release: jest.fn() },
      notificationsQueue: { enqueueSeasonRewardMail: jest.fn() },
    });

    const result = await service.processSeasonReset({ source: "cron-scheduler" });

    expect(result).toBe("noop");
  });

  it("retries when the distributed lock is not acquired", async () => {
    const closedSeason = {
      id: seasonId,
      status: SeasonStatus.closed,
    };

    const service = createService({
      prisma: {
        season: {
          findUnique: jest.fn(async () => closedSeason),
        },
        seasonStanding: {
          count: jest.fn(async () => 0),
        },
      },
      seasonResetLock: {
        acquire: jest.fn(async () => false),
        release: jest.fn(),
      },
      notificationsQueue: {
        enqueueSeasonRewardMail: jest.fn(),
      },
    });

    await expect(service.processSeasonReset({ seasonId, source: "admin" })).rejects.toThrow(
      "Season reset lock not acquired",
    );
  });
});
