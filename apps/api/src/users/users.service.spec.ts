import { UserRole } from "@chifoumi/db";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { PrismaService } from "../prisma/prisma.service.js";
import { UsersService } from "./users.service.js";

describe("UsersService.listUsers", () => {
  let service: UsersService;
  let prisma: {
    $transaction: ReturnType<typeof jest.fn>;
    user: { findMany: ReturnType<typeof jest.fn>; count: ReturnType<typeof jest.fn> };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      user: { findMany: jest.fn(), count: jest.fn() },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it("maps users with their elo rating and pagination metadata", async () => {
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: "user-1",
          email: "admin@example.com",
          displayName: "admin",
          role: UserRole.admin,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          eloRating: { rating: 1200, gamesPlayed: 5 },
        },
        {
          id: "user-2",
          email: "player@example.com",
          displayName: "player",
          role: UserRole.player,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          eloRating: null,
        },
      ],
      42,
    ]);

    const result = await service.listUsers(2, 20);

    expect(result.total).toBe(42);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.items[0]).toEqual({
      id: "user-1",
      email: "admin@example.com",
      displayName: "admin",
      role: "admin",
      rating: 1200,
      gamesPlayed: 5,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    // Falls back to defaults when no elo rating row exists.
    expect(result.items[1]).toMatchObject({ role: "player", rating: 1000, gamesPlayed: 0 });
  });

  it("computes the skip offset from the requested page", async () => {
    prisma.$transaction.mockImplementation((operations: unknown) => {
      void operations;
      return Promise.resolve([[], 0]);
    });

    await service.listUsers(3, 10);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10, orderBy: { createdAt: "desc" } }),
    );
  });
});
