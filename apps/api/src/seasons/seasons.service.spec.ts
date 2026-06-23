import { SeasonStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import { SeasonsService } from "./seasons.service.js";
import type { SeasonsQueueService } from "./seasons-queue.service.js";

describe("SeasonsService", () => {
  let service: SeasonsService;
  let season: {
    create: ReturnType<typeof jest.fn>;
    findUnique: ReturnType<typeof jest.fn>;
    update: ReturnType<typeof jest.fn>;
  };
  let enqueueSeasonReset: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    season = { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() };
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
      season.update.mockResolvedValue({ id: "season-1", status: SeasonStatus.closed });

      const result = await service.closeSeason("season-1");

      expect(season.update).toHaveBeenCalledWith({
        where: { id: "season-1" },
        data: { status: SeasonStatus.closed },
      });
      expect(enqueueSeasonReset).toHaveBeenCalledWith("season-1");
      expect(result.status).toBe(SeasonStatus.closed);
    });

    it("throws 409 SEASON_ALREADY_CLOSED when the season is already closed", async () => {
      season.findUnique.mockResolvedValue({ id: "season-1", status: SeasonStatus.closed });

      await expect(service.closeSeason("season-1")).rejects.toMatchObject({
        response: { error: "SEASON_ALREADY_CLOSED" },
      });
      await expect(service.closeSeason("season-1")).rejects.toBeInstanceOf(ConflictException);
      expect(season.update).not.toHaveBeenCalled();
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
