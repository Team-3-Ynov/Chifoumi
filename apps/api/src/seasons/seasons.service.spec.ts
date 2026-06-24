import { SeasonStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { SeasonsQueueService } from "../queues/seasons-queue.service.js";
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
      findFirst: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      updateMany: ReturnType<typeof jest.fn>;
    };
    eloRating: { findUnique: ReturnType<typeof jest.fn>; count: ReturnType<typeof jest.fn> };
    league: { findMany: ReturnType<typeof jest.fn> };
  };
  let enqueueSeasonReset: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    prisma = {
      season: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      eloRating: { findUnique: jest.fn(), count: jest.fn() },
      league: { findMany: jest.fn() },
    };
    prisma.league.findMany.mockResolvedValue(DB_LEAGUES);
    enqueueSeasonReset = jest.fn();
    enqueueSeasonReset.mockResolvedValue(undefined);
    service = new SeasonsService(
      prisma as unknown as PrismaService,
      { enqueueSeasonReset } as unknown as SeasonsQueueService,
    );
  });

  describe("getCurrent", () => {
    it("returns the active season with the player's league, rank and progress (ryu -> Silver)", async () => {
      prisma.season.findFirst.mockResolvedValue(ACTIVE_SEASON);
      prisma.eloRating.findUnique.mockResolvedValue({ rating: 1150, gamesPlayed: 12 });
      prisma.eloRating.count.mockResolvedValue(6); // 6 players strictly ahead

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

    it("ranks using rating DESC then gamesPlayed DESC (competition rank)", async () => {
      prisma.season.findFirst.mockResolvedValue(ACTIVE_SEASON);
      prisma.eloRating.findUnique.mockResolvedValue({ rating: 1150, gamesPlayed: 12 });
      prisma.eloRating.count.mockResolvedValue(0);

      const result = await service.getCurrent("ryu-id");

      expect(prisma.eloRating.count).toHaveBeenCalledWith({
        where: {
          OR: [{ rating: { gt: 1150 } }, { rating: 1150, gamesPlayed: { gt: 12 } }],
        },
      });
      expect(result.me.rank).toBe(1);
    });

    it("falls back to the starting rating when the player has no elo row", async () => {
      prisma.season.findFirst.mockResolvedValue(ACTIVE_SEASON);
      prisma.eloRating.findUnique.mockResolvedValue(null);
      prisma.eloRating.count.mockResolvedValue(3);

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
      expect(prisma.eloRating.count).not.toHaveBeenCalled();
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
