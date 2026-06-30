import { Prisma, UserRole } from "@chifoumi/db";
import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as argon2 from "argon2";
import type { PrismaService } from "../prisma/prisma.service.js";
import { UserService } from "./users.service.js";

let realHash: string;

beforeAll(async () => {
  realHash = await argon2.hash("correct-password", {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
});

describe("UserService", () => {
  let service: UserService;
  let prisma: {
    $transaction: ReturnType<typeof jest.fn>;
    $queryRaw: ReturnType<typeof jest.fn>;
    user: {
      findMany: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      count: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
    };
    eloRating: {
      findMany: ReturnType<typeof jest.fn>;
      count: ReturnType<typeof jest.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      user: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
      eloRating: { findMany: jest.fn(), count: jest.fn() },
    };
    service = new UserService(prisma as unknown as PrismaService);
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

  it("adds the current league to public profiles", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      displayName: "gold-player",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      eloRating: { rating: 1250, gamesPlayed: 10 },
    });
    prisma.$queryRaw.mockResolvedValue([{ wins: 4 }]);

    const result = await service.getPublicProfile("user-1");

    expect(result).toEqual({
      id: "user-1",
      displayName: "gold-player",
      rating: 1250,
      gamesPlayed: 10,
      league: { name: "Gold", tier: 3 },
      winRate: 0.4,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });
  });

  it("keeps public profile win rate at zero before any games", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      displayName: "new-player",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      eloRating: null,
    });

    await expect(service.getPublicProfile("user-1")).resolves.toMatchObject({
      rating: 1000,
      gamesPlayed: 0,
      winRate: 0,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns a user record by email", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "player@example.com",
      passwordHash: "hash",
      displayName: "player",
      role: UserRole.player,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    await expect(service.findByEmail("player@example.com")).resolves.toEqual({
      id: "user-1",
      email: "player@example.com",
      passwordHash: "hash",
      displayName: "player",
      role: "player",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("returns null when a user lookup misses", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findById("missing")).resolves.toBeNull();
  });

  it("builds the current user profile with private fields", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "player@example.com",
      displayName: "player",
      role: UserRole.player,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      eloRating: { rating: 980, gamesPlayed: 3 },
    });

    await expect(service.getCurrentProfile("user-1")).resolves.toEqual({
      id: "user-1",
      email: "player@example.com",
      displayName: "player",
      role: "player",
      rating: 980,
      gamesPlayed: 3,
      league: { name: "Bronze", tier: 1 },
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("creates the user and initial elo rating in one transaction", async () => {
    const createdAt = new Date("2026-05-01T00:00:00.000Z");
    prisma.$transaction.mockImplementation(async (callback: unknown) =>
      (callback as (tx: never) => Promise<unknown>)({
        user: {
          create: jest.fn(async () => ({
            id: "user-1",
            email: "new@example.com",
            passwordHash: "hash",
            displayName: "newbie",
            role: UserRole.player,
            createdAt,
          })),
        },
        eloRating: {
          create: jest.fn(async () => ({})),
        },
      } as never),
    );

    await expect(
      service.createUser({
        email: "new@example.com",
        passwordHash: "hash",
        displayName: "newbie",
      }),
    ).resolves.toMatchObject({
      id: "user-1",
      email: "new@example.com",
      role: "player",
      createdAt,
    });
  });

  it("returns rating defaults when the elo row is missing", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", eloRating: null });

    await expect(service.getRating("user-1")).resolves.toEqual({ rating: 1000, gamesPlayed: 0 });
  });

  it("throws USER_NOT_FOUND when rating lookup misses", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getRating("missing")).rejects.toMatchObject({
      response: { error: "USER_NOT_FOUND" },
    });
  });

  it("updates a user's password hash", async () => {
    prisma.user.update.mockResolvedValue({});

    await service.updatePassword("user-1", "new-hash");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-hash" },
    });
  });

  it("lists leaderboard rows ordered by ranking fields", async () => {
    prisma.eloRating.findMany.mockResolvedValue([
      {
        rating: 1500,
        gamesPlayed: 42,
        user: { id: "user-1", displayName: "Alice" },
      },
    ]);

    await expect(service.listLeaderboard(20, "gold")).resolves.toEqual({
      items: [
        {
          rank: 1,
          userId: "user-1",
          displayName: "Alice",
          rating: 1500,
          gamesPlayed: 42,
          league: { name: "Gold", tier: 3 },
        },
      ],
    });
    expect(prisma.eloRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rating: { gte: 1200, lte: 1349 } },
        orderBy: [{ rating: "desc" }, { gamesPlayed: "desc" }],
        take: 20,
      }),
    );
  });

  it("computes competition stats with 1-indexed rank", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      eloRating: { rating: 1150, gamesPlayed: 12 },
    });
    prisma.eloRating.count.mockResolvedValue(6);

    await expect(service.getCompetitionStats("user-1")).resolves.toEqual({
      rating: 1150,
      gamesPlayed: 12,
      rank: 7,
    });
    expect(prisma.eloRating.count).toHaveBeenCalledWith({
      where: {
        OR: [{ rating: { gt: 1150 } }, { rating: 1150, gamesPlayed: { gt: 12 } }],
      },
    });
  });

  it("returns verified user data when password matches", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "player@example.com",
      passwordHash: realHash,
      displayName: "player",
      role: UserRole.player,
    });

    const result = await service.verifyPassword("player@example.com", "correct-password");

    expect(result).toEqual({
      valid: true,
      userId: "user-1",
      displayName: "player",
      role: "player",
    });
  });

  it("returns null when password does not match", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "player@example.com",
      passwordHash: realHash,
      displayName: "player",
      role: UserRole.player,
    });

    const result = await service.verifyPassword("player@example.com", "wrong-password");

    expect(result).toBeNull();
  });

  it("returns null for unknown email and runs dummy verify to prevent timing attack", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.verifyPassword("nobody@example.com", "any-password");

    expect(result).toBeNull();
  });

  it("converts a UserRecord to a SafeUser without sensitive fields", () => {
    const record = {
      id: "user-1",
      email: "player@example.com",
      passwordHash: "secret-hash",
      displayName: "player",
      role: "player" as const,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(service.toSafeUser(record)).toEqual({
      id: "user-1",
      email: "player@example.com",
      displayName: "player",
      role: "player",
    });
    expect(service.toSafeUser(record)).not.toHaveProperty("passwordHash");
  });

  it("classifies expected Prisma errors for API translation", () => {
    const unique = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
    });
    const missing = new Prisma.PrismaClientKnownRequestError("missing", {
      code: "P2025",
      clientVersion: "test",
    });

    expect(service.isUniqueConstraintError(unique)).toBe(true);
    expect(service.isUniqueConstraintError(missing)).toBe(false);
    expect(service.isNotFoundError(missing)).toBe(true);
    expect(service.isNotFoundError(unique)).toBe(false);
  });
});
