import { SeasonStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { SeasonsQueueService } from "../queues/seasons-queue.service.js";
import { SeasonsService } from "./seasons.service.js";

describe("SeasonsService", () => {
  let service: SeasonsService;
  let season: {
    create: ReturnType<typeof jest.fn>;
    findUnique: ReturnType<typeof jest.fn>;
    updateMany: ReturnType<typeof jest.fn>;
  };
  let enqueueSeasonReset: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    season = { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() };
    enqueueSeasonReset = jest.fn();
    enqueueSeasonReset.mockResolvedValue(undefined);
    service = new SeasonsService(
      { season } as unknown as PrismaService,
      { enqueueSeasonReset } as unknown as SeasonsQueueService,
    );
  });

  describe("createSeason", () => {
    it("creates an upcoming season with a startedAt timestamp", async () => {
      season.create.mockResolvedValue({ id: "season-1", status: SeasonStatus.upcoming });

      await service.createSeason({
        name: "Saison 3",
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
      });

      expect(season.create).toHaveBeenCalledWith({
        data: {
          name: "Saison 3",
          startedAt: expect.any(Date),
          endsAt: new Date("2026-08-01T00:00:00.000Z"),
          status: SeasonStatus.upcoming,
        },
      });
      // Never enqueues a reset on creation.
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });
  });

  describe("closeSeason", () => {
    it("closes an active season and enqueues a season-reset job", async () => {
      season.findUnique.mockResolvedValue({ id: "season-1", status: SeasonStatus.active });
      season.updateMany.mockResolvedValue({ count: 1 });
      season.findUnique.mockResolvedValueOnce({ id: "season-1", status: SeasonStatus.active });
      season.findUnique.mockResolvedValueOnce({ id: "season-1", status: SeasonStatus.closed });

      const result = await service.closeSeason("season-1");

      expect(season.updateMany).toHaveBeenCalledWith({
        where: { id: "season-1", status: SeasonStatus.active },
        data: { status: SeasonStatus.closed },
      });
      expect(enqueueSeasonReset).toHaveBeenCalledWith("season-1");
      expect(result.status).toBe(SeasonStatus.closed);
    });

    it("rolls back the season status when enqueueing the reset job fails", async () => {
      const queueError = new Error("Redis unavailable");
      season.findUnique.mockResolvedValueOnce({ id: "season-1", status: SeasonStatus.active });
      season.updateMany.mockResolvedValueOnce({ count: 1 });
      season.updateMany.mockResolvedValueOnce({ count: 1 });
      enqueueSeasonReset.mockRejectedValue(queueError);

      await expect(service.closeSeason("season-1")).rejects.toThrow(queueError);

      expect(season.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: "season-1", status: SeasonStatus.active },
        data: { status: SeasonStatus.closed },
      });
      expect(season.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: "season-1", status: SeasonStatus.closed },
        data: { status: SeasonStatus.active },
      });
    });

    it("does not enqueue twice when another request already closed the season", async () => {
      season.findUnique.mockResolvedValueOnce({ id: "season-1", status: SeasonStatus.active });
      season.findUnique.mockResolvedValueOnce({ id: "season-1", status: SeasonStatus.closed });
      season.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.closeSeason("season-1")).rejects.toMatchObject({
        response: { error: "SEASON_ALREADY_CLOSED" },
      });

      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });

    it("throws 409 SEASON_ALREADY_CLOSED when the season is already closed", async () => {
      season.findUnique.mockResolvedValue({ id: "season-1", status: SeasonStatus.closed });

      await expect(service.closeSeason("season-1")).rejects.toMatchObject({
        response: { error: "SEASON_ALREADY_CLOSED" },
      });
      await expect(service.closeSeason("season-1")).rejects.toBeInstanceOf(ConflictException);
      expect(season.updateMany).not.toHaveBeenCalled();
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });

    it("throws 409 SEASON_NOT_ACTIVE when the season is still upcoming", async () => {
      season.findUnique.mockResolvedValue({ id: "season-1", status: SeasonStatus.upcoming });

      await expect(service.closeSeason("season-1")).rejects.toMatchObject({
        response: { error: "SEASON_NOT_ACTIVE" },
      });
      await expect(service.closeSeason("season-1")).rejects.toBeInstanceOf(ConflictException);
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });

    it("throws 404 SEASON_NOT_FOUND when the season does not exist", async () => {
      season.findUnique.mockResolvedValue(null);

      await expect(service.closeSeason("missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(enqueueSeasonReset).not.toHaveBeenCalled();
    });
  });
});
