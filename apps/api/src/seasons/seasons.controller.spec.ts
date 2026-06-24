import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { CurrentSeasonResponseDto } from "./dto/current-season-response.dto.js";
import type { SeasonStandingsResponseDto } from "./dto/season-standings-response.dto.js";
import { SeasonsController } from "./seasons.controller.js";
import type { SeasonsService } from "./seasons.service.js";

describe("SeasonsController", () => {
  let controller: SeasonsController;
  let seasonsService: {
    getCurrent: ReturnType<typeof jest.fn>;
    getStandings: ReturnType<typeof jest.fn>;
    listClosed: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    seasonsService = { getCurrent: jest.fn(), getStandings: jest.fn(), listClosed: jest.fn() };
    controller = new SeasonsController(seasonsService as unknown as SeasonsService);
  });

  it("delegates to the service with the authenticated user id", async () => {
    const response = { season: {}, me: {} } as CurrentSeasonResponseDto;
    seasonsService.getCurrent.mockResolvedValue(response);

    const result = await controller.getCurrent({
      user: { id: "ryu-id", email: "ryu@example.com", displayName: "ryu", role: "player" },
    });

    expect(result).toBe(response);
    expect(seasonsService.getCurrent).toHaveBeenCalledWith("ryu-id");
  });

  it("delegates standings lookup to the service", async () => {
    const response: SeasonStandingsResponseDto = {
      season: { id: "season-1", name: "Saison 1", status: "closed" },
      items: [],
      total: 0,
      page: 1,
      limit: 50,
    };
    seasonsService.getStandings.mockResolvedValue(response);

    const result = await controller.getStandings("season-1", { page: 1, limit: 50 });

    expect(result).toBe(response);
    expect(seasonsService.getStandings).toHaveBeenCalledWith("season-1", { page: 1, limit: 50 });
  });

  it("delegates closed season listing to the service", async () => {
    const response = { items: [] };
    seasonsService.listClosed.mockResolvedValue(response);

    const result = await controller.listClosed();

    expect(result).toBe(response);
    expect(seasonsService.listClosed).toHaveBeenCalledWith();
  });
});
