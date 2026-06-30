import { SeasonStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { SeasonsQueueService } from "../queues/seasons-queue.service.js";
import type { UserService } from "../user-service/user.service.js";
import { SeasonsService } from "./seasons.service.js";

// Mirrors the reference leagues seeded in the database (tier-ordered).
const DB_LEAGUES = [
  { id: "l1", name: "Bronze", tier: 1, minRating: 0, maxRating: 1099 },
  { id: "l2", name: "Silver", tier: 2, minRating: 1100, maxRating: 1199 },
  { id: "l3", name: "Gold", tier: 3, minRating: 1200, maxRating: 1349 },
  { id: "l4", name: "Platinum", tier: 4, minRating: 1350, maxRating: null },
];

const ACTIVE_SEASON = {
  id: "season-1",
  name: "Saison 1",
  startedAt: new Date("2026-06-01T00:00:00.000Z"),
  endsAt: new Date("2026-07-01T00:00:00.000Z"),
  status: SeasonStatus.active,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

describe("SeasonsService", () => {
  let service: SeasonsService;
  let prisma: {
    season: {
      create: ReturnType<typeof jest.fn>;
      findMany: ReturnType<typeof jest.fn>;
      findFirst: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      updateMany: ReturnType<typeof jest.fn>;
    };
    league: { findMany: ReturnType<typeof jest.fn> };
    seasonStanding: { findMany: ReturnType<typeof jest.fn>; count: ReturnType<typeof jest.fn> };
  };
  let enqueueSeasonReset: ReturnType<typeof jest.fn>;
  let userService: { getCompetitionStats: ReturnType<typeof jest.fn> };

  beforeEach(() => {
    prisma = {
      season: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      league: { findMany: jest.fn() },
      seasonStanding: { findMany: jest.fn(), count: jest.fn() },
    };
    prisma.league.findMany.mockResolvedValue(DB_LEAGUES);
    enqueueSeasonReset = jest.fn();
    enqueueSeasonReset.mockResolvedValue(undefined);
    userService = { getCompetitionStats: jest.fn() };
    service = new SeasonsService(
      prisma as unknown as PrismaService,
      { enqueueSeasonReset } as unknown as SeasonsQueueService,
      userService as unknown as UserService,
    );
  });

  describe("getCurrent", () => {
    it("returns the active season with the player's league, rank and progress (ryu -> Silver)", async () => {
      prisma.season.findFirst.mockResolvedValue(ACTIVE_SEASON);
      userService.getCompetitionStats.mockResolvedValue({ rating: 1150, gamesPlayed: 12, rank: 7 });

      const result = await service.getCurrent("ryu-id");

      expect(result.season).toEqual({
        id: "season-1",
        name: "Saison 1",
        startedAt: ACTIVE_SEASON.startedAt,
        endsAt: ACTIVE_SEASON.endsAt,
        status: "active",
      });
      expect(result.me.rating).toBe(1150);
      expect(result.me.league).toEqual({ name: "Silver", tier: 2 });
      expect(result.me.rank).toBe(7); // 6 ahead + 1
      // (1150 - 1100) / (1199 - 1100) ~= 0.505
      expect(result.me.progressToNextLeague).toBeCloseTo(0.505, 3);
    });

    it("loads the competition rank from user-service", async () => {
      prisma.season.findFirst.mockResolvedValue(ACTIVE_SEASON);
      userService.getCompetitionStats.mockResolvedValue({ rating: 1150, gamesPlayed: 12, rank: 1 });

      const result = await service.getCurrent("ryu-id");

      expect(userService.getCompetitionStats).toHaveBeenCalledWith("ryu-id");
      expect(result.me.rank).toBe(1);
    });

    it("falls back to the starting rating when the player has no elo row", async () => {
      prisma.season.findFirst.mockResolvedValue(ACTIVE_SEASON);
      userService.getCompetitionStats.mockResolvedValue({ rating: 1000, gamesPlayed: 0, rank: 4 });

      const result = await service.getCurrent("new-player");

      expect(result.me.rating).toBe(1000);
      expect(result.me.league).toEqual({ name: "Bronze", tier: 1 });
    });

    it("throws 404 NO_ACTIVE_SEASON when no season is active", async () => {
      prisma.season.findFirst.mockResolvedValue(null);

      await expect(service.getCurrent("ryu-id")).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getCurrent("ryu-id")).rejects.toMatchObject({
        response: { code: "NO_ACTIVE_SEASON" },
      });
      expect(userService.getCompetitionStats).not.toHaveBeenCalled();
    });
  });

  describe("getStandings", () => {
    it("returns paginated archived standings ordered by rank", async () => {
      prisma.season.findUnique.mockResolvedValue({
        id: "season-closed",
        name: "Saison 0",
        status: SeasonStatus.closed,
      });
      prisma.seasonStanding.findMany.mockResolvedValue([
        {
          rank: 1,
          finalRating: 1400,
          user: { id: "player-1", displayName: "alice" },
          finalLeague: { name: "Platinum", tier: 4 },
        },
      ]);
      prisma.seasonStanding.count.mockResolvedValue(12);

      const result = await service.getStandings("season-closed", { page: 2, limit: 5 });

      expect(prisma.seasonStanding.findMany).toHaveBeenCalledWith({
        where: { seasonId: "season-closed" },
        orderBy: { rank: "asc" },
        skip: 5,
        take: 5,
        include: {
          user: { select: { id: true, displayName: true } },
          finalLeague: { select: { name: true, tier: true } },
        },
      });
      expect(prisma.seasonStanding.count).toHaveBeenCalledWith({
        where: { seasonId: "season-closed" },
      });
      expect(result).toEqual({
        season: { id: "season-closed", name: "Saison 0", status: SeasonStatus.closed },
        items: [
          {
            rank: 1,
            userId: "player-1",
            displayName: "alice",
            finalRating: 1400,
            finalLeague: { name: "Platinum", tier: 4 },
          },
        ],
        total: 12,
        page: 2,
        limit: 5,
      });
    });

    it("filters archived standings by final league", async () => {
      prisma.season.findUnique.mockResolvedValue({
        id: "season-closed",
        name: "Saison 0",
        status: SeasonStatus.closed,
      });
      prisma.seasonStanding.findMany.mockResolvedValue([]);
      prisma.seasonStanding.count.mockResolvedValue(0);

      await service.getStandings("season-closed", { page: 1, limit: 50, league: "gold" });

      expect(prisma.seasonStanding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { seasonId: "season-closed", finalLeague: { name: "Gold" } },
        }),
      );
      expect(prisma.seasonStanding.count).toHaveBeenCalledWith({
        where: { seasonId: "season-closed", finalLeague: { name: "Gold" } },
      });
    });

    it("throws 400 UNKNOWN_LEAGUE when the league filter is invalid", async () => {
      prisma.season.findUnique.mockResolvedValue({
        id: "season-closed",
        name: "Saison 0",
        status: SeasonStatus.closed,
      });

      await expect(
        service.getStandings("season-closed", { page: 1, limit: 50, league: "diamond" }),
      ).rejects.toMatchObject({
        response: { code: "UNKNOWN_LEAGUE" },
      });
      expect(prisma.seasonStanding.findMany).not.toHaveBeenCalled();
    });

    it("throws 409 SEASON_NOT_CLOSED when standings are requested for an active season", async () => {
      prisma.season.findUnique.mockResolvedValue({
        id: "season-active",
        name: "Saison courante",
        status: SeasonStatus.active,
      });

      await expect(
        service.getStandings("season-active", { page: 1, limit: 50 }),
      ).rejects.toMatchObject({
        response: { error: "SEASON_NOT_CLOSED" },
      });
      await expect(
        service.getStandings("season-active", { page: 1, limit: 50 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.seasonStanding.findMany).not.toHaveBeenCalled();
    });

    it("throws 404 SEASON_NOT_FOUND when the season does not exist", async () => {
      prisma.season.findUnique.mockResolvedValue(null);

      await expect(service.getStandings("missing", { page: 1, limit: 50 })).rejects.toMatchObject({
        response: { error: "SEASON_NOT_FOUND" },
      });
      expect(prisma.seasonStanding.findMany).not.toHaveBeenCalled();
    });
  });

  describe("listClosed", () => {
    it("returns recent closed seasons ordered by end date", async () => {
      const closedSeason = {
        id: "season-closed",
        name: "Saison 0",
        startedAt: new Date("2026-05-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-01T00:00:00.000Z"),
        status: SeasonStatus.closed,
      };
      prisma.season.findMany.mockResolvedValue([closedSeason]);

      await expect(service.listClosed()).resolves.toEqual({ items: [closedSeason] });
      expect(prisma.season.findMany).toHaveBeenCalledWith({
        where: { status: SeasonStatus.closed },
        orderBy: { endsAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          startedAt: true,
          endsAt: true,
          status: true,
        },
      });
    });
  });

  describe("createSeason", () => {
    it("creates an upcoming season with a startedAt timestamp", async () => {
      prisma.season.create.mockResolvedValue({ id: "season-1", status: SeasonStatus.upcoming });

      await service.createSeason({
        name: "Saison 3",
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
      });

      expect(prisma.season.create).toHaveBeenCalledWith({
        data: {
          name: "Saison 3",
          startedAt: expect.any(Date),
          endsAt: new Date("2026-08-01T00:00:00.000Z"),
          status: SeasonStatus.upcoming,
        },
      });
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });
  });

  describe("closeSeason", () => {
    it("closes an active season and enqueues a season-reset job", async () => {
      prisma.season.findUnique.mockResolvedValue({ id: "season-1", status: SeasonStatus.active });
      prisma.season.updateMany.mockResolvedValue({ count: 1 });
      prisma.season.findUnique.mockResolvedValueOnce({
        id: "season-1",
        status: SeasonStatus.active,
      });
      prisma.season.findUnique.mockResolvedValueOnce({
        id: "season-1",
        status: SeasonStatus.closed,
      });

      const result = await service.closeSeason("season-1");

      expect(prisma.season.updateMany).toHaveBeenCalledWith({
        where: { id: "season-1", status: SeasonStatus.active },
        data: { status: SeasonStatus.closed },
      });
      expect(enqueueSeasonReset).toHaveBeenCalledWith("season-1");
      expect(result.status).toBe(SeasonStatus.closed);
    });

    it("rolls back the season status when enqueueing the reset job fails", async () => {
      const queueError = new Error("Redis unavailable");
      prisma.season.findUnique.mockResolvedValueOnce({
        id: "season-1",
        status: SeasonStatus.active,
      });
      prisma.season.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.season.updateMany.mockResolvedValueOnce({ count: 1 });
      enqueueSeasonReset.mockRejectedValue(queueError);

      await expect(service.closeSeason("season-1")).rejects.toThrow(queueError);

      expect(prisma.season.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: "season-1", status: SeasonStatus.active },
        data: { status: SeasonStatus.closed },
      });
      expect(prisma.season.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: "season-1", status: SeasonStatus.closed },
        data: { status: SeasonStatus.active },
      });
    });

    it("does not enqueue twice when another request already closed the season", async () => {
      prisma.season.findUnique.mockResolvedValueOnce({
        id: "season-1",
        status: SeasonStatus.active,
      });
      prisma.season.findUnique.mockResolvedValueOnce({
        id: "season-1",
        status: SeasonStatus.closed,
      });
      prisma.season.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.closeSeason("season-1")).rejects.toMatchObject({
        response: { error: "SEASON_ALREADY_CLOSED" },
      });

      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });

    it("throws 409 SEASON_ALREADY_CLOSED when the season is already closed", async () => {
      prisma.season.findUnique.mockResolvedValue({ id: "season-1", status: SeasonStatus.closed });

      await expect(service.closeSeason("season-1")).rejects.toMatchObject({
        response: { error: "SEASON_ALREADY_CLOSED" },
      });
      await expect(service.closeSeason("season-1")).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.season.updateMany).not.toHaveBeenCalled();
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });

    it("throws 409 SEASON_NOT_ACTIVE when the season is still upcoming", async () => {
      prisma.season.findUnique.mockResolvedValue({ id: "season-1", status: SeasonStatus.upcoming });

      await expect(service.closeSeason("season-1")).rejects.toMatchObject({
        response: { error: "SEASON_NOT_ACTIVE" },
      });
      await expect(service.closeSeason("season-1")).rejects.toBeInstanceOf(ConflictException);
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });

    it("throws 404 SEASON_NOT_FOUND when the season does not exist", async () => {
      prisma.season.findUnique.mockResolvedValue(null);

      await expect(service.closeSeason("missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });
  });
});
