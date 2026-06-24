import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TournamentFormat, TournamentStatus } from "@prisma/client";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { AdminTournamentsController } from "./admin-tournaments.controller.js";
import { CreateTournamentDto } from "./dto/create-tournament.dto.js";
import type { TournamentsService } from "./tournaments.service.js";

function makeTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: "tournament-1",
    name: "Spring Cup",
    format: TournamentFormat.single_elim,
    bracketSize: 16,
    registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
    startsAt: new Date("2026-07-15T18:00:00.000Z"),
    endedAt: null,
    status: TournamentStatus.upcoming,
    winnerId: null,
    createdAt: new Date("2026-06-23T12:00:00.000Z"),
    updatedAt: new Date("2026-06-23T12:00:00.000Z"),
    ...overrides,
  };
}

describe("AdminTournamentsController", () => {
  let controller: AdminTournamentsController;
  let tournamentsService: {
    createTournament: ReturnType<typeof jest.fn>;
    openRegistration: ReturnType<typeof jest.fn>;
    startTournament: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    tournamentsService = {
      createTournament: jest.fn(),
      openRegistration: jest.fn(),
      startTournament: jest.fn(),
    };
    controller = new AdminTournamentsController(
      tournamentsService as unknown as TournamentsService,
    );
  });

  describe("createTournament", () => {
    it("delegates to the service and maps the tournament to a response DTO", async () => {
      tournamentsService.createTournament.mockResolvedValue(makeTournament());

      const dto = new CreateTournamentDto();
      dto.name = "Spring Cup";
      dto.format = TournamentFormat.single_elim;
      dto.bracketSize = 16;
      dto.registrationOpensAt = new Date("2026-07-01T00:00:00.000Z");
      dto.startsAt = new Date("2026-07-15T18:00:00.000Z");

      const result = await controller.createTournament(dto);

      expect(tournamentsService.createTournament).toHaveBeenCalledWith({
        name: "Spring Cup",
        format: TournamentFormat.single_elim,
        bracketSize: 16,
        registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
        startsAt: new Date("2026-07-15T18:00:00.000Z"),
      });
      expect(result).toEqual({
        id: "tournament-1",
        name: "Spring Cup",
        format: TournamentFormat.single_elim,
        bracketSize: 16,
        registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
        startsAt: new Date("2026-07-15T18:00:00.000Z"),
        status: TournamentStatus.upcoming,
        createdAt: new Date("2026-06-23T12:00:00.000Z"),
        updatedAt: new Date("2026-06-23T12:00:00.000Z"),
      });
    });
  });

  describe("openRegistration", () => {
    it("delegates to the service with the tournament id", async () => {
      tournamentsService.openRegistration.mockResolvedValue(
        makeTournament({ status: TournamentStatus.registration_open }),
      );

      const result = await controller.openRegistration("tournament-1");

      expect(tournamentsService.openRegistration).toHaveBeenCalledWith("tournament-1");
      expect(result.status).toBe(TournamentStatus.registration_open);
    });
  });

  describe("startTournament", () => {
    it("delegates to the service with the tournament id", async () => {
      tournamentsService.startTournament.mockResolvedValue(
        makeTournament({ status: TournamentStatus.in_progress }),
      );

      const result = await controller.startTournament("tournament-1");

      expect(tournamentsService.startTournament).toHaveBeenCalledWith("tournament-1");
      expect(result.status).toBe(TournamentStatus.in_progress);
    });
  });
});

describe("AdminTournamentsController role protection", () => {
  const guard = new RolesGuard(new Reflector());

  function contextForRole(role: string | undefined): ExecutionContext {
    return {
      getHandler: () => AdminTournamentsController.prototype.createTournament,
      getClass: () => AdminTournamentsController,
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
