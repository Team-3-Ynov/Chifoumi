import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { TournamentsController } from "./tournaments.controller.js";
import type { TournamentsService } from "./tournaments.service.js";

describe("TournamentsController", () => {
  let controller: TournamentsController;
  let tournamentsService: {
    listTournaments: ReturnType<typeof jest.fn>;
    getTournamentDetail: ReturnType<typeof jest.fn>;
    registerPlayer: ReturnType<typeof jest.fn>;
    unregisterPlayer: ReturnType<typeof jest.fn>;
  };

  const authenticatedRequest = {
    user: {
      id: "user-1",
      email: "player@example.com",
      displayName: "player",
      role: "player" as const,
    },
  };

  beforeEach(() => {
    tournamentsService = {
      listTournaments: jest.fn(),
      getTournamentDetail: jest.fn(),
      registerPlayer: jest.fn(),
      unregisterPlayer: jest.fn(),
    };
    controller = new TournamentsController(tournamentsService as unknown as TournamentsService);
  });

  describe("listTournaments", () => {
    it("delegates to the service with query parameters", async () => {
      const response = { items: [], page: 1, limit: 20, total: 0 };
      tournamentsService.listTournaments.mockResolvedValue(response);

      const result = await controller.listTournaments({ page: 1, limit: 20 });

      expect(result).toBe(response);
      expect(tournamentsService.listTournaments).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  describe("getTournamentDetail", () => {
    it("delegates to the service with the tournament id", async () => {
      const response = { id: "tournament-1" };
      tournamentsService.getTournamentDetail.mockResolvedValue(response);

      const result = await controller.getTournamentDetail("tournament-1");

      expect(result).toBe(response);
      expect(tournamentsService.getTournamentDetail).toHaveBeenCalledWith("tournament-1");
    });
  });

  describe("register", () => {
    it("delegates to the service with the tournament id and authenticated user id", async () => {
      tournamentsService.registerPlayer.mockResolvedValue(undefined);

      await controller.register("tournament-1", authenticatedRequest);

      expect(tournamentsService.registerPlayer).toHaveBeenCalledWith("tournament-1", "user-1");
    });
  });

  describe("unregister", () => {
    it("delegates to the service with the tournament id and authenticated user id", async () => {
      tournamentsService.unregisterPlayer.mockResolvedValue(undefined);

      await controller.unregister("tournament-1", authenticatedRequest);

      expect(tournamentsService.unregisterPlayer).toHaveBeenCalledWith("tournament-1", "user-1");
    });
  });
});
