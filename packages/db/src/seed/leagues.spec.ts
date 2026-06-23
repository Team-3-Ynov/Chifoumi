import { describe, expect, it, jest } from "@jest/globals";
import { type PrismaClient, SeasonStatus } from "@prisma/client";
import { REFERENCE_LEAGUES, seedLeaguesAndActiveSeason } from "./leagues.js";

function createPrismaMock(activeSeason: { id: string } | null = null): PrismaClient {
  return {
    league: {
      upsert: jest.fn(),
    },
    season: {
      findFirst: jest.fn(async () => activeSeason),
      create: jest.fn(),
    },
  } as unknown as PrismaClient;
}

describe("seedLeaguesAndActiveSeason", () => {
  it("upserts the four reference leagues by tier and creates an active season", async () => {
    const prisma = createPrismaMock();
    const now = new Date("2026-06-23T10:00:00.000Z");

    await seedLeaguesAndActiveSeason(prisma, now);

    expect(prisma.league.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.league.upsert).toHaveBeenNthCalledWith(1, {
      where: { tier: 1 },
      create: REFERENCE_LEAGUES[0],
      update: {
        name: "Bronze",
        minRating: 0,
        maxRating: 1099,
      },
    });
    expect(prisma.league.upsert).toHaveBeenNthCalledWith(4, {
      where: { tier: 4 },
      create: REFERENCE_LEAGUES[3],
      update: {
        name: "Platinum",
        minRating: 1350,
        maxRating: null,
      },
    });
    expect(prisma.season.create).toHaveBeenCalledWith({
      data: {
        name: "Saison 1",
        startedAt: now,
        endsAt: new Date("2026-07-23T10:00:00.000Z"),
        status: SeasonStatus.active,
      },
    });
  });

  it("does not create a duplicate season when an active season already exists", async () => {
    const prisma = createPrismaMock({ id: "existing-season" });

    await seedLeaguesAndActiveSeason(prisma);

    expect(prisma.league.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.season.create).not.toHaveBeenCalled();
  });

  it("keeps league bounds contiguous", () => {
    const sorted = [...REFERENCE_LEAGUES].sort((leagueA, leagueB) => leagueA.tier - leagueB.tier);

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];

      expect(current?.maxRating).not.toBeNull();
      expect((current?.maxRating ?? 0) + 1).toBe(next?.minRating);
    }
  });
});
