import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { CurrentSeasonResponseDto } from "./dto/current-season-response.dto.js";
import { SeasonsController } from "./seasons.controller.js";
import type { SeasonsService } from "./seasons.service.js";

describe("SeasonsController", () => {
  let controller: SeasonsController;
  let seasonsService: { getCurrent: ReturnType<typeof jest.fn> };

  beforeEach(() => {
    seasonsService = { getCurrent: jest.fn() };
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
});
