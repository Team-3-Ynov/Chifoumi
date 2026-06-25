import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { TournamentsController } from "./tournaments.controller.js";
import type { TournamentsService } from "./tournaments.service.js";

describe("TournamentsController", () => {
  let controller: TournamentsController;
  let tournamentsService: {
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
      registerPlayer: jest.fn(),
      unregisterPlayer: jest.fn(),
    };
    controller = new TournamentsController(tournamentsService as unknown as TournamentsService);
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
