import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { UserService } from "../user-service/user.service.js";
import { MeService } from "./me.service.js";

describe("MeService", () => {
  let service: MeService;
  let userService: {
    getCurrentProfile: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    userService = {
      getCurrentProfile: jest.fn(),
    };
    service = new MeService(userService as unknown as UserService);
  });

  it("delegates authenticated profile loading to the shared user service", async () => {
    const profile = {
      id: "user-1",
      email: "player@example.com",
      displayName: "player",
      role: "player",
      rating: 1000,
      gamesPlayed: 0,
      league: { name: "Bronze", tier: 1 },
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    };
    userService.getCurrentProfile.mockResolvedValue(profile);

    await expect(service.getProfile("user-1")).resolves.toBe(profile);
    expect(userService.getCurrentProfile).toHaveBeenCalledWith("user-1");
  });
});
