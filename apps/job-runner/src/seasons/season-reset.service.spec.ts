import { SeasonStatus } from "@chifoumi/db";
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

    const standingsBatch = [
      {
        id: "standing-a",
        userId: userAId,
        finalRating: 1200,
        rank: 1,
        rewardsDistributed: false,
        user: { email: "alice@test.com", displayName: "alice" },
        finalLeague: { name: "Gold" },
      },
      {
        id: "standing-b",
        userId: userBId,
        finalRating: 1000,
        rank: 2,
        rewardsDistributed: false,
        user: { email: "bob@test.com", displayName: "bob" },
        finalLeague: { name: "Bronze" },
      },
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
        findMany: jest
          .fn()
          .mockResolvedValueOnce(standingsBatch as never)
          .mockResolvedValueOnce([] as never),
        update: jest.fn(async () => ({})),
      },
      league: {
        findMany: jest.fn(async () => leagues),
      },
      eloRating: {
        findMany: jest.fn(async () => ratings),
        update: jest.fn(async () => ({})),
      },
      eloHistory: {
        findFirst: jest.fn(async () => ({ ratingBefore: 1100 })),
      },
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<void>) => {
        await callback(prisma);
      }),
    };

    const seasonResetLock = {
      acquire: jest.fn(async () => "lock-token"),
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
        { seasonId, userId: userAId, finalRating: 1200, finalLeagueId: goldLeagueId, rank: 1 },
        { seasonId, userId: userBId, finalRating: 1000, finalLeagueId: bronzeLeagueId, rank: 2 },
      ],
    });
    expect(prisma.eloRating.update).toHaveBeenCalledWith({
      where: { userId: userAId },
      data: { rating: expect.any(Number), gamesPlayed: 0 },
    });
    expect(notificationsQueue.enqueueSeasonRewardMail).toHaveBeenCalledTimes(2);
    expect(notificationsQueue.enqueueSeasonRewardMail).toHaveBeenCalledWith(
      expect.objectContaining({ finalRating: "1200", delta: "+100" }),
    );
    expect(seasonResetLock.release).toHaveBeenCalledWith(seasonId, "lock-token");
  });

  it("is idempotent when standings already exist", async () => {
    const closedSeason = {
      id: seasonId,
      name: "Season 1",
      status: SeasonStatus.closed,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const prisma = {
      season: {
        findUnique: jest.fn(async () => closedSeason),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      seasonStanding: {
        count: jest.fn(async () => 2),
        findMany: jest.fn(async () => [] as never),
      },
      league: { findMany: jest.fn() },
      eloRating: { findMany: jest.fn(), update: jest.fn() },
      eloHistory: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };

    const service = createService({
      prisma,
      seasonResetLock: {
        acquire: jest.fn(async () => "lock-token"),
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

  it("resumes pending rewards for cron retries after standings were archived", async () => {
    const closedSeason = {
      id: seasonId,
      name: "Season 1",
      status: SeasonStatus.closed,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const standingsBatch = [
      {
        id: "standing-a",
        userId: userAId,
        finalRating: 1050,
        rank: 1,
        rewardsDistributed: false,
        user: { email: "alice@test.com", displayName: "alice" },
        finalLeague: { name: "Gold" },
      },
    ];
    const prisma = {
      season: {
        findFirst: jest.fn(async (args: { where: unknown }) =>
          "OR" in (args.where as { OR?: unknown }) ? closedSeason : null,
        ),
        count: jest.fn(async () => 0),
        findUnique: jest.fn(async () => closedSeason),
      },
      seasonStanding: {
        count: jest.fn(async () => 2),
        findMany: jest
          .fn()
          .mockResolvedValueOnce(standingsBatch as never)
          .mockResolvedValueOnce([] as never),
        update: jest.fn(async () => ({})),
      },
      league: { findMany: jest.fn() },
      eloRating: { findMany: jest.fn(), update: jest.fn() },
      eloHistory: {
        findFirst: jest.fn(async () => ({ ratingBefore: 1000 })),
      },
      $transaction: jest.fn(),
    };
    const notificationsQueue = {
      enqueueSeasonRewardMail: jest.fn(async () => undefined),
    };

    const result = await createService({
      prisma,
      seasonResetLock: {
        acquire: jest.fn(async () => "lock-token"),
        release: jest.fn(async () => undefined),
      },
      notificationsQueue,
    }).processSeasonReset({ source: "cron-scheduler" });

    expect(result).toBe("already_processed");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.season.findFirst).toHaveBeenCalledWith({
      where: {
        status: SeasonStatus.closed,
        OR: [{ standings: { none: {} } }, { standings: { some: { rewardsDistributed: false } } }],
      },
      orderBy: { updatedAt: "asc" },
    });
    expect(notificationsQueue.enqueueSeasonRewardMail).toHaveBeenCalledWith({
      to: "alice@test.com",
      displayName: "alice",
      seasonName: "Season 1",
      rank: "1",
      leagueName: "Gold",
      finalRating: "1050",
      delta: "+50",
    });
    expect(prisma.seasonStanding.update).toHaveBeenCalledWith({
      where: { id: "standing-a" },
      data: { rewardsDistributed: true },
    });
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
        acquire: jest.fn(async () => null),
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

  it("uses ratingBefore from first season match to compute delta", async () => {
    const seasonStart = new Date("2026-01-01T00:00:00.000Z");
    const closedSeason = {
      id: seasonId,
      name: "Season 1",
      status: SeasonStatus.closed,
      startedAt: seasonStart,
    };
    const standingsBatch = [
      {
        id: "standing-a",
        userId: userAId,
        finalRating: 1350,
        rank: 1,
        rewardsDistributed: false,
        user: { email: "alice@test.com", displayName: "alice" },
        finalLeague: { name: "Gold" },
      },
    ];

    const prisma = {
      season: {
        findUnique: jest.fn(async () => closedSeason),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      seasonStanding: {
        count: jest.fn(async () => 2),
        findMany: jest
          .fn()
          .mockResolvedValueOnce(standingsBatch as never)
          .mockResolvedValueOnce([] as never),
        update: jest.fn(async () => ({})),
      },
      eloHistory: {
        findFirst: jest.fn(async () => ({ ratingBefore: 1200 })),
      },
      $transaction: jest.fn(),
    };
    const notificationsQueue = {
      enqueueSeasonRewardMail: jest.fn(async () => undefined),
    };

    await createService({
      prisma,
      seasonResetLock: {
        acquire: jest.fn(async () => "lock-token"),
        release: jest.fn(async () => undefined),
      },
      notificationsQueue,
    }).processSeasonReset({ seasonId, source: "admin" });

    expect(prisma.eloHistory.findFirst).toHaveBeenCalledWith({
      where: { userId: userAId, createdAt: { gte: seasonStart } },
      orderBy: { createdAt: "asc" },
      select: { ratingBefore: true },
    });
    expect(notificationsQueue.enqueueSeasonRewardMail).toHaveBeenCalledWith(
      expect.objectContaining({ finalRating: "1350", delta: "+150" }),
    );
  });

  it("sets delta to 0 when the user has no history for the season", async () => {
    const closedSeason = {
      id: seasonId,
      name: "Season 1",
      status: SeasonStatus.closed,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const standingsBatch = [
      {
        id: "standing-a",
        userId: userAId,
        finalRating: 1000,
        rank: 1,
        rewardsDistributed: false,
        user: { email: "alice@test.com", displayName: "alice" },
        finalLeague: { name: "Bronze" },
      },
    ];

    const prisma = {
      season: {
        findUnique: jest.fn(async () => closedSeason),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      seasonStanding: {
        count: jest.fn(async () => 1),
        findMany: jest
          .fn()
          .mockResolvedValueOnce(standingsBatch as never)
          .mockResolvedValueOnce([] as never),
        update: jest.fn(async () => ({})),
      },
      eloHistory: {
        findFirst: jest.fn(async () => null),
      },
      $transaction: jest.fn(),
    };
    const notificationsQueue = {
      enqueueSeasonRewardMail: jest.fn(async () => undefined),
    };

    await createService({
      prisma,
      seasonResetLock: {
        acquire: jest.fn(async () => "lock-token"),
        release: jest.fn(async () => undefined),
      },
      notificationsQueue,
    }).processSeasonReset({ seasonId, source: "admin" });

    expect(notificationsQueue.enqueueSeasonRewardMail).toHaveBeenCalledWith(
      expect.objectContaining({ delta: "0" }),
    );
  });

  it("strips template placeholders from displayName before sending mail", async () => {
    const closedSeason = {
      id: seasonId,
      name: "Season 1",
      status: SeasonStatus.closed,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const standingsBatch = [
      {
        id: "standing-a",
        userId: userAId,
        finalRating: 1000,
        rank: 1,
        rewardsDistributed: false,
        user: { email: "evil@test.com", displayName: "__DISPLAY_NAME__hacker" },
        finalLeague: { name: "Bronze" },
      },
    ];

    const prisma = {
      season: {
        findUnique: jest.fn(async () => closedSeason),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      seasonStanding: {
        count: jest.fn(async () => 1),
        findMany: jest
          .fn()
          .mockResolvedValueOnce(standingsBatch as never)
          .mockResolvedValueOnce([] as never),
        update: jest.fn(async () => ({})),
      },
      eloHistory: {
        findFirst: jest.fn(async () => null),
      },
      $transaction: jest.fn(),
    };
    const notificationsQueue = {
      enqueueSeasonRewardMail: jest.fn(async () => undefined),
    };

    await createService({
      prisma,
      seasonResetLock: {
        acquire: jest.fn(async () => "lock-token"),
        release: jest.fn(async () => undefined),
      },
      notificationsQueue,
    }).processSeasonReset({ seasonId, source: "admin" });

    expect(notificationsQueue.enqueueSeasonRewardMail).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "hacker" }),
    );
  });
});
