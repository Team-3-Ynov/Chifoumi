import { SeasonStatus } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { AdminSeasonsController } from "./admin-seasons.controller.js";
import { CreateSeasonDto } from "./dto/create-season.dto.js";
import type { SeasonsService } from "./seasons.service.js";

function makeSeason(overrides: Record<string, unknown> = {}) {
  return {
    id: "season-1",
    name: "Saison 3",
    status: SeasonStatus.upcoming,
    startedAt: new Date("2026-07-01T00:00:00.000Z"),
    endsAt: new Date("2026-08-01T00:00:00.000Z"),
    createdAt: new Date("2026-06-23T12:00:00.000Z"),
    updatedAt: new Date("2026-06-23T12:00:00.000Z"),
    ...overrides,
  };
}

describe("AdminSeasonsController", () => {
  let controller: AdminSeasonsController;
  let seasonsService: {
    createSeason: ReturnType<typeof jest.fn>;
    closeSeason: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    seasonsService = { createSeason: jest.fn(), closeSeason: jest.fn() };
    controller = new AdminSeasonsController(seasonsService as unknown as SeasonsService);
  });

  describe("createSeason", () => {
    it("delegates to the service and maps the season to a response DTO", async () => {
      seasonsService.createSeason.mockResolvedValue(makeSeason());

      const dto = new CreateSeasonDto();
      dto.name = "Saison 3";
      dto.endsAt = new Date("2026-08-01T00:00:00.000Z");

      const result = await controller.createSeason(dto);

      expect(seasonsService.createSeason).toHaveBeenCalledWith({
        name: "Saison 3",
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
      });
      expect(result).toEqual({
        id: "season-1",
        name: "Saison 3",
        status: "upcoming",
        startedAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-23T12:00:00.000Z"),
        updatedAt: new Date("2026-06-23T12:00:00.000Z"),
      });
    });
  });

  describe("closeSeason", () => {
    it("delegates to the service with the season id", async () => {
      seasonsService.closeSeason.mockResolvedValue(makeSeason({ status: SeasonStatus.closed }));

      const result = await controller.closeSeason("season-1");

      expect(seasonsService.closeSeason).toHaveBeenCalledWith("season-1");
      expect(result.status).toBe("closed");
    });
  });
});

describe("AdminSeasonsController role protection", () => {
  const guard = new RolesGuard(new Reflector());

  function contextForRole(role: string | undefined): ExecutionContext {
    return {
      getHandler: () => AdminSeasonsController.prototype.createSeason,
      getClass: () => AdminSeasonsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }

  it("allows an admin to reach the controller", () => {
    expect(guard.canActivate(contextForRole("admin"))).toBe(true);
  });

  it("rejects a non-admin with a 403 ForbiddenException", () => {
    expect(() => guard.canActivate(contextForRole("player"))).toThrow(ForbiddenException);
  });
});
